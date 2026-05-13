import { computed, effectScope, ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import { guessUserCountry } from '@/lib/locale'

const NEAR_ME_KM = 300

// Module-level singletons so the list and calendar share the same filter state.
// Country/region/locality persist across reloads. `near` deliberately does NOT
// persist — iOS standalone (Add to Home Screen) PWAs silently block any
// geolocation request that isn't tied to a fresh user gesture, so resuming
// "Near me" on app launch would leave the toggle stuck on with no coords.
// First-visit country defaults to a timezone/locale guess; user can clear.
const country = useLocalStorage<string | null>('competitions:location.country', guessUserCountry())
const region = useLocalStorage<string | null>('competitions:location.region', null)
const locality = useLocalStorage<string | null>('competitions:location.locality', null)
const near = ref(false)
const coords = ref<{ lat: number; lng: number } | null>(null)
const locationLoading = ref(false)
type LocationErrorKind = 'denied' | 'unavailable' | 'timeout'
const locationError = ref<LocationErrorKind | null>(null)

// Cascade-clear: selecting a new country wipes the now-orphaned region/locality.
// Detached scope so the watchers stick around outside any component lifecycle.
effectScope(true).run(() => {
  watch(country, () => {
    if (region.value !== null) region.value = null
    if (locality.value !== null) locality.value = null
  })
  watch(region, () => {
    if (locality.value !== null) locality.value = null
  })
})

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
// Uses getCurrentPosition (one-shot) instead of watchPosition — more reliable
// in iOS standalone PWAs and we only need a single fix for the Near-me filter.
function requestCurrentPosition(): void {
  if (!navigator.geolocation) {
    locationError.value = 'unavailable'
    near.value = false
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
      near.value = false
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
  )
}

export function useLocationFilter() {
  const geoCoords = computed(() => coords.value)

  function enableNearMe(): void {
    near.value = true
    requestCurrentPosition()
  }
  function disableNearMe(): void {
    near.value = false
    coords.value = null
    locationError.value = null
  }
  function clear(): void {
    country.value = null
    region.value = null
    locality.value = null
    disableNearMe()
  }

  function matches(c: CompetitionListItem): boolean {
    if (country.value && c.country !== country.value) return false
    if (region.value && c.region !== region.value) return false
    if (locality.value && c.locality !== locality.value) return false
    if (near.value && geoCoords.value) {
      if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return false
      const d = haversineKm(
        geoCoords.value.lat,
        geoCoords.value.lng,
        c.lat as number,
        c.lng as number,
      )
      if (d > NEAR_ME_KM) return false
    }
    return true
  }

  const isActive = computed(
    () => Boolean(country.value || region.value || locality.value || near.value),
  )

  function deriveOptions(comps: CompetitionListItem[]): {
    countries: string[]
    regions: string[]
    localities: string[]
  } {
    const countries = new Set<string>()
    const regions = new Set<string>()
    const localities = new Set<string>()
    for (const c of comps) {
      if (c.country) countries.add(c.country)
      if (c.country === country.value && c.region) regions.add(c.region)
      if (
        c.country === country.value
        && c.region === region.value
        && c.locality
      ) {
        localities.add(c.locality)
      }
    }
    return {
      countries: [...countries].sort(),
      regions: [...regions].sort(),
      localities: [...localities].sort(),
    }
  }

  return {
    country,
    region,
    locality,
    near,
    geoCoords,
    locationError,
    locationLoading,
    enableNearMe,
    disableNearMe,
    clear,
    matches,
    isActive,
    deriveOptions,
    NEAR_ME_KM,
  }
}
