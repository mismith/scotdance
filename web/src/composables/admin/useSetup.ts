import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { MANAGE_STEPS, type ManageSection } from '@/lib/admin/sections'
import { CALLBACKS, OVERALL, danceState } from '@/lib/admin/results'
import { nextResult } from '@/lib/admin/nextResult'
import { competitionPhase } from '@/lib/dancerDay'
import { danceHasPlaceholder } from '@/lib/results'
import { groupHasOverall, type Platform } from '@/types/competition'

// How far along a competition is, for Manage's Overview and step list: each
// step done or not (and in a few words), the first one still to do with what
// to do about it, what needs fixing, and on the day, where results entry
// carries on.

export interface StepStatus {
  done: boolean
  detail: string
  count?: number
}
export interface Problem {
  id: string
  text: string
  /** Where to fix it (the first one, when there are several). */
  to: RouteLocationRaw
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function useSetup() {
  const m = useManagedCompetition()
  const route = (name: string, params: Record<string, string> = {}) => ({ name, params: { competitionId: m.competitionId.value, ...params } })

  const groupsWithoutDances = computed(() => m.groups.value.filter((g) => !m.groupDances(g.id).length))
  const dancersWithoutGroup = computed(() => m.dancers.value.filter((d) => !d.group))
  const danceIds = (g: (typeof m.groups.value)[number]) => [CALLBACKS, ...m.groupDances(g.id).map((d) => d.id), ...(groupHasOverall(g) ? [OVERALL] : [])]

  // Results with a "?" stand-in (a number missed on the day): touch-ups to do.
  const placeholders = computed(() =>
    m.groups.value.flatMap((g) => danceIds(g).filter((id) => danceHasPlaceholder(m.results.value, m.points.value, g.id, id)).map((danceId) => ({ groupId: g.id, danceId }))),
  )

  const status = computed<Record<string, StepStatus>>(() => {
    const c = m.competition.value
    const groups = m.groups.value
    const withoutDances = groupsWithoutDances.value.length
    const withoutGroup = dancersWithoutGroup.value.length
    let entered = 0
    let total = 0
    for (const g of groups) {
      const ids = danceIds(g)
      total += ids.length
      entered += ids.filter((id) => danceState(m.results.value[g.id]?.[id]) !== 'todo').length
    }
    const judges = m.judges.value.length
    const staff = m.staff.value.length
    return {
      // (The date heads the Overview already.)
      details: {
        done: !!(c?.name && c?.date && (c?.venue || c?.location)),
        detail: c?.date && (c.venue || c.location) ? [c.venue, c.location].filter(Boolean).join(' · ') : 'Add the date and where it is',
      },
      staff: {
        done: judges > 0,
        // Judges are staff too: one count, so it can't read as more people.
        detail: staff ? `${staff} staff` : 'Add the judges',
        count: staff,
      },
      dances: { done: m.dances.value.length > 0, detail: m.dances.value.length ? plural(m.dances.value.length, 'dance', 'dances') : 'Add the dances performed', count: m.dances.value.length },
      categories: {
        done: m.categories.value.length > 0,
        detail: m.categories.value.length ? plural(m.categories.value.length, 'category', 'categories') : 'Or import them with your dancers',
        count: m.categories.value.length,
      },
      groups: {
        done: groups.length > 0 && !withoutDances,
        detail: !groups.length ? 'Or import them with your dancers' : withoutDances ? `${plural(withoutDances, 'age group has', 'age groups have')} no dances yet` : plural(groups.length, 'age group', 'age groups'),
        count: groups.length,
      },
      dancers: {
        done: m.dancers.value.length > 0 && !withoutGroup,
        detail: !m.dancers.value.length ? 'Import from Excel or Google Sheets' : withoutGroup ? `${plural(withoutGroup, 'dancer needs', 'dancers need')} an age group` : plural(m.dancers.value.length, 'dancer', 'dancers'),
        count: m.dancers.value.length,
      },
      platforms: { done: m.platforms.value.length > 0, detail: m.platforms.value.length ? plural(m.platforms.value.length, 'platform', 'platforms') : 'Where dancing happens', count: m.platforms.value.length },
      schedule: { done: !!m.schedule.value || m.scheduleHidden.value, detail: m.scheduleHidden.value ? 'Hidden' : m.schedule.value ? 'Started' : 'Optional' },
      results: {
        done: m.resultsHidden.value || (total > 0 && entered === total && !placeholders.value.length),
        detail: m.resultsHidden.value ? 'Hidden' : total ? `${entered} of ${total} entered` : 'On the day',
      },
    }
  })

  /** Results needing a touch-up (not counted once the tab is hidden). */
  const toFix = computed(() => (m.resultsHidden.value ? 0 : placeholders.value.length))

  const next = computed<ManageSection | null>(() => MANAGE_STEPS.find((s) => !status.value[s.id]?.done) ?? null)

  /** What to do about a step that isn't done: the button that does it. */
  function action(id: string): { label: string; to: RouteLocationRaw } {
    const importDancers = { label: 'Import dancers', to: route('manage.dancers.import') }
    switch (id) {
      case 'details':
        return { label: 'Add the details', to: route('manage.details') }
      case 'staff':
        return { label: 'Add a judge', to: route('manage.staff', { itemId: 'new' }) }
      case 'dances':
        return { label: 'Add dances', to: route('manage.dances') }
      case 'categories':
        return importDancers
      case 'groups': {
        const first = groupsWithoutDances.value[0]
        return m.groups.value.length && first ? { label: 'Choose their dances', to: route('manage.groups', { itemId: first.id }) } : importDancers
      }
      case 'dancers': {
        const first = dancersWithoutGroup.value[0]
        return m.dancers.value.length && first ? { label: 'Give them an age group', to: route('manage.dancers', { itemId: first.id }) } : importDancers
      }
      case 'platforms':
        return { label: 'Add platforms', to: route('manage.platforms') }
      case 'schedule':
        return { label: 'Build the schedule', to: route('manage.schedule') }
      default:
        return { label: 'Enter results', to: (today.value && carryOn.value?.to) || route('manage.results') }
    }
  }

  const problems = computed<Problem[]>(() => {
    const out: Problem[] = []
    const withoutGroup = dancersWithoutGroup.value
    if (withoutGroup.length) {
      out.push({ id: 'dancers', text: `${plural(withoutGroup.length, 'dancer needs', 'dancers need')} an age group`, to: route('manage.dancers', { itemId: withoutGroup[0].id }) })
    }
    const withoutDances = groupsWithoutDances.value
    if (withoutDances.length) {
      out.push({ id: 'groups', text: `${plural(withoutDances.length, 'age group has', 'age groups have')} no dances`, to: route('manage.groups', { itemId: withoutDances[0].id }) })
    }
    const fixes = placeholders.value
    if (toFix.value) {
      const [{ groupId, danceId }] = fixes
      out.push({
        id: 'results',
        text: `${plural(fixes.length, 'result has', 'results have')} a “?” for a missed number`,
        to: route('manage.results', danceId === CALLBACKS ? { groupId } : { groupId, danceId }),
      })
    }
    return out
  })

  // --- Competition day
  const today = computed(() => !m.resultsHidden.value && competitionPhase(m.competition.value?.date, m.schedule.value) === 'today')
  /** Where results entry carries on, by name, and the way there. */
  const carryOn = computed(() => {
    const slot = nextResult({
      groups: m.groups.value,
      dancesOf: m.groupDances,
      results: m.results.value,
      schedule: m.schedule.value,
      platforms: m.platforms.value as Platform[],
    })
    if (!slot) return null
    const group = m.groupsById.value.get(slot.groupId)
    const dance = m.dancesById.value.get(slot.danceId)
    const what = slot.danceId === CALLBACKS ? 'Callbacks' : slot.danceId === OVERALL ? 'Overall' : (dance?.name?.trim() || dance?.label)
    return {
      label: [group?.label, what].filter(Boolean).join(' · '),
      to: route('manage.results', slot.danceId === CALLBACKS ? { groupId: slot.groupId } : { groupId: slot.groupId, danceId: slot.danceId }),
    }
  })

  return { status, next, action, problems, toFix, today, carryOn }
}
