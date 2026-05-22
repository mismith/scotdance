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
import { useRecentDancers } from '@/composables/useRecentDancers'
import { insertEntityAggregate } from '@/composables/useEntityAggregates'
import type { Competition } from '@/types/competition'

// ─── Aggregate-backed dancer profile ─────────────────────────────────────────
// Replaces the v1 slug-based composable (which re-ran Typesense searches on
// every page load) with a single read of `/dancers/{dancerId}`. The route
// param `:dancerId` is now the Firebase push key of the aggregate, not a
// name slug — see ADR-0003 §13.

export interface DancerAppearanceRaw {
  competitionId?: string
  /** Per-comp dancer record id (push key under competitions:data/.../dancers). */
  dancerId?: string
  firstName?: string | null
  lastName?: string | null
  image?: string | null
  location?: string | null
  number?: number | null
}

export interface DancerAggregate {
  name?: string
  appearanceCount?: number
  appearances?: Record<string, DancerAppearanceRaw>
}

export interface DancerAppearance {
  /** {compId}:{perCompDancerId} */
  key: string
  raw: DancerAppearanceRaw
  competition: Competition | null
}

export interface UseDancerProfile {
  loading: Ref<boolean>
  notFound: Ref<boolean>
  displayName: Ref<string>
  image: Ref<string | null>
  location: Ref<string | null>
  appearances: Ref<DancerAppearance[]>
  upcoming: Ref<DancerAppearance[]>
  past: Ref<DancerAppearance[]>
  totalComps: Ref<number>
  compsThisYear: Ref<number>
  firstSeen: Ref<DancerAppearance | null>
  firstSeenDate: Ref<Date | null>
  lastSeen: Ref<DancerAppearance | null>
  lastSeenDate: Ref<Date | null>
  venueCount: Ref<number>
}

const KEY: InjectionKey<UseDancerProfile> = Symbol('dancerProfile')

export function provideDancerProfile(dancerId: Ref<string>): UseDancerProfile {
  const profile = createDancerProfile(dancerId)
  provide(KEY, profile)
  return profile
}

export function useDancerProfile(): UseDancerProfile {
  const injected = inject(KEY, null)
  if (!injected) throw new Error('useDancerProfile() called outside DancerLayout')
  return injected
}

function createDancerProfile(dancerId: Ref<string>): UseDancerProfile {
  const recent = useRecentDancers()
  const loading = ref(false)
  const notFound = ref(false)
  const aggregate = ref<DancerAggregate | null>(null)
  const compMeta = ref<Record<string, Competition | null>>({})

  watch(
    dancerId,
    async (id) => {
      if (!id) {
        aggregate.value = null
        notFound.value = false
        return
      }
      loading.value = true
      notFound.value = false
      try {
        const snap = await get(child(dataRef('dancers'), id))
        const value = snap.val()
        if (value && typeof value === 'object') {
          const agg = value as DancerAggregate
          aggregate.value = agg
          insertEntityAggregate('dancers', id, agg)
          // Record into recentDancers eagerly so back-nav to /dancers has the
          // row in place for the view-transition. The deferred watcher below
          // also calls this on later displayName changes; calling sync here
          // covers the back-before-displayName-settles case.
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

  const appearances = computed<DancerAppearance[]>(() =>
    buildAppearances(aggregate.value?.appearances, compMeta.value),
  )
  const upcoming = computed(() => filterUpcoming(appearances.value))
  const past = computed(() => filterPast(appearances.value))

  const displayName = computed(() => {
    const apps = appearances.value
    const fn = latestNonNull(apps, (a) => a.raw.firstName) ?? ''
    const ln = latestNonNull(apps, (a) => a.raw.lastName) ?? ''
    const composed = `${fn} ${ln}`.trim()
    return composed || aggregate.value?.name?.trim() || 'Dancer'
  })

  const image = computed(() => latestNonNull(appearances.value, (a) => a.raw.image))
  const location = computed(() => latestNonNull(appearances.value, (a) => a.raw.location))

  const totalComps = computed(() => countTotalComps(appearances.value))
  const compsThisYear = computed(() => countCompsThisYear(appearances.value))
  const firstSeen = computed(() => findFirstSeen(appearances.value))
  const firstSeenDate = computed(() => appearanceDate(firstSeen.value))
  const lastSeen = computed(() => findLastSeen(appearances.value))
  const lastSeenDate = computed(() => appearanceDate(lastSeen.value))
  const venueCount = computed(() => countUniqueVenues(appearances.value))

  watch(
    [dancerId, displayName, notFound],
    ([id, name, missing]) => {
      if (!id || missing) return
      const trimmed = name?.trim()
      if (!trimmed || trimmed === 'Dancer') return
      recent.record(id, trimmed)
    },
  )

  return {
    loading,
    notFound,
    displayName,
    image,
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
