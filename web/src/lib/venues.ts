import type { CompetitionListItem } from '@/composables/useCompetitions'

// Pin-merge rule: same venue if proximity ≤ 50m AND normalized venue names
// match (lowercase, trim, punctuation stripped, tokens sorted). Bias is
// toward false-split (mild duplication) over false-merge (silent absence).
const PROXIMITY_METERS = 50
const EARTH_RADIUS_M = 6_371_000

function normalizeVenue(name?: string): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ')
}

function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s))
}

export interface VenueGroup {
  id: string
  lat: number
  lng: number
  venue: string
  location?: string
  competitions: CompetitionListItem[]
}

export function groupByVenue(comps: CompetitionListItem[]): VenueGroup[] {
  const groups: VenueGroup[] = []
  for (const c of comps) {
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue
    const lat = c.lat as number
    const lng = c.lng as number
    const norm = normalizeVenue(c.venue)
    const existing = groups.find(
      (g) =>
        normalizeVenue(g.venue) === norm &&
        haversineMeters(g.lat, g.lng, lat, lng) <= PROXIMITY_METERS,
    )
    if (existing) {
      existing.competitions.push(c)
    } else {
      groups.push({
        id: c.id,
        lat,
        lng,
        venue: c.venue ?? '',
        location: c.location,
        competitions: [c],
      })
    }
  }
  return groups
}
