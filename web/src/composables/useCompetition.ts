import {
  computed,
  inject,
  provide,
  ref,
  watch,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from 'vue'
import { get, child, ref as dbRefFn } from 'firebase/database'
import { database, dataRef } from '@/firebase'
import { useMeStore } from '@/stores/me'
import {
  danceFullName,
  dancerFullName,
  groupFullName,
  type Category,
  type Competition,
  type Dance,
  type Dancer,
  type EnrichedDance,
  type EnrichedDancer,
  type EnrichedGroup,
  type Group,
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
  loadSchedule: () => Promise<void>
  /** null while unresolved; true if schedule has at least one day; false if missing or admin-disabled. */
  hasSchedule: ComputedRef<boolean | null>
}

const competitionKey = Symbol('competition') as InjectionKey<CompetitionContext>

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

function competitionMetaRef(id: string) {
  return child(dataRef('competitions'), id)
}

function competitionDataPath(id: string, section: string) {
  return `${NAMESPACE}/competitions:data/${id}/${section}`
}

function competitionStaffRef(id: string) {
  return dbRefFn(database, competitionDataPath(id, 'staff'))
}

function competitionSectionRef(
  id: string,
  section:
    | 'dancers'
    | 'groups'
    | 'categories'
    | 'dances'
    | 'results'
    | 'points'
    | 'schedule'
    | 'platforms',
) {
  return dbRefFn(database, competitionDataPath(id, section))
}

function snapshotToArray<T extends { id: string }>(
  value: Record<string, Omit<T, 'id'>> | null,
): T[] {
  if (!value) return []
  return Object.entries(value).map(([id, v]) => ({ id, ...v }) as T)
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
      const snap = await get(competitionMetaRef(id))
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
      const snap = await get(competitionStaffRef(competitionId.value))
      staff.value = snapshotToArray<StaffMember>(snap.val()).sort(
        (a, b) => (a._order ?? 0) - (b._order ?? 0),
      )
      staffLoaded = true
    } catch (e) {
      error.value = e as Error
    }
  }

  async function loadDancers() {
    if (dancersLoaded || !competitionId.value) return
    const id = competitionId.value
    try {
      const [dancersSnap, groupsSnap, categoriesSnap] = await Promise.all([
        get(competitionSectionRef(id, 'dancers')),
        get(competitionSectionRef(id, 'groups')),
        get(competitionSectionRef(id, 'categories')),
      ])

      const rawDancers = snapshotToArray<Dancer>(dancersSnap.val())
      const rawGroups = snapshotToArray<Group>(groupsSnap.val())
      const rawCategories = snapshotToArray<Category>(categoriesSnap.val())

      const categoriesById = new Map(rawCategories.map((c) => [c.id, c]))
      const enrichedGroupsById = new Map<string, EnrichedGroup>(
        rawGroups.map((g) => {
          const category = g.categoryId ? categoriesById.get(g.categoryId) : undefined
          return [g.id, { ...g, category, fullName: groupFullName(g, category) }]
        }),
      )

      categories.value = [...rawCategories].sort(
        (a, b) => (a._order ?? 0) - (b._order ?? 0),
      )
      groups.value = [...enrichedGroupsById.values()].sort(
        (a, b) => (a._order ?? 0) - (b._order ?? 0),
      )

      dancers.value = rawDancers
        .filter((d) => d.firstName || d.lastName)
        .map<EnrichedDancer>((d) => ({
          ...d,
          fullName: dancerFullName(d),
          group: d.groupId ? enrichedGroupsById.get(d.groupId) : undefined,
        }))

      dancersLoaded = true
    } catch (e) {
      error.value = e as Error
    }
  }

  async function loadResults() {
    if (resultsLoaded || !competitionId.value) return
    const id = competitionId.value
    try {
      const [dancesSnap, resultsSnap, pointsSnap] = await Promise.all([
        get(competitionSectionRef(id, 'dances')),
        get(competitionSectionRef(id, 'results')),
        get(competitionSectionRef(id, 'points')),
      ])

      const rawDances = snapshotToArray<Dance>(dancesSnap.val())
      dances.value = rawDances
        .map<EnrichedDance>((d) => ({ ...d, fullName: danceFullName(d) }))
        .sort((a, b) => (a._order ?? 0) - (b._order ?? 0))

      results.value = (resultsSnap.val() as ResultsTree | null) ?? {}
      points.value = (pointsSnap.val() as PointsTree | null) ?? {}

      resultsLoaded = true
    } catch (e) {
      error.value = e as Error
    }
  }

  async function loadSchedule() {
    if (scheduleLoaded || !competitionId.value) return
    const id = competitionId.value
    try {
      const [scheduleSnap, platformsSnap] = await Promise.all([
        get(competitionSectionRef(id, 'schedule')),
        get(competitionSectionRef(id, 'platforms')),
      ])
      // RTDB stores `false` for admin-disabled sections and `null` for never-created.
      // Both render as "no schedule" downstream.
      const sval = scheduleSnap.val()
      schedule.value = sval && typeof sval === 'object' ? (sval as Schedule) : null
      scheduleResolved.value = true
      platforms.value = snapshotToArray<Platform>(platformsSnap.val()).sort(
        (a, b) => (a._order ?? 0) - (b._order ?? 0),
      )
      scheduleLoaded = true
    } catch (e) {
      error.value = e as Error
    }
  }

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
    loadSchedule,
    hasSchedule,
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
