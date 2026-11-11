import { computed, inject, provide, ref, toRaw, type InjectionKey, type Ref } from 'vue'
import { dayLabel, platformLabel } from '@/lib/schedule'
import * as plan from '@shared/plans/schedule'
import { ids, isSpacerId, newSpacerId, ordered, scheduleUpdates, type CellLocation, type EventLocation, type Kind, type ScheduleEnv } from '@shared/plans/schedule'
import { isoDate } from '@shared/dates'
import { toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import type { ManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { isDanced } from '@/lib/trophyEvents'

// The schedule builder's model. It reads competitions:data/{id}/schedule as
// stored and edits it the same way: every action changes a copy of the
// schedule, and the difference is saved as one change (one undo step).
//
// Days stay in the stored shape (the public pages and older apps read
// days › sessions › events › dances), but the builder shows one day at a
// time and makes the first day when the first session is added, named for
// the competition's weekday (older apps head the schedule with it).
// Siblings are ordered by `order`, falling back to their key, as on the
// public pages. Dances, age groups, judges and platforms are only read here:
// they're managed in their own Manage sections.

export type { Assignment, SDance, SEvent, SBlock, SDay, SSchedule, EventLocation, CellLocation } from '@shared/plans/schedule'
export { ids, isSpacerId, newSpacerId, ordered, isoDate }
import type { SDance, SDay, SSchedule } from '@shared/plans/schedule'

/** A short category name: "Primary" → "Pri", "Pre-Premier" → "PP". */
function abbreviate(name: string) {
  // By character, not UTF-16 unit, so an emoji isn't cut in half.
  const words = name.split(/[\s-]+/).filter(Boolean)
  return words.length > 1
    ? words.map((w) => Array.from(w)[0].toUpperCase()).join('')
    : Array.from(name).slice(0, 3).join('')
}

const clone = <T>(v: T): T => plan.clone(toRaw(v))

export function createBuilder(m: ManagedCompetition, dayParam: Ref<string | undefined>) {
  // --- Reading

  const schedule = computed(() => (m.schedule.value ?? {}) as SSchedule)
  const days = computed(() => ordered(schedule.value.days))
  const dayId = computed(() =>
    dayParam.value && days.value.some(([id]) => id === dayParam.value)
      ? dayParam.value
      : days.value[0]?.[0],
  )
  const blocks = computed(() =>
    ordered(dayId.value ? schedule.value.days?.[dayId.value]?.blocks : undefined),
  )
  const readonly = computed(() => !canEdit.value)
  // Platforms labelled as the public pages show them ("B" → "Platform B", "=Main hall" → "Main hall").
  const platforms = computed(() => m.platforms.value.map((p) => ({ ...p, label: platformLabel(p.name) || p.label })))
  // On a phone the grid shows one platform at a time (null: all of them).
  const platformView = ref<string | null>(null)
  const shownPlatforms = computed(() => {
    const one = platformView.value && platforms.value.find((p) => p.id === platformView.value)
    return one ? [one] : platforms.value
  })

  const groupsByCategory = computed(() => {
    const map = new Map<string, typeof m.groups.value>()
    for (const g of m.groups.value) {
      const key =
        g.categoryId && m.categoriesById.value.has(g.categoryId) ? g.categoryId : ''
      map.set(key, [...(map.get(key) ?? []), g])
    }
    return map
  })

  const getDance = (id?: string) => (id ? m.dancesById.value.get(id) : undefined)
  const danceName = (id?: string) => {
    const d = getDance(id)
    return d ? (d.shortName || d.name || '').trim() || d.label : 'Unknown dance'
  }
  // Trophy events danced on their own go in the cells beside the age groups.
  // Only the danced ones can: the rest are decided from the age groups' results.
  const dancedTrophyEvents = computed(() => m.trophyEvents.value.filter(isDanced))
  const isTrophyEvent = (id: string) => m.trophyEventsById.value.has(id)
  /** Can this age group do this dance? Dances with no groups set take any. A trophy event only does its own. */
  function eligible(danceId: string | undefined, groupId: string) {
    const trophyEvent = m.trophyEventsById.value.get(groupId)
    if (trophyEvent) return !!danceId && trophyEvent.danceId === danceId
    const groups = getDance(danceId)?.groupIds
    return !groups || !Object.values(groups).some(Boolean) || !!groups[groupId]
  }

  /** Short label for cells: "Pri 8 & Under". */
  function groupLabel(id: string) {
    const trophyEvent = m.trophyEventsById.value.get(id)
    if (trophyEvent) return trophyEvent.label
    const g = m.groupsById.value.get(id)
    if (!g) return 'Unknown age group'
    const cat = g.category?.name?.trim()
    return [cat && abbreviate(cat), g.name?.trim()].filter(Boolean).join(' ') || g.label
  }
  const groupFullLabel = (id: string) =>
    m.trophyEventsById.value.get(id)?.label ?? m.groupsById.value.get(id)?.label ?? 'Unknown age group'

  // Judges by last name, adding an initial or first name only to tell
  // people apart.
  const staffNames = computed(() => {
    const names = new Map<string, string>()
    const byLast = new Map<string, typeof m.staff.value>()
    for (const s of m.staff.value) {
      const last = (s.lastName ?? '').trim() || s.label
      byLast.set(last, [...(byLast.get(last) ?? []), s])
    }
    for (const [last, same] of byLast) {
      if (same.length === 1) {
        names.set(same[0].id, last)
        continue
      }
      const byInitial = new Map<string, typeof same>()
      for (const s of same) {
        const key = `${(s.firstName ?? '').trim().charAt(0)}. ${last}`
        byInitial.set(key, [...(byInitial.get(key) ?? []), s])
      }
      for (const [key, list] of byInitial)
        for (const s of list) names.set(s.id, list.length === 1 ? key : s.label)
    }
    return names
  })
  const staffName = (id: string) => staffNames.value.get(id) ?? 'Unknown judge'
  const staffFullName = (id: string) =>
    m.staff.value.find((s) => s.id === id)?.label ?? 'Unknown judge'

  // --- Editing

  let draft: SSchedule | null = null
  /** What actions read: the copy being changed, if any, else what's saved. */
  const src = () => draft ?? schedule.value

  /** What the shared actions need (shared/plans/schedule): the day being edited, new ids, the first day. */
  const env = (): ScheduleEnv => ({ dayId: dayId.value, newId: m.newKey, competitionDate: m.competition.value?.date })

  /**
   * Change the schedule and save the difference as one change. Actions
   * called inside `fn` join the same change (e.g. autofill).
   */
  function edit(label: string, fn: (s: SSchedule) => void): Promise<number | null> {
    if (draft) {
      fn(draft)
      return Promise.resolve(null)
    }
    const before = clone(schedule.value)
    const after = clone(before)
    draft = after
    try {
      fn(after)
    } finally {
      draft = null
    }
    const updates = scheduleUpdates(before, after)
    if (!Object.keys(updates).length) return Promise.resolve(null)
    return m.writeData(updates, label).catch((e) => {
      toast(friendlyError(e), { tone: 'error' })
      return null
    })
  }

  const nextDay = (s: SSchedule): SDay => plan.nextDay(s, m.competition.value?.date)

  // Lookups within the day being edited, in `s` (a draft) or what's saved.
  const blockIn = (s: SSchedule, b: string) => plan.blockIn(s, env(), b)
  const eventIn = (s: SSchedule, b: string, e: string) => plan.eventIn(s, env(), b, e)
  const rowIn = (s: SSchedule, b: string, e: string, d: string) => plan.rowIn(s, env(), b, e, d)

  const getBlock = (b: string) => blockIn(src(), b)
  const getEvent = (b: string, e: string) => eventIn(src(), b, e)
  const getRow = (b: string, e: string, d: string) => rowIn(src(), b, e, d)
  const blockLabel = (b: string) => getBlock(b)?.name?.trim() || 'session'
  const eventLabel = (b: string, e: string) => getEvent(b, e)?.name?.trim() || 'event'
  const rowLabel = (row: SDance | undefined) =>
    row?.danceId ? danceName(row.danceId) : row?.name?.trim() || 'row'

  // Age groups and judges in platform cells
  const itemLabel = (kind: Kind, id: string) =>
    kind === 'judge' ? staffName(id) : isSpacerId(id) ? 'a spacer' : groupLabel(id)

  const addToCell = (kind: Kind, loc: CellLocation, id: string, index?: number) =>
    edit(
      `Added ${itemLabel(kind, id)} to ${rowLabel(getRow(loc.blockId, loc.eventId, loc.danceId))}`,
      (s) => plan.addToCell(s, env(), kind, loc, id, index),
    )
  const removeFromCell = (kind: Kind, loc: CellLocation, id: string) =>
    edit(`Removed ${itemLabel(kind, id)}`, (s) => plan.removeFromCell(s, env(), kind, loc, id))
  const moveBetweenCells = (
    kind: Kind,
    from: CellLocation,
    to: CellLocation,
    id: string,
    index?: number,
  ) => edit(`Moved ${itemLabel(kind, id)}`, (s) => plan.moveBetweenCells(s, env(), kind, from, to, id, index))
  const reorderInCell = (kind: Kind, loc: CellLocation, from: number, to: number) =>
    edit(kind === 'group' ? 'Reordered age groups' : 'Reordered judges', (s) => plan.reorderInCell(s, env(), kind, loc, from, to))
  /** Replace a cell's age groups or judges (autofill). */
  function setCell(kind: Kind, loc: CellLocation, list: string[]) {
    return edit(kind === 'group' ? 'Assigned age groups' : 'Assigned judges', (s) => plan.setCell(s, env(), kind, loc, list))
  }

  // Days
  const dayName = (d: string) => {
    const i = days.value.findIndex(([id]) => id === d)
    return i >= 0 ? dayLabel(days.value[i][1], i) : 'day'
  }
  function addDay() {
    const id = m.newKey()
    const day = nextDay(src())
    void edit(`Added ${day.name}`, (s) => plan.addDay(s, id, day))
    return id
  }
  const renameDay = (d: string, name: string) => edit(`Renamed ${dayName(d)}`, (s) => plan.renameDay(s, d, name))
  /** Set a day's date (YYYY-MM-DD, or '' for none). A name that was its weekday follows it. */
  const setDayDate = (d: string, date: string) => edit(`Changed the date of ${dayName(d)}`, (s) => plan.setDayDate(s, d, date))
  const removeDay = (d: string) => edit(`Deleted ${dayName(d)}`, (s) => plan.removeDay(s, d))

  // Sessions
  function addBlock(name: string) {
    const id = m.newKey()
    void edit(`Added ${name}`, (s) => plan.addBlock(s, env(), id, name))
    return id
  }
  const removeBlock = (b: string) => edit(`Deleted ${blockLabel(b)}`, (s) => plan.removeBlock(s, env(), b))
  const clearDay = () => edit('Cleared the schedule', (s) => plan.clearDay(s, env()))
  const renameBlock = (b: string, name: string) => edit(`Renamed ${blockLabel(b)}`, (s) => plan.renameBlock(s, env(), b, name))
  const describeBlock = (b: string, description: string) =>
    edit(`Changed ${blockLabel(b)}`, (s) => plan.describeBlock(s, env(), b, description))
  const reorderBlock = (from: number, to: number) => edit('Reordered sessions', (s) => plan.reorderBlock(s, env(), from, to))

  // Events
  function addEvent(b: string, name: string, description?: string) {
    const id = m.newKey()
    void edit(`Added ${name}`, (s) => plan.addEvent(s, env(), b, id, name, description))
    return id
  }
  const removeEvent = (b: string, e: string) => edit(`Deleted ${eventLabel(b, e)}`, (s) => plan.removeEvent(s, env(), b, e))
  const renameEvent = (b: string, e: string, name: string) =>
    edit(`Renamed ${eventLabel(b, e)}`, (s) => plan.renameEvent(s, env(), b, e, name))
  const describeEvent = (b: string, e: string, description: string) =>
    edit(`Changed ${eventLabel(b, e)}`, (s) => plan.describeEvent(s, env(), b, e, description))
  const reorderEvent = (b: string, from: number, to: number) =>
    edit('Reordered events', (s) => plan.reorderEvent(s, env(), b, from, to))

  // Dances and other rows (Registration, March Past…)
  function addRow(
    b: string,
    e: string,
    row: { danceId?: string; name?: string },
    index?: number,
  ) {
    const id = m.newKey()
    void edit(
      `Added ${row.danceId ? danceName(row.danceId) : row.name || 'a row'}`,
      (s) => plan.addRow(s, env(), b, e, id, row, index),
    )
    return id
  }
  const removeRow = (b: string, e: string, d: string) =>
    edit(`Deleted ${rowLabel(getRow(b, e, d))}`, (s) => plan.removeRow(s, env(), b, e, d))
  const setRowText = (
    b: string,
    e: string,
    d: string,
    key: 'name' | 'description',
    value: string,
  ) => edit(`Changed ${rowLabel(getRow(b, e, d))}`, (s) => plan.setRowText(s, env(), b, e, d, key, value))
  const reorderRow = (b: string, e: string, from: number, to: number) =>
    edit('Reordered dances', (s) => plan.reorderRow(s, env(), b, e, from, to))
  const moveRow = (from: EventLocation, d: string, to: EventLocation, index?: number) =>
    edit(
      `Moved ${rowLabel(getRow(from.blockId, from.eventId, d))} to ${eventLabel(to.blockId, to.eventId)}`,
      (s) => plan.moveRow(s, env(), from, d, to, index),
    )

  return {
    m,
    // reading
    days,
    dayId,
    blocks,
    readonly,
    platforms,
    platformView,
    shownPlatforms,
    dances: m.dances,
    judges: m.judges,
    categories: m.categories,
    groupsByCategory,
    dancedTrophyEvents,
    isTrophyEvent,
    getDance,
    danceName,
    eligible,
    groupLabel,
    groupFullLabel,
    staffName,
    staffFullName,
    getBlock,
    getEvent,
    getRow,
    // editing
    edit,
    addToCell,
    removeFromCell,
    moveBetweenCells,
    reorderInCell,
    setCell,
    dayName,
    addDay,
    renameDay,
    setDayDate,
    removeDay,
    addBlock,
    removeBlock,
    clearDay,
    renameBlock,
    describeBlock,
    reorderBlock,
    addEvent,
    removeEvent,
    renameEvent,
    describeEvent,
    reorderEvent,
    addRow,
    removeRow,
    setRowText,
    reorderRow,
    moveRow,
  }
}

export type Builder = ReturnType<typeof createBuilder>

const key: InjectionKey<Builder> = Symbol('scheduleBuilder')

export function provideBuilder(m: ManagedCompetition, dayParam: Ref<string | undefined>) {
  const b = createBuilder(m, dayParam)
  provide(key, b)
  return b
}

export function useBuilder(): Builder {
  const b = inject(key)
  if (!b) throw new Error('useBuilder() must be used inside the schedule builder')
  return b
}
