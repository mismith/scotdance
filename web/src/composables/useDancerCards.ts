import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { child } from 'firebase/database'
import { dataRef } from '@/firebase'
import { getSaved, onReconnect } from '@/lib/offline'
import { fetchCompetitionMeta } from '@/lib/competitionMeta'
import {
  fetchDancers,
  fetchResults,
  fetchSchedule,
  watchDancers,
  watchResults,
  watchSchedule,
  type DancersBundle,
  type ResultsBundle,
  type ScheduleBundle,
} from '@/lib/competitionData'
import { competitionPhase, dancerDay, type DancerDay, type Phase } from '@/lib/dancerDay'
import { daysFromToday, parseDate } from '@/lib/format'
import { today } from '@/lib/now'
import { useMeStore } from '@/stores/me'
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
// from competition to competition. Only competitions you can open count:
// published ones, and any you organise.

export interface FocusCompetition {
  competitionId: string
  competition: Competition
  phase: Phase
  /** Empty when the competition's details couldn't be read. */
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
onReconnect(() => aggCache.clear())

export function fetchAggregate(id: string) {
  let p = aggCache.get(id)
  if (!p) {
    p = getSaved(child(dataRef('dancers'), id))
      .then((s) => (s.val() && typeof s.val() === 'object' ? (s.val() as DancerAggregate) : null))
      .catch(() => null)
    aggCache.set(id, p)
  }
  return p
}

const dateMs = (c: Competition | null) => (c?.date ? parseDate(c.date).getTime() : 0)

// A competition that started in the last few days may still be on: its
// schedule says how many days it runs.
const MAX_DAYS = 7

interface Bundles {
  dancers: DancersBundle
  results: ResultsBundle
  schedule: ScheduleBundle
}

/** All three bundles for one competition, streaming; calls back once all have arrived, then on every change. */
function watchBundles(cid: string, cb: (b: Bundles) => void, onError: () => void) {
  const parts: Partial<Bundles> = {}
  const emit = () => {
    if (parts.dancers && parts.results && parts.schedule) cb({ ...(parts as Bundles) })
  }
  const offs = [
    watchDancers(cid, (b) => ((parts.dancers = b), emit()), onError),
    watchResults(cid, (b) => ((parts.results = b), emit()), onError),
    watchSchedule(cid, (b) => ((parts.schedule = b), emit()), onError),
  ]
  return () => offs.forEach((off) => off())
}

export function useDancerCards(people: Ref<Array<{ id: string; name: string }>>) {
  const me = useMeStore()
  const cards = ref<DancerCard[]>([])
  /** Per competition: its data, or null when it can't be read. */
  const bundles = shallowRef<Record<string, Bundles | null>>({})
  const liveAt = ref<number | null>(null)
  const loading = ref(false)
  const liveOff = new Map<string, () => void>()

  const canOpen = (cid: string, c: Competition) => c.published === true || me.hasCompetitionPerm(cid)
  const setBundle = (cid: string, b: Bundles | null) => (bundles.value = { ...bundles.value, [cid]: b })

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
    // Re-plan when your organiser access arrives (your own unpublished
    // competitions count too), and when the day changes.
    () => `${people.value.map((p) => p.id).join(',')}|${me.isAdmin}|${me.managedCompetitionIds.join(',')}|${today.value}`,
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
            .filter((c) => canOpen(c.competitionId, c.competition))
          const phases = await Promise.all(
            comps.map(async ({ competitionId, competition }) => {
              const diff = daysFromToday(competition.date ?? null)
              if (diff == null || diff >= 0 || diff < -MAX_DAYS) return competitionPhase(competition.date)
              const s = await fetchSchedule(competitionId).catch(() => null)
              return competitionPhase(competition.date, s?.schedule)
            }),
          )
          const phaseOf = new Map(comps.map((c, i) => [c.competitionId, phases[i]]))
          const today = comps.filter((c) => phaseOf.get(c.competitionId) === 'today')
          const ahead = comps
            .filter((c) => phaseOf.get(c.competitionId) === 'before')
            .sort((a, b) => dateMs(a.competition) - dateMs(b.competition))
          const behind = comps
            .filter((c) => phaseOf.get(c.competitionId) === 'after')
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
            phase: focus ? phaseOf.get(focus.competitionId)! : 'before',
            entryIds: [...new Set(entryIds)],
            upcoming: ahead.filter((c) => c.competitionId !== focus?.competitionId),
          }
        }),
      )
      if (token !== run) return
      plans.value = out

      // Today's competitions stream (results, late entries, a redrawn
      // order); the rest are read once.
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
          watchBundles(
            cid,
            (b) => {
              setBundle(cid, b)
              liveAt.value = Date.now()
            },
            () => setBundle(cid, null),
          ),
        )
      }
      const once = [...new Set(out.map((p) => p.focusId).filter((x): x is string => !!x && !liveIds.has(x)))]
      await Promise.all(
        once.map(async (cid) => {
          try {
            const [d, r, s] = await Promise.all([fetchDancers(cid), fetchResults(cid), fetchSchedule(cid)])
            if (token === run) setBundle(cid, { dancers: d, results: r, schedule: s })
          } catch {
            // Not readable (or gone): show the competition without the day.
            if (token === run) setBundle(cid, null)
          }
        }),
      )
      if (token === run) loading.value = false
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    // A plan still loading would otherwise start streams after this is gone.
    run++
    for (const off of liveOff.values()) off()
    liveOff.clear()
  })

  const result = computed<DancerCard[]>(() =>
    plans.value.map((p) => {
      const b = p.focusId ? bundles.value[p.focusId] : undefined
      let focus: FocusCompetition | null = null
      if (p.focusId && p.focusComp) {
        const entries = b ? b.dancers.dancers.filter((d) => p.entryIds.includes(d.id) || d.dancerId === p.id) : []
        const dayBundle = b && {
          dances: b.results.dances,
          results: b.results.results,
          points: b.results.points,
          schedule: b.schedule.schedule,
          platforms: b.schedule.platforms,
          draws: b.schedule.draws,
          groups: b.dancers.groups,
        }
        focus = {
          competitionId: p.focusId,
          competition: p.focusComp,
          phase: p.phase,
          days: dayBundle ? entries.map((d) => dancerDay(d, dayBundle, p.phase)) : [],
        }
      }
      return {
        id: p.id,
        name: p.name,
        focus,
        upcoming: p.upcoming,
        loading: !!p.focusId && b === undefined,
      }
    }),
  )

  watch(result, (r) => (cards.value = r), { immediate: true })

  return { cards, loading, liveAt }
}
