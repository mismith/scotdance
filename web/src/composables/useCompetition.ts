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
import { fetchDancers, fetchResults, fetchSchedule, fetchStaff, subscribeResults } from '@/lib/competitionData'
import { daysFromToday } from '@/lib/format'
import { nowMs } from '@/lib/now'
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
  loading: Ref<boolean>
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
  schedule: Ref<Schedule | null>
  platforms: Ref<Platform[]>
  draws: Ref<DrawsTree>
  loadSchedule: () => Promise<void>
  /** null while unresolved; true if schedule has at least one day; false if missing or admin-disabled. */
  hasSchedule: ComputedRef<boolean | null>
  /** Results stream live (competition is today). */
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
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const isVisible = (c: Competition) => me.isAdmin || c.published === true
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
  const staff = ref<StaffMember[]>([])
  const dancers = ref<EnrichedDancer[]>([])
  const categories = ref<Category[]>([])
  const groups = ref<EnrichedGroup[]>([])
  const dances = ref<EnrichedDance[]>([])
  const results = ref<ResultsTree>({})
  const points = ref<PointsTree>({})
  const schedule = ref<Schedule | null>(null)
  const scheduleResolved = ref(false)
  const platforms = ref<Platform[]>([])
  const draws = ref<DrawsTree>({})

  let staffLoaded = false
  let dancersLoaded = false
  let resultsLoaded = false
  let scheduleLoaded = false

  const hasSchedule = computed<boolean | null>(() => {
    if (!scheduleResolved.value) return null
    if (!schedule.value) return false
    return scheduleDays(schedule.value).length > 0
  })

  async function loadMeta() {
    if (!competitionId.value) return
    const id = competitionId.value
    error.value = null
    staff.value = []
    staffLoaded = false
    dancers.value = []
    categories.value = []
    groups.value = []
    dancersLoaded = false
    dances.value = []
    results.value = {}
    points.value = {}
    resultsLoaded = false
    schedule.value = null
    scheduleResolved.value = false
    platforms.value = []
    scheduleLoaded = false

    // Seed from the list cache so Info.vue can render its header on the
    // first frame (no skeleton phase → no DOM swap → view transitions from
    // the list don't get skipped by a duplicate `view-transition-name`).
    const seed = peekCompetition(id)
    if (seed) {
      rawCompetition.value = seed
      docExists.value = true
      loading.value = false
    } else {
      rawCompetition.value = null
      docExists.value = false
      loading.value = true
    }

    try {
      const snap = await getSaved(competitionMetaRef(id))
      const value = snap.val() as Competition | null
      if (value && typeof value === 'object') {
        docExists.value = true
        rawCompetition.value = value
      } else {
        docExists.value = false
        rawCompetition.value = null
      }
    } catch (e) {
      error.value = e as Error
    } finally {
      loading.value = false
    }
  }

  async function loadStaff() {
    if (staffLoaded || !competitionId.value) return
    try {
      staff.value = await fetchStaff(competitionId.value)
      staffLoaded = true
    } catch (e) {
      error.value = e as Error
    }
  }

  async function loadDancers() {
    if (dancersLoaded || !competitionId.value) return
    const id = competitionId.value
    try {
      const bundle = await fetchDancers(id)
      if (id !== competitionId.value) return
      dancers.value = bundle.dancers
      groups.value = bundle.groups
      categories.value = bundle.categories
      dancersLoaded = true
    } catch (e) {
      error.value = e as Error
    }
  }

  async function loadResults() {
    if (resultsLoaded || !competitionId.value) return
    const id = competitionId.value
    try {
      const bundle = await fetchResults(id)
      if (id !== competitionId.value) return
      dances.value = bundle.dances
      // A live subscription may already have delivered newer trees.
      if (!liveResultsAt.value) {
        results.value = bundle.results
        points.value = bundle.points
      }
      resultsLoaded = true
    } catch (e) {
      error.value = e as Error
    }
  }

  async function loadSchedule() {
    if (scheduleLoaded || !competitionId.value) return
    const id = competitionId.value
    try {
      const bundle = await fetchSchedule(id)
      if (id !== competitionId.value) return
      schedule.value = bundle.schedule
      scheduleResolved.value = true
      platforms.value = bundle.platforms
      draws.value = bundle.draws
      scheduleLoaded = true
    } catch (e) {
      error.value = e as Error
    }
  }

  // On competition day (and the day either side, for late entry), results
  // stream in live instead of being read once.
  const isLive = computed(() => {
    const d = competition.value?.date
    if (d == null) return false
    const diff = daysFromToday(d)
    return diff != null && diff >= -1 && diff <= 0
  })
  const liveResultsAt = ref<number | null>(null)
  let stopLive: (() => void) | null = null
  watch(
    [competitionId, isLive],
    ([id, live]) => {
      stopLive?.()
      stopLive = null
      liveResultsAt.value = null
      if (!id || !live) return
      stopLive = subscribeResults(id, (bundle) => {
        if (id !== competitionId.value) return
        results.value = bundle.results
        points.value = bundle.points
        liveResultsAt.value = nowMs()
      })
    },
    { immediate: true },
  )
  onScopeDispose(() => stopLive?.())

  watch(competitionId, loadMeta, { immediate: true })

  const ctx: CompetitionContext = {
    competitionId,
    competition,
    notFound,
    loading,
    error,
    staff,
    loadStaff,
    dancers,
    categories,
    groups,
    loadDancers,
    dances,
    results,
    points,
    loadResults,
    schedule,
    platforms,
    draws,
    loadSchedule,
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
