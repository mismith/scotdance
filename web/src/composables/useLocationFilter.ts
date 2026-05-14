import { computed, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import { guessUserCountry } from '@/lib/locale'

export type LocationMode = 'nearby' | 'region' | 'worldwide'

const DEFAULT_RADIUS_KM = 300
const MIN_RADIUS_KM = 50
const MAX_RADIUS_KM = 5000
const RADIUS_STEP_KM = 50

// First-visit default: if we can guess a country from TZ/locale, start in
// Region mode with that country pre-set. Otherwise Worldwide.
const initialCountry = guessUserCountry()
const initialMode: LocationMode = initialCountry ? 'region' : 'worldwide'

// Module-level singletons so the pill + filtering share state across the app.
const mode = useLocalStorage<LocationMode>('competitions:location.mode', initialMode)
const radius = useLocalStorage<number>('competitions:location.radius', DEFAULT_RADIUS_KM)
const country = useLocalStorage<string | null>('competitions:location.country', initialCountry)
const region = useLocalStorage<string | null>('competitions:location.region', null)
const locality = useLocalStorage<string | null>('competitions:location.locality', null)

// Non-persistent: coords are tied to a fresh user gesture (iOS PWA rule).
const coords = ref<{ lat: number; lng: number } | null>(null)
const locationLoading = ref(false)
type LocationErrorKind = 'denied' | 'unavailable' | 'timeout'
const locationError = ref<LocationErrorKind | null>(null)

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// Must be invoked synchronously inside a user gesture (click/tap handler).
// One-shot getCurrentPosition — watchPosition is unreliable in iOS standalone.
function requestCurrentPosition(): void {
  if (!navigator.geolocation) {
    locationError.value = 'unavailable'
    mode.value = 'worldwide'
    return
  }
  locationLoading.value = true
  locationError.value = null
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      coords.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      locationLoading.value = false
    },
    (err) => {
      locationLoading.value = false
      if (err.code === err.PERMISSION_DENIED) locationError.value = 'denied'
      else if (err.code === err.TIMEOUT) locationError.value = 'timeout'
      else locationError.value = 'unavailable'
      mode.value = 'worldwide'
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
  )
}

export function useLocationFilter() {
  function setNearby(): void {
    mode.value = 'nearby'
    requestCurrentPosition()
  }
  function setRegion(parts?: {
    country?: string | null
    region?: string | null
    locality?: string | null
  }): void {
    if (parts) {
      country.value = parts.country ?? null
      region.value = parts.region ?? null
      locality.value = parts.locality ?? null
    }
    mode.value = 'region'
    locationError.value = null
  }
  function setWorldwide(): void {
    mode.value = 'worldwide'
    locationError.value = null
  }
  function setRadius(km: number): void {
    radius.value = km
  }

  const isActive = computed(() => mode.value !== 'worldwide')

  // Context-aware predicate. Defensive guards mean filters that point at
  // values absent from `comps` (e.g. TZ-guessed country before backfill) are
  // silently no-op'd, so first-time visitors don't land on an empty list.
  function filterFor(comps: CompetitionListItem[]) {
    if (mode.value === 'worldwide') {
      return { predicate: () => true, isActive: false }
    }
    if (mode.value === 'nearby') {
      const c = coords.value
      if (!c) return { predicate: () => true, isActive: false }
      const r = radius.value
      return {
        predicate(comp: CompetitionListItem): boolean {
          if (!Number.isFinite(comp.lat) || !Number.isFinite(comp.lng)) return false
          return haversineKm(c.lat, c.lng, comp.lat as number, comp.lng as number) <= r
        },
        isActive: true,
      }
    }
    // region mode
    const has = (key: 'country' | 'region' | 'locality', val: string) =>
      comps.some((c) => c[key] === val)
    const effCountry = country.value && has('country', country.value) ? country.value : null
    const effRegion = region.value && has('region', region.value) ? region.value : null
    const effLocality = locality.value && has('locality', locality.value) ? locality.value : null
    const effectiveActive = Boolean(effCountry || effRegion || effLocality)
    return {
      predicate(c: CompetitionListItem): boolean {
        if (effCountry && c.country !== effCountry) return false
        if (effRegion && c.region !== effRegion) return false
        if (effLocality && c.locality !== effLocality) return false
        return true
      },
      isActive: effectiveActive,
    }
  }

  return {
    mode,
    radius,
    country,
    region,
    locality,
    coords,
    locationError,
    locationLoading,
    setNearby,
    setRegion,
    setWorldwide,
    setRadius,
    filterFor,
    isActive,
    MIN_RADIUS_KM,
    MAX_RADIUS_KM,
    RADIUS_STEP_KM,
  }
}
