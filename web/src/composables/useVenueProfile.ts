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
  filterPast,
  filterUpcoming,
  findFirstSeen,
  findLastSeen,
} from '@/lib/appearanceStats'
import { insertEntityAggregate } from '@/composables/useEntityAggregates'
import { useRecentEntities } from '@/composables/useRecentEntities'
import type { Competition } from '@/types/competition'

export interface VenueAppearanceRaw {
  competitionId?: string
  venue?: string | null
  locality?: string | null
  region?: string | null
  country?: string | null
  lat?: number | null
  lng?: number | null
  address?: string | null
  date?: number | null
}

export interface VenueAggregate {
  name?: string
  locality?: string | null
  region?: string | null
  country?: string | null
  lat?: number | null
  lng?: number | null
  appearanceCount?: number
  appearances?: Record<string, VenueAppearanceRaw>
}

export interface VenueAppearance {
  key: string
  raw: VenueAppearanceRaw
  competition: Competition | null
}

export interface UseVenueProfile {
  loading: Ref<boolean>
  notFound: Ref<boolean>
  name: Ref<string>
  locality: Ref<string | null>
  region: Ref<string | null>
  country: Ref<string | null>
  lat: Ref<number | null>
  lng: Ref<number | null>
  locationLine: Ref<string | null>
  appearances: Ref<VenueAppearance[]>
  upcoming: Ref<VenueAppearance[]>
  past: Ref<VenueAppearance[]>
  totalComps: Ref<number>
  compsThisYear: Ref<number>
  firstSeen: Ref<VenueAppearance | null>
  firstSeenDate: Ref<Date | null>
  lastSeen: Ref<VenueAppearance | null>
  lastSeenDate: Ref<Date | null>
}

const KEY: InjectionKey<UseVenueProfile> = Symbol('venueProfile')

export function provideVenueProfile(venueId: Ref<string>): UseVenueProfile {
  const profile = createVenueProfile(venueId)
  provide(KEY, profile)
  return profile
}

export function useVenueProfile(): UseVenueProfile {
  const injected = inject(KEY, null)
  if (!injected) throw new Error('useVenueProfile() called outside VenueLayout')
  return injected
}

function createVenueProfile(venueId: Ref<string>): UseVenueProfile {
  const recent = useRecentEntities('venues')
  const loading = ref(false)
  const notFound = ref(false)
  const aggregate = ref<VenueAggregate | null>(null)
  const compMeta = ref<Record<string, Competition | null>>({})

  watch(
    venueId,
    async (id) => {
      if (!id) {
        aggregate.value = null
        notFound.value = false
        return
      }
      loading.value = true
      notFound.value = false
      try {
        const snap = await get(child(dataRef('venues'), id))
        const value = snap.val()
        if (value && typeof value === 'object') {
          const agg = value as VenueAggregate
          aggregate.value = agg
          insertEntityAggregate('venues', id, agg)
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

  const appearances = computed<VenueAppearance[]>(() =>
    buildAppearances(aggregate.value?.appearances, compMeta.value),
  )
  const upcoming = computed(() => filterUpcoming(appearances.value))
  const past = computed(() => filterPast(appearances.value))

  const name = computed(() => aggregate.value?.name?.trim() || 'Venue')
  const locality = computed(() => aggregate.value?.locality ?? null)
  const region = computed(() => aggregate.value?.region ?? null)
  const country = computed(() => aggregate.value?.country ?? null)
  const lat = computed(() => aggregate.value?.lat ?? null)
  const lng = computed(() => aggregate.value?.lng ?? null)

  const locationLine = computed(() => {
    const parts = [locality.value, region.value, country.value].filter(Boolean)
    return parts.length ? parts.join(', ') : null
  })

  const totalComps = computed(() => countTotalComps(appearances.value))
  const compsThisYear = computed(() => countCompsThisYear(appearances.value))

  const firstSeen = computed(() => findFirstSeen(appearances.value))
  const firstSeenDate = computed(() => appearanceDate(firstSeen.value))
  const lastSeen = computed(() => findLastSeen(appearances.value))
  const lastSeenDate = computed(() => appearanceDate(lastSeen.value))

  return {
    loading,
    notFound,
    name,
    locality,
    region,
    country,
    lat,
    lng,
    locationLine,
    appearances,
    upcoming,
    past,
    totalComps,
    compsThisYear,
    firstSeen,
    firstSeenDate,
    lastSeen,
    lastSeenDate,
  }
}
