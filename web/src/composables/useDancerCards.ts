import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { child } from 'firebase/database'
import { dataRef } from '@/firebase'
import { getSaved, onReconnect } from '@/lib/offline'
import { fetchCompetitionMeta } from '@/lib/competitionMeta'
import { ensureCompetitionsList, peekCompetition } from '@/composables/useCompetitions'
import {
  fetchEntries,
  fetchResults,
  fetchSchedule,
  watchEntries,
  watchResults,
  watchSchedule,
  type DancersBundle,
  type ResultsBundle,
  type ScheduleBundle,
} from '@/lib/competitionData'
import { competitionPhase, competitionSpan, dancerDay, type DancerDay, type Phase } from '@/lib/dancerDay'
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
  /** Calendar days to its first day (1 = tomorrow); null without a date. */
  daysAway: number | null
  /** Which day of a multi-day competition today is, while it's on. */
  dayOf: { n: number; of: number } | null
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
  /** Each followed person's own entries there (with the groups), by profile id. */
  entries: Record<string, DancersBundle>
  results: ResultsBundle
  schedule: ScheduleBundle
}

/**
 * What one competition's cards need, streaming: the followed people's own
 * entries, the results and the schedule. Calls back once all have arrived,
 * then on every change, saying whether results changed.
 */
function watchBundles(
  cid: string,
  personIds: string[],
  cb: (b: Bundles, resultsChanged: boolean) => void,
  onError: () => void,
) {
  const entries: Record<string, DancersBundle> = {}
  let results: ResultsBundle | undefined
  let schedule: ScheduleBundle | undefined
  let ready = false
  const emit = (resultsChanged = false) => {
    if (personIds.some((p) => !entries[p]) || !results || !schedule) return
    cb({ entries: { ...entries }, results, schedule }, ready && resultsChanged)
    ready = true
  }
  const offs = [
    ...personIds.map((p) => watchEntries(cid, p, (b) => ((entries[p] = b), emit()), onError)),
    watchResults(cid, (b) => ((results = b), emit(true)), onError),
    watchSchedule(cid, (b) => ((schedule = b), emit()), onError),
  ]
  return () => offs.forEach((off) => off())
}

export function useDancerCards(people: Ref<Array<{ id: string; name: string }>>) {
  const me = useMeStore()
  const cards = ref<DancerCard[]>([])
  /** Per competition: its data, or null when it can't be read. */
  const bundles = shallowRef<Record<string, Bundles | null>>({})
  const liveAt = ref<number | null>(null)
  /** Per competition on today: when a result last arrived while watching. */
  const resultsAt = ref<Record<string, number>>({})
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
      // Every competition that could lead a card (on now, coming up, or in
      // the last few months) is in the recent list Home shows anyway, so
      // older ones are only read for someone who hasn't competed lately.
      const recentList = ensureCompetitionsList(false)
      const out: Plan[] = await Promise.all(
        list.map(async ({ id, name }) => {
          const [agg] = await Promise.all([fetchAggregate(id), recentList])
          const apps = Object.values(agg?.appearances ?? {})
          const compIds = [...new Set(apps.map((a) => a.competitionId).filter((x): x is string => !!x))]
          const openable = (metas: Array<Competition | null>) =>
            compIds
              .map((cid, i) => ({ competitionId: cid, competition: metas[i] }))
              .filter((c): c is { competitionId: string; competition: Competition } => !!c.competition)
              .filter((c) => canOpen(c.competitionId, c.competition))
          const recent = openable(compIds.map((c) => peekCompetition(c)))
          const comps = recent.length ? recent : openable(await Promise.all(compIds.map((c) => fetchCompetitionMeta(c))))
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
          const displayName =
            [apps.at(-1)?.firstName, apps.at(-1)?.lastName].filter(Boolean).join(' ') || agg?.name || name
          return {
            id,
            name: displayName,
            focusId: focus?.competitionId ?? null,
            focusComp: focus?.competition ?? null,
            phase: focus ? phaseOf.get(focus.competitionId)! : 'before',
            upcoming: ahead.filter((c) => c.competitionId !== focus?.competitionId),
          }
        }),
      )
      if (token !== run) return
      plans.value = out

      // Today's competitions stream (results, late entries, a redrawn
      // order); the rest are read once. Either way, only the followed
      // people's own entries, not the whole competition's.
      const peopleAt = new Map<string, string[]>()
      for (const p of out) if (p.focusId) peopleAt.set(p.focusId, [...new Set([...(peopleAt.get(p.focusId) ?? []), p.id])])
      // One stream per competition and who's followed there.
      const live = new Map(
        out
          .filter((p) => p.phase === 'today' && p.focusId)
          .map((p) => [`${p.focusId}|${peopleAt.get(p.focusId!)!.join(',')}`, p.focusId!]),
      )
      for (const [key, off] of liveOff) {
        if (!live.has(key)) {
          off()
          liveOff.delete(key)
        }
      }
      for (const [key, cid] of live) {
        if (liveOff.has(key)) continue
        liveOff.set(
          key,
          watchBundles(
            cid,
            peopleAt.get(cid)!,
            (b, resultsChanged) => {
              setBundle(cid, b)
              liveAt.value = Date.now()
              if (resultsChanged) resultsAt.value = { ...resultsAt.value, [cid]: Date.now() }
            },
            () => setBundle(cid, null),
          ),
        )
      }
      const liveIds = new Set(live.values())
      const once = [...peopleAt.keys()].filter((cid) => !liveIds.has(cid))
      await Promise.all(
        once.map(async (cid) => {
          try {
            const who = peopleAt.get(cid)!
            const [r, s, mine] = await Promise.all([
              fetchResults(cid),
              fetchSchedule(cid),
              Promise.all(who.map((p) => fetchEntries(cid, p))),
            ])
            const entries = Object.fromEntries(who.map((p, i) => [p, mine[i]!]))
            if (token === run) setBundle(cid, { entries, results: r, schedule: s })
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
      // Undefined while loading; null when it can't be read.
      const mine = b === null ? null : b?.entries[p.id]
      let focus: FocusCompetition | null = null
      if (p.focusId && p.focusComp) {
        const entries = mine?.dancers ?? []
        const dayBundle = b && mine && {
          dances: b.results.dances,
          results: b.results.results,
          points: b.results.points,
          schedule: b.schedule.schedule,
          platforms: b.schedule.platforms,
          draws: b.schedule.draws,
          groups: mine.groups,
        }
        const span = competitionSpan(p.focusComp.date, b?.schedule.schedule)
        focus = {
          competitionId: p.focusId,
          competition: p.focusComp,
          phase: p.phase,
          daysAway: span?.first ?? null,
          dayOf:
            p.phase === 'today' && span && span.last > span.first
              ? { n: 1 - span.first, of: span.last - span.first + 1 }
              : null,
          days: dayBundle ? entries.map((d) => dancerDay(d, dayBundle, p.phase)) : [],
        }
      }
      return {
        id: p.id,
        name: p.name,
        focus,
        upcoming: p.upcoming,
        loading: !!p.focusId && mine === undefined,
      }
    }),
  )

  watch(result, (r) => (cards.value = r), { immediate: true })

  return { cards, loading, liveAt, resultsAt }
}
