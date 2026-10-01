// Google Places (new) loader + helpers. Mirrors the old app's pattern
// (src/helpers/maps.js) but TypeScript and split into autocomplete vs resolve.
// The Place Autocomplete API is session-billed: keep the same token until a
// pick happens, then reset.

import { importLibrary, setOptions } from '@googlemaps/js-api-loader'

// HTTP-referrer-restricted in Google Cloud, so it's safe to ship to the
// client — but keep it in env so dev/staging/prod can use different keys.
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''

let optionsSet = false
let placesLibPromise: Promise<google.maps.PlacesLibrary> | null = null
let sessionToken: google.maps.places.AutocompleteSessionToken | null = null

function getPlacesLib(): Promise<google.maps.PlacesLibrary> {
  if (!optionsSet) {
    setOptions({ key: GOOGLE_MAPS_API_KEY, libraries: ['places'] })
    optionsSet = true
  }
  if (!placesLibPromise) placesLibPromise = importLibrary('places')
  return placesLibPromise
}

export interface PlaceSuggestion {
  placeId: string
  primaryText: string
  secondaryText: string
}

export interface PickedRegion {
  country: string | null
  region: string | null
  locality: string | null
  label: string
}

export async function fetchRegionSuggestions(
  input: string,
  countryIso?: string | null,
): Promise<PlaceSuggestion[]> {
  const trimmed = input.trim()
  if (!trimmed) return []
  const { AutocompleteSuggestion, AutocompleteSessionToken } = await getPlacesLib()
  if (!sessionToken) sessionToken = new AutocompleteSessionToken()
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input: trimmed,
    sessionToken,
    includedPrimaryTypes: ['country', 'administrative_area_level_1', 'locality'],
    ...(countryIso ? { includedRegionCodes: [countryIso] } : {}),
  })
  return suggestions
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      placeId: p.placeId,
      primaryText: p.mainText?.toString() ?? p.text?.toString() ?? '',
      secondaryText: p.secondaryText?.toString() ?? '',
    }))
}

export async function resolvePlace(placeId: string): Promise<PickedRegion | null> {
  const { Place } = await getPlacesLib()
  const place = new Place({ id: placeId })
  await place.fetchFields({ fields: ['addressComponents', 'displayName'] })
  const components = place.addressComponents ?? []
  const find = (type: string) => components.find((c) => c.types.includes(type))
  const country = find('country')?.shortText ?? null
  const region = find('administrative_area_level_1')?.shortText ?? null
  const locality = find('locality')?.shortText ?? null
  const label =
    [locality, region, country].filter(Boolean).join(', ') ||
    place.displayName ||
    ''
  // Reset the session — Google bills per session, fresh one for next pick.
  sessionToken = null
  return { country, region, locality, label }
}

/** Places search is available (a Maps key is configured for this build). */
export const placesAvailable = !!GOOGLE_MAPS_API_KEY

/** Venues and addresses, for the venue search in Manage › Details. */
export async function fetchVenueSuggestions(input: string): Promise<PlaceSuggestion[]> {
  const trimmed = input.trim()
  if (!trimmed || !placesAvailable) return []
  const { AutocompleteSuggestion, AutocompleteSessionToken } = await getPlacesLib()
  if (!sessionToken) sessionToken = new AutocompleteSessionToken()
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: trimmed, sessionToken })
  return suggestions
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      placeId: p.placeId,
      primaryText: p.mainText?.toString() ?? p.text?.toString() ?? '',
      secondaryText: p.secondaryText?.toString() ?? '',
    }))
}

export interface VenueFields {
  venue: string | null
  address: string | null
  location: string | null
  lat: number | null
  lng: number | null
  country: string | null
  region: string | null
  locality: string | null
}

/** A picked venue as competition fields (the same shape the old admin wrote). */
export async function resolveVenue(placeId: string): Promise<VenueFields> {
  const { Place } = await getPlacesLib()
  const place = new Place({ id: placeId })
  await place.fetchFields({ fields: ['addressComponents', 'displayName', 'location', 'types'] })
  sessionToken = null
  const components = place.addressComponents ?? []
  const find = (type: string) => components.find((c) => c.types.includes(type))
  const streetNumber = find('street_number')
  const route = find('route')
  const locality = find('locality') ?? find('postal_town')
  const region = find('administrative_area_level_1')
  const country = find('country')
  const addressOnly = (place.types ?? []).some((t) => t === 'street_address' || t === 'premise' || t === 'route')
  const lat = place.location?.lat()
  const lng = place.location?.lng()
  return {
    venue: addressOnly ? null : (place.displayName ?? null),
    address: [streetNumber?.shortText, route?.shortText].filter(Boolean).join(' ') || null,
    // "Calgary, AB", as v3 wrote it: lists group by this text, so one spelling.
    location: [locality?.shortText, region?.shortText].filter(Boolean).join(', ') || null,
    lat: typeof lat === 'number' && Number.isFinite(lat) ? lat : null,
    lng: typeof lng === 'number' && Number.isFinite(lng) ? lng : null,
    country: country?.shortText ?? null,
    region: region?.shortText ?? null,
    locality: locality?.shortText ?? null,
  }
}
