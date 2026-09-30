import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { child, get } from 'firebase/database'
import { dataRef } from '@/firebase'
import { fetchCompetitionMeta } from '@/lib/competitionMeta'
import {
  fetchDancers,
  fetchResults,
  fetchSchedule,
  subscribeResults,
  type DancersBundle,
  type ResultsBundle,
  type ScheduleBundle,
} from '@/lib/competitionData'
import { competitionPhase, dancerDay, type DancerDay, type Phase } from '@/lib/dancerDay'
import { parseDate } from '@/lib/format'
import type { DancerAggregate } from '@/composables/useDancerProfile'
import type { Competition } from '@/types/competition'

// Home's data: for each person (aggregate dancer id), pick the competition
// that matters right now and work out their day there.
//
//   today     a competition they're entered in is on today
//   upcoming  otherwise the soonest one ahead
//   recent    otherwise the most recent one
//
// Their competitor number comes from THAT competition's entry; it changes
// from competition to competition.

export interface FocusCompetition {
  competitionId: string
  competition: Competition
  phase: Phase
  days: DancerDay[]
}

export interface DancerCard {
  id: string
  name: string
  focus: FocusCompetition | null
  /** Upcoming competitions they're entered in, soonest first (excluding focus). */
  upcoming: Array<{ competitionId: string; competition: Competition }>
  loading: boolean
}

const aggCache = new Map<string, Promise<DancerAggregate | null>>()
export function fetchAggregate(id: string) {
  let p = aggCache.get(id)
  if (!p) {
    p = get(child(dataRef('dancers'), id))
      .then((s) => (s.val() && typeof s.val() === 'object' ? (s.val() as DancerAggregate) : null))
      .catch(() => null)
    aggCache.set(id, p)
  }
  return p
}

const dateMs = (c: Competition | null) => (c?.date ? parseDate(c.date).getTime() : 0)

interface Bundles {
  dancers: DancersBundle
  results: ResultsBundle
  schedule: ScheduleBundle
}

export function useDancerCards(people: Ref<Array<{ id: string; name: string }>>) {
  const cards = ref<DancerCard[]>([])
  const bundles = shallowRef<Record<string, Bundles>>({})
  const liveResults = shallowRef<Record<string, Pick<ResultsBundle, 'results' | 'points'>>>({})
  const liveAt = ref<number | null>(null)
  const loading = ref(false)
  const liveOff = new Map<string, () => void>()

  // Per person: which competition + which per-competition entries.
  interface Plan {
    id: string
    name: string
    focusId: string | null
    focusComp: Competition | null
    phase: Phase
    entryIds: string[]
    upcoming: Array<{ competitionId: string; competition: Competition }>
  }
  const plans = ref<Plan[]>([])

  let run = 0
  watch(
    () => people.value.map((p) => p.id).join(','),
    async () => {
      const token = ++run
      const list = people.value
      loading.value = list.length > 0
      const out: Plan[] = await Promise.all(
        list.map(async ({ id, name }) => {
          const agg = await fetchAggregate(id)
          const apps = Object.values(agg?.appearances ?? {})
          const compIds = [...new Set(apps.map((a) => a.competitionId).filter((x): x is string => !!x))]
          const metas = await Promise.all(compIds.map((c) => fetchCompetitionMeta(c)))
          const comps = compIds
            .map((cid, i) => ({ competitionId: cid, competition: metas[i] }))
            .filter((c): c is { competitionId: string; competition: Competition } => !!c.competition)
          const today = comps.filter((c) => competitionPhase(c.competition.date) === 'today')
          const ahead = comps
            .filter((c) => competitionPhase(c.competition.date) === 'before')
            .sort((a, b) => dateMs(a.competition) - dateMs(b.competition))
          const behind = comps
            .filter((c) => competitionPhase(c.competition.date) === 'after')
            .sort((a, b) => dateMs(b.competition) - dateMs(a.competition))
          const focus = today[0] ?? ahead[0] ?? behind[0] ?? null
          const entryIds = focus
            ? apps.filter((a) => a.competitionId === focus.competitionId && a.dancerId).map((a) => a.dancerId!)
            : []
          const displayName =
            [apps.at(-1)?.firstName, apps.at(-1)?.lastName].filter(Boolean).join(' ') || agg?.name || name
          return {
            id,
            name: displayName,
            focusId: focus?.competitionId ?? null,
            focusComp: focus?.competition ?? null,
            phase: competitionPhase(focus?.competition.date),
            entryIds: [...new Set(entryIds)],
            upcoming: ahead.filter((c) => c.competitionId !== focus?.competitionId),
          }
        }),
      )
      if (token !== run) return
      plans.value = out

      const needed = [...new Set(out.map((p) => p.focusId).filter((x): x is string => !!x))]
      const loaded = await Promise.all(
        needed.map(async (cid) => {
          try {
            const [d, r, s] = await Promise.all([fetchDancers(cid), fetchResults(cid), fetchSchedule(cid)])
            return [cid, { dancers: d, results: r, schedule: s }] as const
          } catch {
            return null
          }
        }),
      )
      if (token !== run) return
      bundles.value = Object.fromEntries(loaded.filter((x): x is NonNullable<typeof x> => !!x))

      // Live results for anything on today.
      const liveIds = new Set(out.filter((p) => p.phase === 'today' && p.focusId).map((p) => p.focusId!))
      for (const [cid, off] of liveOff) {
        if (!liveIds.has(cid)) {
          off()
          liveOff.delete(cid)
        }
      }
      for (const cid of liveIds) {
        if (liveOff.has(cid)) continue
        liveOff.set(
          cid,
          subscribeResults(cid, (bundle) => {
            liveResults.value = { ...liveResults.value, [cid]: bundle }
            liveAt.value = Date.now()
          }),
        )
      }
      loading.value = false
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    for (const off of liveOff.values()) off()
    liveOff.clear()
  })

  const result = computed<DancerCard[]>(() =>
    plans.value.map((p) => {
      const b = p.focusId ? bundles.value[p.focusId] : undefined
      let focus: FocusCompetition | null = null
      if (p.focusId && p.focusComp && b) {
        const live = liveResults.value[p.focusId]
        const dayBundle = {
          dances: b.results.dances,
          results: live?.results ?? b.results.results,
          points: live?.points ?? b.results.points,
          schedule: b.schedule.schedule,
          platforms: b.schedule.platforms,
          draws: b.schedule.draws,
        }
        const entries = b.dancers.dancers.filter(
          (d) => p.entryIds.includes(d.id) || d.dancerId === p.id,
        )
        focus = {
          competitionId: p.focusId,
          competition: p.focusComp,
          phase: p.phase,
          days: entries.map((d) => dancerDay(d, dayBundle, p.phase)),
        }
      }
      return {
        id: p.id,
        name: p.name,
        focus,
        upcoming: p.upcoming,
        loading: !!p.focusId && !b,
      }
    }),
  )

  watch(result, (r) => (cards.value = r), { immediate: true })

  return { cards, loading, liveAt }
}
