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
import { isBeforeToday, parseDate } from '@/lib/format'
import { insertEntityAggregate } from '@/composables/useEntityAggregates'
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
          aggregate.value = value as VenueAggregate
          insertEntityAggregate('venues', id, value as VenueAggregate)
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

  const appearances = computed<VenueAppearance[]>(() => {
    const apps = aggregate.value?.appearances || {}
    return Object.entries(apps)
      .map<VenueAppearance>(([key, raw]) => ({
        key,
        raw,
        competition: raw.competitionId
          ? compMeta.value[raw.competitionId] ?? null
          : null,
      }))
      .sort((a, b) => {
        const da = a.competition?.date ? parseDate(a.competition.date).getTime() : 0
        const db = b.competition?.date ? parseDate(b.competition.date).getTime() : 0
        return db - da
      })
  })

  const upcoming = computed(() =>
    appearances.value
      .filter((a) => a.competition?.date && !isBeforeToday(a.competition.date))
      .sort((a, b) => {
        const da = a.competition?.date ? parseDate(a.competition.date).getTime() : 0
        const db = b.competition?.date ? parseDate(b.competition.date).getTime() : 0
        return da - db
      }),
  )

  const past = computed(() =>
    appearances.value.filter(
      (a) => a.competition?.date && isBeforeToday(a.competition.date),
    ),
  )

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

  const totalComps = computed(() => {
    const ids = new Set<string>()
    for (const a of appearances.value) {
      if (a.raw.competitionId) ids.add(a.raw.competitionId)
    }
    return ids.size
  })

  const compsThisYear = computed(() => {
    const year = new Date().getFullYear()
    const ids = new Set<string>()
    for (const a of appearances.value) {
      const d = a.competition?.date
      if (!d) continue
      if (parseDate(d).getFullYear() === year && a.raw.competitionId) {
        ids.add(a.raw.competitionId)
      }
    }
    return ids.size
  })

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
  }
}
