import {
  computed,
  inject,
  provide,
  ref,
  watch,
  type InjectionKey,
  type Ref,
} from 'vue'
import { child, get } from 'firebase/database'
import { dataRef } from '@/firebase'
import { fetchCompetitionMeta } from '@/lib/competitionMeta'
import {
  appearanceDate,
  buildAppearances,
  countCompsThisYear,
  countTotalComps,
  countUniqueVenues,
  filterPast,
  filterUpcoming,
  findFirstSeen,
  findLastSeen,
  latestNonNull,
} from '@/lib/appearanceStats'
import { insertEntityAggregate } from '@/composables/useEntityAggregates'
import { useRecentEntities } from '@/composables/useRecentEntities'
import type { Competition } from '@/types/competition'

export interface JudgeAppearanceRaw {
  competitionId?: string
  staffId?: string
  firstName?: string | null
  lastName?: string | null
  image?: string | null
  bio?: string | null
  location?: string | null
}

export interface JudgeAggregate {
  name?: string
  appearanceCount?: number
  appearances?: Record<string, JudgeAppearanceRaw>
}

export interface JudgeAppearance {
  key: string
  raw: JudgeAppearanceRaw
  competition: Competition | null
}

export interface UseJudgeProfile {
  loading: Ref<boolean>
  notFound: Ref<boolean>
  displayName: Ref<string>
  image: Ref<string | null>
  bio: Ref<string | null>
  location: Ref<string | null>
  appearances: Ref<JudgeAppearance[]>
  upcoming: Ref<JudgeAppearance[]>
  past: Ref<JudgeAppearance[]>
  totalComps: Ref<number>
  compsThisYear: Ref<number>
  firstSeen: Ref<JudgeAppearance | null>
  firstSeenDate: Ref<Date | null>
  lastSeen: Ref<JudgeAppearance | null>
  lastSeenDate: Ref<Date | null>
  venueCount: Ref<number>
}

const KEY: InjectionKey<UseJudgeProfile> = Symbol('judgeProfile')

export function provideJudgeProfile(judgeId: Ref<string>): UseJudgeProfile {
  const profile = createJudgeProfile(judgeId)
  provide(KEY, profile)
  return profile
}

export function useJudgeProfile(): UseJudgeProfile {
  const injected = inject(KEY, null)
  if (!injected) throw new Error('useJudgeProfile() called outside JudgeLayout')
  return injected
}

function createJudgeProfile(judgeId: Ref<string>): UseJudgeProfile {
  const recent = useRecentEntities('judges')
  const loading = ref(false)
  const notFound = ref(false)
  const aggregate = ref<JudgeAggregate | null>(null)
  const compMeta = ref<Record<string, Competition | null>>({})

  watch(
    judgeId,
    async (id) => {
      if (!id) {
        aggregate.value = null
        notFound.value = false
        return
      }
      loading.value = true
      notFound.value = false
      try {
        const snap = await get(child(dataRef('judges'), id))
        const value = snap.val()
        if (value && typeof value === 'object') {
          const agg = value as JudgeAggregate
          aggregate.value = agg
          // Seed the /judges list cache with this row so back-nav from the
          // detail page has a real row in the DOM for the view-transition
          // morph to land on (without paying for a full list fetch).
          insertEntityAggregate('judges', id, agg)
          const eagerName = agg.name?.trim()
          if (eagerName) recent.record(id, eagerName)
        } else {
          aggregate.value = null
          notFound.value = true
        }
      } catch {
        aggregate.value = null
        notFound.value = true
      } finally {
        loading.value = false
      }
    },
    { immediate: true },
  )

  // Fetch comp meta for every appearance (cached by fetchCompetitionMeta).
  watch(
    aggregate,
    async (agg) => {
      const apps = agg?.appearances || {}
      const compIds = Array.from(
        new Set(
          Object.values(apps)
            .map((a) => a.competitionId)
            .filter((id): id is string => !!id),
        ),
      ).filter((id) => !(id in compMeta.value))
      if (!compIds.length) return
      const fetched = await Promise.all(compIds.map((id) => fetchCompetitionMeta(id)))
      const next = { ...compMeta.value }
      compIds.forEach((id, i) => {
        next[id] = fetched[i]
      })
      compMeta.value = next
    },
    { immediate: true },
  )

  const appearances = computed<JudgeAppearance[]>(() =>
    buildAppearances(aggregate.value?.appearances, compMeta.value),
  )
  const upcoming = computed(() => filterUpcoming(appearances.value))
  const past = computed(() => filterPast(appearances.value))

  const displayName = computed(() => {
    const apps = appearances.value
    const fn = latestNonNull(apps, (a) => a.raw.firstName) ?? ''
    const ln = latestNonNull(apps, (a) => a.raw.lastName) ?? ''
    const composed = `${fn} ${ln}`.trim()
    return composed || aggregate.value?.name?.trim() || 'Judge'
  })

  const image = computed(() => latestNonNull(appearances.value, (a) => a.raw.image))
  const bio = computed(() => latestNonNull(appearances.value, (a) => a.raw.bio))
  const location = computed(() => latestNonNull(appearances.value, (a) => a.raw.location))

  const totalComps = computed(() => countTotalComps(appearances.value))
  const compsThisYear = computed(() => countCompsThisYear(appearances.value))

  const firstSeen = computed(() => findFirstSeen(appearances.value))
  const firstSeenDate = computed(() => appearanceDate(firstSeen.value))
  const lastSeen = computed(() => findLastSeen(appearances.value))
  const lastSeenDate = computed(() => appearanceDate(lastSeen.value))
  const venueCount = computed(() => countUniqueVenues(appearances.value))

  return {
    loading,
    notFound,
    displayName,
    image,
    bio,
    location,
    appearances,
    upcoming,
    past,
    totalComps,
    compsThisYear,
    firstSeen,
    firstSeenDate,
    lastSeen,
    lastSeenDate,
    venueCount,
  }
}
