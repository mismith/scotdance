import { computed, inject, provide, ref, toRaw, type InjectionKey, type Ref } from 'vue'
import { compareKeys } from '@/lib/competitionData'
import { formatWeekday, parseDate } from '@/lib/format'
import { dayLabel, idList, isSpacerId, platformLabel } from '@/lib/schedule'
import { toast } from '@/lib/admin/feedback'
import { canEdit, friendlyError } from '@/lib/admin/write'
import type { ManagedCompetition } from '@/composables/admin/useManagedCompetition'

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

export interface Assignment {
  orderedGroupIds?: string[]
  orderedJudgeIds?: string[]
}
export interface SDance {
  order?: number
  danceId?: string
  name?: string
  description?: string
  platforms?: Record<string, Assignment>
}
export interface SEvent {
  order?: number
  name?: string
  description?: string
  dances?: Record<string, SDance>
}
export interface SBlock {
  order?: number
  name?: string
  description?: string
  events?: Record<string, SEvent>
}
export interface SDay {
  order?: number
  name?: string
  date?: string | number
  description?: string
  blocks?: Record<string, SBlock>
}
export interface SSchedule {
  days?: Record<string, SDay>
}

/** Where an event is, within the day being edited. */
export interface EventLocation {
  blockId: string
  eventId: string
}
/** Where a platform cell is, within the day being edited. */
export interface CellLocation extends EventLocation {
  danceId: string
  platformId: string
}

/** Children in schedule order. */
export function ordered<T extends { order?: number }>(
  rec: Record<string, T> | null | undefined,
): Array<[string, T]> {
  return Object.entries(rec ?? {})
    .filter(([, v]) => v && typeof v === 'object')
    .sort(([ak, a], [bk, b]) =>
      Number.isInteger(a.order) && Number.isInteger(b.order)
        ? (a.order as number) - (b.order as number)
        : compareKeys(ak, bk),
    )
}

/** A stored id list (an array, or an object if it was ever sparse). */
export const ids = idList

/** Spacers among a platform's age groups have all-digit ids. */
export { isSpacerId }
export const newSpacerId = () => String(Date.now())

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(toRaw(v) ?? null))
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Drop what the database doesn't keep (empty lists and objects), so what's
 * saved reads back the same (undo compares the two).
 */
function prune(v: unknown): unknown {
  if (Array.isArray(v)) return v.length ? v : undefined
  if (!isObj(v)) return v
  const out: Record<string, unknown> = {}
  for (const [k, x] of Object.entries(v)) {
    const p = prune(x)
    if (p !== undefined && p !== null) out[k] = p
  }
  return Object.keys(out).length ? out : undefined
}

/** The paths that turn `a` into `b`, for one multi-path update. */
function diff(path: string, a: unknown, b: unknown, out: Record<string, unknown>) {
  if (isObj(a) && isObj(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
      diff(`${path}/${k}`, a[k], b[k], out)
  } else if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) {
    out[path] = b === undefined ? null : clone(b)
  }
}

/** Number siblings 0, 1, 2… in the given order. */
function renumber(rec: Record<string, { order?: number }>, order: string[]) {
  order.forEach((id, i) => {
    if (rec[id] && rec[id].order !== i) rec[id].order = i
  })
}
function insertAt<T extends { order?: number }>(
  rec: Record<string, T>,
  id: string,
  value: T,
  index?: number,
) {
  const order = ordered(rec)
    .map(([k]) => k)
    .filter((k) => k !== id)
  rec[id] = value
  order.splice(index ?? order.length, 0, id)
  renumber(rec, order)
}
function moveWithin(
  rec: Record<string, { order?: number }> | undefined,
  from: number,
  to: number,
) {
  if (!rec) return
  const order = ordered(rec).map(([k]) => k)
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length)
    return
  const [moved] = order.splice(from, 1)
  order.splice(to, 0, moved)
  renumber(rec, order)
}

const pad = (n: number) => String(n).padStart(2, '0')
/** A stored date as YYYY-MM-DD (what date fields take), or '' if it isn't one. */
export function isoDate(value: unknown): string {
  if (value == null || value === '') return ''
  const d = parseDate(value as string | number | Date)
  return Number.isNaN(d.getTime())
    ? ''
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** A day's stored name: everyone (and the old app) sees it, so English, not the organiser's phone language. */
const weekdayName = (iso: string) => parseDate(iso).toLocaleDateString('en', { weekday: 'long' })
function shiftDate(iso: string, days: number) {
  const d = parseDate(iso)
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

/** A short category name: "Primary" → "Pri", "Pre-Premier" → "PP". */
function abbreviate(name: string) {
  // By character, not UTF-16 unit, so an emoji isn't cut in half.
  const words = name.split(/[\s-]+/).filter(Boolean)
  return words.length > 1
    ? words.map((w) => Array.from(w)[0].toUpperCase()).join('')
    : Array.from(name).slice(0, 3).join('')
}

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
  /** Can this age group do this dance? Dances with no groups set take any. */
  function eligible(danceId: string | undefined, groupId: string) {
    const groups = getDance(danceId)?.groupIds
    return !groups || !Object.values(groups).some(Boolean) || !!groups[groupId]
  }

  /** Short label for cells: "Pri 8 & Under". */
  function groupLabel(id: string) {
    const g = m.groupsById.value.get(id)
    if (!g) return 'Unknown age group'
    const cat = g.category?.name?.trim()
    return [cat && abbreviate(cat), g.name?.trim()].filter(Boolean).join(' ') || g.label
  }
  const groupFullLabel = (id: string) =>
    m.groupsById.value.get(id)?.label ?? 'Unknown age group'

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
    const updates: Record<string, unknown> = {}
    diff('schedule', prune(before), prune(after), updates)
    if (!Object.keys(updates).length) return Promise.resolve(null)
    return m.writeData(updates, label).catch((e) => {
      toast(friendlyError(e), { tone: 'error' })
      return null
    })
  }

  /**
   * The next day's name and date: the day after the last (or the
   * competition's first day). Older apps head the schedule with each day's
   * name, so days always have one.
   */
  function nextDay(s: SSchedule): SDay {
    const list = ordered(s.days)
    const start = isoDate(m.competition.value?.date)
    const last = isoDate(list.at(-1)?.[1].date)
    const date = last ? shiftDate(last, 1) : start && shiftDate(start, list.length)
    return date ? { name: weekdayName(date), date } : { name: `Day ${list.length + 1}` }
  }

  // Lookups within the day being edited, in `s` (a draft) or what's saved.
  function dayIn(s: SSchedule, create = false): SDay | undefined {
    // Before the first save, a day made earlier in the same change.
    const id = dayId.value ?? ordered(s.days)[0]?.[0]
    if (id && s.days?.[id]) return s.days[id]
    if (!create) return undefined
    s.days ??= {}
    const newId = m.newKey()
    s.days[newId] = { order: 0, ...nextDay(s) }
    return s.days[newId]
  }
  const blockIn = (s: SSchedule, b: string) => dayIn(s)?.blocks?.[b]
  const eventIn = (s: SSchedule, b: string, e: string) => blockIn(s, b)?.events?.[e]
  const rowIn = (s: SSchedule, b: string, e: string, d: string) =>
    eventIn(s, b, e)?.dances?.[d]
  function cellIn(s: SSchedule, loc: CellLocation, create = false) {
    const row = rowIn(s, loc.blockId, loc.eventId, loc.danceId)
    if (!row) return undefined
    if (!row.platforms?.[loc.platformId]) {
      if (!create) return undefined
      row.platforms ??= {}
      row.platforms[loc.platformId] = {}
    }
    const cell = row.platforms[loc.platformId]
    cell.orderedGroupIds = ids(cell.orderedGroupIds)
    cell.orderedJudgeIds = ids(cell.orderedJudgeIds)
    return cell as Required<Assignment>
  }

  const getBlock = (b: string) => blockIn(src(), b)
  const getEvent = (b: string, e: string) => eventIn(src(), b, e)
  const getRow = (b: string, e: string, d: string) => rowIn(src(), b, e, d)
  const blockLabel = (b: string) => getBlock(b)?.name?.trim() || 'session'
  const eventLabel = (b: string, e: string) => getEvent(b, e)?.name?.trim() || 'event'
  const rowLabel = (row: SDance | undefined) =>
    row?.danceId ? danceName(row.danceId) : row?.name?.trim() || 'row'

  // Age groups and judges in platform cells
  type Kind = 'group' | 'judge'
  const listKey = (kind: Kind) =>
    kind === 'group' ? 'orderedGroupIds' : 'orderedJudgeIds'
  const itemLabel = (kind: Kind, id: string) =>
    kind === 'judge' ? staffName(id) : isSpacerId(id) ? 'a spacer' : groupLabel(id)

  const addToCell = (kind: Kind, loc: CellLocation, id: string, index?: number) =>
    edit(
      `Added ${itemLabel(kind, id)} to ${rowLabel(getRow(loc.blockId, loc.eventId, loc.danceId))}`,
      (s) => {
        const list = cellIn(s, loc, true)?.[listKey(kind)]
        if (!list || list.includes(id)) return
        list.splice(index ?? list.length, 0, id)
      },
    )
  const removeFromCell = (kind: Kind, loc: CellLocation, id: string) =>
    edit(`Removed ${itemLabel(kind, id)}`, (s) => {
      const list = cellIn(s, loc)?.[listKey(kind)]
      const i = list?.indexOf(id) ?? -1
      if (list && i >= 0) list.splice(i, 1)
    })
  const moveBetweenCells = (
    kind: Kind,
    from: CellLocation,
    to: CellLocation,
    id: string,
    index?: number,
  ) =>
    edit(`Moved ${itemLabel(kind, id)}`, (s) => {
      const a = cellIn(s, from)?.[listKey(kind)]
      const b = cellIn(s, to, true)?.[listKey(kind)]
      if (!a || !b || b.includes(id)) return
      const i = a.indexOf(id)
      if (i >= 0) a.splice(i, 1)
      b.splice(index ?? b.length, 0, id)
    })
  const reorderInCell = (kind: Kind, loc: CellLocation, from: number, to: number) =>
    edit(kind === 'group' ? 'Reordered age groups' : 'Reordered judges', (s) => {
      const list = cellIn(s, loc)?.[listKey(kind)]
      if (!list || from === to || from >= list.length) return
      const [x] = list.splice(from, 1)
      list.splice(to, 0, x)
    })
  /** Replace a cell's age groups or judges (autofill). */
  function setCell(kind: Kind, loc: CellLocation, list: string[]) {
    return edit(kind === 'group' ? 'Assigned age groups' : 'Assigned judges', (s) => {
      const cell = cellIn(s, loc, list.length > 0)
      if (cell) cell[listKey(kind)] = list
    })
  }

  // Days
  const dayName = (d: string) => {
    const i = days.value.findIndex(([id]) => id === d)
    return i >= 0 ? dayLabel(days.value[i][1], i) : 'day'
  }
  function addDay() {
    const id = m.newKey()
    const day = nextDay(src())
    void edit(`Added ${day.name}`, (s) => {
      s.days ??= {}
      insertAt(s.days, id, day)
    })
    return id
  }
  const renameDay = (d: string, name: string) =>
    edit(`Renamed ${dayName(d)}`, (s) => {
      const x = s.days?.[d]
      if (x) x.name = name
    })
  /** Set a day's date (YYYY-MM-DD, or '' for none). A name that was its weekday follows it. */
  const setDayDate = (d: string, date: string) =>
    edit(`Changed the date of ${dayName(d)}`, (s) => {
      const x = s.days?.[d]
      if (!x) return
      const old = isoDate(x.date)
      const name = x.name?.trim()
      if (date && (!name || (old && (name === weekdayName(old) || name === formatWeekday(old))))) x.name = weekdayName(date)
      if (date) x.date = date
      else delete x.date
    })
  const removeDay = (d: string) =>
    edit(`Deleted ${dayName(d)}`, (s) => {
      delete s.days?.[d]
    })

  // Sessions
  function addBlock(name: string) {
    const id = m.newKey()
    void edit(`Added ${name}`, (s) => {
      const d = dayIn(s, true)!
      d.blocks ??= {}
      insertAt(d.blocks, id, { name })
    })
    return id
  }
  const removeBlock = (b: string) =>
    edit(`Deleted ${blockLabel(b)}`, (s) => {
      delete dayIn(s)?.blocks?.[b]
    })
  const clearDay = () =>
    edit('Cleared the schedule', (s) => {
      const d = dayIn(s)
      if (d) delete d.blocks
    })
  const renameBlock = (b: string, name: string) =>
    edit(`Renamed ${blockLabel(b)}`, (s) => {
      const x = blockIn(s, b)
      if (x) x.name = name
    })
  const describeBlock = (b: string, description: string) =>
    edit(`Changed ${blockLabel(b)}`, (s) => {
      const x = blockIn(s, b)
      if (!x) return
      if (description) x.description = description
      else delete x.description
    })
  const reorderBlock = (from: number, to: number) =>
    edit('Reordered sessions', (s) => moveWithin(dayIn(s)?.blocks, from, to))

  // Events
  function addEvent(b: string, name: string, description?: string) {
    const id = m.newKey()
    void edit(`Added ${name}`, (s) => {
      const x = blockIn(s, b)
      if (!x) return
      x.events ??= {}
      insertAt(x.events, id, description ? { name, description } : { name })
    })
    return id
  }
  const removeEvent = (b: string, e: string) =>
    edit(`Deleted ${eventLabel(b, e)}`, (s) => {
      delete blockIn(s, b)?.events?.[e]
    })
  const renameEvent = (b: string, e: string, name: string) =>
    edit(`Renamed ${eventLabel(b, e)}`, (s) => {
      const x = eventIn(s, b, e)
      if (x) x.name = name
    })
  const describeEvent = (b: string, e: string, description: string) =>
    edit(`Changed ${eventLabel(b, e)}`, (s) => {
      const x = eventIn(s, b, e)
      if (!x) return
      if (description) x.description = description
      else delete x.description
    })
  const reorderEvent = (b: string, from: number, to: number) =>
    edit('Reordered events', (s) => moveWithin(blockIn(s, b)?.events, from, to))

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
      (s) => {
        const x = eventIn(s, b, e)
        if (!x) return
        x.dances ??= {}
        insertAt(
          x.dances,
          id,
          row.danceId ? { danceId: row.danceId } : { name: row.name ?? '' },
          index,
        )
      },
    )
    return id
  }
  const removeRow = (b: string, e: string, d: string) =>
    edit(`Deleted ${rowLabel(getRow(b, e, d))}`, (s) => {
      delete eventIn(s, b, e)?.dances?.[d]
    })
  const setRowText = (
    b: string,
    e: string,
    d: string,
    key: 'name' | 'description',
    value: string,
  ) =>
    edit(`Changed ${rowLabel(getRow(b, e, d))}`, (s) => {
      const x = rowIn(s, b, e, d)
      if (!x) return
      if (value) x[key] = value
      else delete x[key]
    })
  const reorderRow = (b: string, e: string, from: number, to: number) =>
    edit('Reordered dances', (s) => moveWithin(eventIn(s, b, e)?.dances, from, to))
  const moveRow = (from: EventLocation, d: string, to: EventLocation, index?: number) =>
    edit(
      `Moved ${rowLabel(getRow(from.blockId, from.eventId, d))} to ${eventLabel(to.blockId, to.eventId)}`,
      (s) => {
        const a = eventIn(s, from.blockId, from.eventId)
        const b = eventIn(s, to.blockId, to.eventId)
        const row = a?.dances?.[d]
        if (!a?.dances || !row || !b) return
        delete a.dances[d]
        b.dances ??= {}
        insertAt(b.dances, d, row, index)
      },
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
