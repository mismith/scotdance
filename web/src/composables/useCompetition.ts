import {
  computed,
  inject,
  onScopeDispose,
  provide,
  ref,
  watch,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from 'vue'
import { child } from 'firebase/database'
import { dataRef } from '@/firebase'
import { getSaved } from '@/lib/offline'
import {
  fetchDancers,
  fetchResults,
  fetchSchedule,
  fetchStaff,
  watchDancers,
  watchResults,
  watchSchedule,
  watchStaff,
} from '@/lib/competitionData'
import { competitionSpan } from '@/lib/dancerDay'
import { nowMs, today } from '@/lib/now'
import { useMeStore } from '@/stores/me'
import {
  type Category,
  type Competition,
  type DrawsTree,
  type EnrichedDance,
  type EnrichedDancer,
  type EnrichedGroup,
  type Platform,
  type PointsTree,
  type ResultsTree,
  type Schedule,
  type StaffMember,
} from '@/types/competition'
import { days as scheduleDays } from '@/lib/schedule'
import { peekCompetition } from '@/composables/useCompetitions'

interface CompetitionContext {
  competitionId: Ref<string>
  competition: ComputedRef<Competition | null>
  notFound: ComputedRef<boolean>
  /** Listed but not yet published (and not yours): its overview and staff only. */
  restricted: ComputedRef<boolean>
  loading: ComputedRef<boolean>
  error: Ref<Error | null>
  staff: Ref<StaffMember[]>
  loadStaff: () => Promise<void>
  dancers: Ref<EnrichedDancer[]>
  categories: Ref<Category[]>
  groups: Ref<EnrichedGroup[]>
  loadDancers: () => Promise<void>
  dances: Ref<EnrichedDance[]>
  results: Ref<ResultsTree>
  points: Ref<PointsTree>
  loadResults: () => Promise<void>
  /** The organiser hid results (Manage). null until results have loaded. */
  resultsHidden: Ref<boolean | null>
  schedule: Ref<Schedule | null>
  platforms: Ref<Platform[]>
  draws: Ref<DrawsTree>
  loadSchedule: () => Promise<void>
  /** The organiser hid the schedule (Manage). null until the schedule has loaded. */
  scheduleHidden: Ref<boolean | null>
  /** null while unresolved; true if schedule has at least one day; false if missing or admin-disabled. */
  hasSchedule: ComputedRef<boolean | null>
  /** Everything streams live (competition day, any day of it, and the day after). */
  isLive: ComputedRef<boolean>
  /** When the live results last changed, ms. */
  liveResultsAt: Ref<number | null>
}

const competitionKey = Symbol('competition') as InjectionKey<CompetitionContext>

function competitionMetaRef(id: string) {
  return child(dataRef('competitions'), id)
}

export function provideCompetition(competitionId: Ref<string>): CompetitionContext {
  const me = useMeStore()
  const rawCompetition = ref<Competition | null>(null)
  const docExists = ref(false)
  const metaLoading = ref(false)
  const error = ref<Error | null>(null)

  // Organisers see their own competitions before they're published. Whether
  // you're one isn't known until your permissions have loaded, so until then
  // an unpublished competition is still loading, not "not found". A listed
  // one shows everyone its overview and staff; publishing adds the dancers,
  // schedule and results (the rules refuse those reads until then).
  const seesAll = (c: Competition) => me.hasCompetitionPerm(competitionId.value) || c.published === true
  const isVisible = (c: Competition) => seesAll(c) || c.listed === true
  const loading = computed(
    () => metaLoading.value || (!!rawCompetition.value && rawCompetition.value.published !== true && !me.accessKnown),
  )
  const competition = computed<Competition | null>(() => {
    const c = rawCompetition.value
    return c && isVisible(c) ? c : null
  })
  const notFound = computed(() => {
    if (loading.value) return false
    if (!docExists.value) return true
    const c = rawCompetition.value
    return !!c && !isVisible(c)
  })
  const restricted = computed(() => !!competition.value && !seesAll(competition.value))
  const staff = ref<StaffMember[]>([])
  const dancers = ref<EnrichedDancer[]>([])
  const categories = ref<Category[]>([])
  const groups = ref<EnrichedGroup[]>([])
  const dances = ref<EnrichedDance[]>([])
  const results = ref<ResultsTree>({})
  const points = ref<PointsTree>({})
  const resultsHidden = ref<boolean | null>(null)
  const schedule = ref<Schedule | null>(null)
  const scheduleHidden = ref<boolean | null>(null)
  const platforms = ref<Platform[]>([])
  const draws = ref<DrawsTree>({})
  const liveResultsAt = ref<number | null>(null)

  const hasSchedule = computed<boolean | null>(() => {
    if (scheduleHidden.value == null) return null
    if (!schedule.value) return false
    return scheduleDays(schedule.value).length > 0
  })

  // On competition day (every day of it, and the day after for late
  // results) everything streams: results, late entries, a redrawn order, a
  // changed schedule. Otherwise each section is read once.
  const isLive = computed(() => {
    void today.value // re-check at midnight and when the app comes back
    const span = competitionSpan(competition.value?.date, schedule.value)
    return !!span && span.first <= 0 && span.last >= -1
  })

  // A section is loaded the first time a screen asks for it, then kept up
  // to date while the competition is live.
  function section<T>(
    read: (id: string) => Promise<T>,
    stream: (id: string, cb: (value: T) => void, onError: (e: Error) => void) => () => void,
    apply: (value: T, live: boolean) => void,
    /** Only once published (or yours): staff show as soon as it's listed. */
    whenPublished = true,
  ) {
    let wanted = false
    let ready: Promise<void> = Promise.resolve()
    let off: (() => void) | null = null
    const stop = () => {
      off?.()
      off = null
    }
    function start() {
      stop()
      const id = competitionId.value
      const live = isLive.value
      ready = new Promise<void>((resolve) => {
        const fail = (e: Error) => {
          if (id !== competitionId.value) return resolve()
          // Don't keep a failure: the next screen to ask tries again.
          stop()
          wanted = false
          error.value = e
          resolve()
        }
        const got = (value: T) => {
          if (id === competitionId.value) apply(value, live)
          resolve()
        }
        if (live) off = stream(id, got, fail)
        else read(id).then(got, fail)
      })
      return ready
    }
    onScopeDispose(stop)
    return {
      load: () => {
        if (!competitionId.value || (whenPublished && restricted.value)) return Promise.resolve()
        if (!wanted) {
          wanted = true
          return start()
        }
        return ready
      },
      /** Switch between reading once and streaming when the day comes or goes. */
      restart: () => {
        if (wanted) void start()
      },
      reset: () => {
        stop()
        wanted = false
        ready = Promise.resolve()
      },
    }
  }

  const staffSection = section(fetchStaff, watchStaff, (v) => (staff.value = v), false)
  const dancersSection = section(fetchDancers, watchDancers, (b) => {
    dancers.value = b.dancers
    groups.value = b.groups
    categories.value = b.categories
  })
  const resultsSection = section(fetchResults, watchResults, (b, live) => {
    dances.value = b.dances
    results.value = b.results
    points.value = b.points
    resultsHidden.value = b.hidden
    if (live) liveResultsAt.value = nowMs()
  })
  const scheduleSection = section(fetchSchedule, watchSchedule, (b) => {
    schedule.value = b.schedule
    platforms.value = b.platforms
    draws.value = b.draws
    scheduleHidden.value = b.hidden
  })
  const sections = [staffSection, dancersSection, resultsSection, scheduleSection]

  watch(isLive, (live) => {
    if (!live) liveResultsAt.value = null
    for (const s of sections) s.restart()
  })

  async function loadMeta() {
    if (!competitionId.value) return
    const id = competitionId.value
    error.value = null
    for (const s of sections) s.reset()
    staff.value = []
    dancers.value = []
    categories.value = []
    groups.value = []
    dances.value = []
    results.value = {}
    points.value = {}
    resultsHidden.value = null
    schedule.value = null
    scheduleHidden.value = null
    platforms.value = []
    draws.value = {}
    liveResultsAt.value = null

    // Seed from the list cache so Info.vue can render its header on the
    // first frame (no skeleton phase → no DOM swap → view transitions from
    // the list don't get skipped by a duplicate `view-transition-name`).
    const seed = peekCompetition(id)
    if (seed) {
      rawCompetition.value = seed
      docExists.value = true
      metaLoading.value = false
    } else {
      rawCompetition.value = null
      docExists.value = false
      metaLoading.value = true
    }

    try {
      const snap = await getSaved(competitionMetaRef(id))
      if (id !== competitionId.value) return
      const value = snap.val() as Competition | null
      if (value && typeof value === 'object') {
        docExists.value = true
        rawCompetition.value = value
      } else {
        docExists.value = false
        rawCompetition.value = null
      }
    } catch (e) {
      if (id === competitionId.value) error.value = e as Error
    } finally {
      if (id === competitionId.value) metaLoading.value = false
    }
  }

  watch(competitionId, loadMeta, { immediate: true })

  const ctx: CompetitionContext = {
    competitionId,
    competition,
    notFound,
    restricted,
    loading,
    error,
    staff,
    loadStaff: staffSection.load,
    dancers,
    categories,
    groups,
    loadDancers: dancersSection.load,
    dances,
    results,
    points,
    loadResults: resultsSection.load,
    resultsHidden,
    schedule,
    platforms,
    draws,
    loadSchedule: scheduleSection.load,
    scheduleHidden,
    hasSchedule,
    isLive,
    liveResultsAt,
  }

  provide(competitionKey, ctx)
  return ctx
}

export function useCompetition(): CompetitionContext {
  const ctx = inject(competitionKey)
  if (!ctx) {
    throw new Error(
      'useCompetition() must be called inside a route under /competitions/:competitionId',
    )
  }
  return ctx
}
