import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { initialsOf } from '@/lib/format'

export type SearchEntityType = 'competitions' | 'dancers' | 'judges' | 'pipers' | 'places'

export type PlaceKind = 'venue' | 'locality' | 'region'

interface RawCompetitionDoc {
  id?: string
  $name?: string
  name?: string
  venue?: string
  location?: string
  locality?: string
  region?: string
  country?: string
  date?: number
  published?: boolean
  listed?: boolean
  image?: string
}

interface RawPersonDoc {
  id?: string
  $name?: string
  $competitionId?: string
  firstName?: string
  lastName?: string
  location?: string
  image?: string
}

interface RawHit<D> {
  document?: D
}

interface RawGroupedHit<D> {
  group_key?: string[]
  hits?: RawHit<D>[]
}

interface RawSearchResult<D> {
  hits?: RawHit<D>[]
  grouped_hits?: RawGroupedHit<D>[]
  found?: number
}

interface RawPlacesBlock {
  venues: RawSearchResult<RawCompetitionDoc> | null
  localities: RawSearchResult<RawCompetitionDoc> | null
  regions: RawSearchResult<RawCompetitionDoc> | null
}

interface RawSearchAllResponse {
  competitions: RawSearchResult<RawCompetitionDoc> | null
  dancers: RawSearchResult<RawPersonDoc> | null
  judges: RawSearchResult<RawPersonDoc> | null
  pipers: RawSearchResult<RawPersonDoc> | null
  places: RawPlacesBlock | null
}

export interface SearchCompetitionHit {
  id: string
  name: string
  venue?: string
  location?: string
  date?: number
  image?: string
}

export interface SearchPersonGroup {
  name: string
  initials: string
  competitionIds: string[]
  location?: string
  image?: string
}

export interface SearchPlaceGroup {
  kind: PlaceKind
  name: string
  parentLabel?: string
  count: number
  sampleCompId: string
  competitionIds: string[]
  country?: string
  region?: string
  locality?: string
}

export interface SearchAllResults {
  competitions: { hits: SearchCompetitionHit[]; total: number }
  dancers: { groups: SearchPersonGroup[]; total: number }
  judges: { groups: SearchPersonGroup[]; total: number }
  pipers: { groups: SearchPersonGroup[]; total: number }
  places: { groups: SearchPlaceGroup[]; total: number }
}

interface CallParams {
  q: string
  perGroup?: number
  types?: SearchEntityType[]
}

const callable = httpsCallable<CallParams, RawSearchAllResponse>(functions, 'searchAll')

function cacheKey(p: CallParams): string {
  const t = p.types?.length ? [...p.types].sort().join(',') : 'all'
  return `${p.q}::${p.perGroup ?? 5}::${t}`
}

const responseCache = new Map<string, SearchAllResults>()
const inFlight = new Map<string, Promise<SearchAllResults>>()

function mapCompetitions(
  result: RawSearchResult<RawCompetitionDoc> | null,
): SearchAllResults['competitions'] {
  if (!result) return { hits: [], total: 0 }
  const hits = (result.hits ?? [])
    .map<SearchCompetitionHit | null>((h) => {
      const d = h.document
      if (!d?.id) return null
      return {
        id: d.id,
        name: d.name ?? d.$name ?? '',
        venue: d.venue,
        location: d.location || [d.locality, d.region, d.country].filter(Boolean).join(', ') || undefined,
        date: d.date,
        image: d.image,
      }
    })
    .filter((h): h is SearchCompetitionHit => h !== null)
  return { hits, total: result.found ?? hits.length }
}

function mapPeople(
  result: RawSearchResult<RawPersonDoc> | null,
): { groups: SearchPersonGroup[]; total: number } {
  if (!result) return { groups: [], total: 0 }
  const groups = (result.grouped_hits ?? []).map<SearchPersonGroup>((g) => {
    const name = g.group_key?.[0] ?? ''
    const docs = (g.hits ?? []).map((h) => h.document).filter((d): d is RawPersonDoc => !!d)
    const withLocation = docs.find((d) => d.location)
    const withImage = docs.find((d) => d.image)
    const competitionIds = Array.from(
      new Set(docs.map((d) => d.$competitionId).filter((id): id is string => !!id)),
    )
    return {
      name,
      initials: initialsOf(name),
      competitionIds,
      location: withLocation?.location,
      image: withImage?.image,
    }
  })
  return { groups, total: result.found ?? groups.length }
}

function parentLabelFor(kind: PlaceKind, sample: RawCompetitionDoc | undefined): string | undefined {
  if (!sample) return undefined
  if (kind === 'venue') {
    // Venue's parent is its locality + region (city, province)
    return [sample.locality, sample.region].filter(Boolean).join(', ') || sample.country || undefined
  }
  if (kind === 'locality') {
    // Locality's parent is region + country
    return [sample.region, sample.country].filter(Boolean).join(', ') || undefined
  }
  // region's parent is country
  return sample.country || undefined
}

function mapPlacesBucket(
  kind: PlaceKind,
  result: RawSearchResult<RawCompetitionDoc> | null,
): SearchPlaceGroup[] {
  if (!result) return []
  return (result.grouped_hits ?? [])
    .map<SearchPlaceGroup | null>((g) => {
      const name = (g.group_key?.[0] ?? '').trim()
      if (!name) return null
      const hits = (g.hits ?? []).map((h) => h.document).filter((d): d is RawCompetitionDoc => !!d)
      const sample = hits[0]
      if (!sample?.id) return null
      const competitionIds = Array.from(
        new Set(hits.map((d) => d.id).filter((id): id is string => !!id)),
      )
      return {
        kind,
        name,
        parentLabel: parentLabelFor(kind, sample),
        count: competitionIds.length,
        sampleCompId: sample.id,
        competitionIds,
        country: sample.country,
        region: sample.region,
        locality: sample.locality,
      }
    })
    .filter((g): g is SearchPlaceGroup => g !== null)
}

function mapPlaces(block: RawPlacesBlock | null): SearchAllResults['places'] {
  if (!block) return { groups: [], total: 0 }
  const merged = [
    ...mapPlacesBucket('region', block.regions),
    ...mapPlacesBucket('locality', block.localities),
    ...mapPlacesBucket('venue', block.venues),
  ]
  // Dedupe identical name+kind (rare but possible across buckets, e.g. a
  // venue and a locality sharing a name).
  const seen = new Set<string>()
  const groups = merged.filter((g) => {
    const k = `${g.kind}::${g.name.toLowerCase()}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  groups.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  return { groups, total: groups.length }
}

export async function searchAll(params: CallParams): Promise<SearchAllResults> {
  const trimmed = params.q.trim()
  if (!trimmed) {
    return {
      competitions: { hits: [], total: 0 },
      dancers: { groups: [], total: 0 },
      judges: { groups: [], total: 0 },
      pipers: { groups: [], total: 0 },
      places: { groups: [], total: 0 },
    }
  }
  const key = cacheKey({ ...params, q: trimmed })
  const cached = responseCache.get(key)
  if (cached) return cached
  const pending = inFlight.get(key)
  if (pending) return pending
  const promise = (async () => {
    try {
      const { data } = await callable({ ...params, q: trimmed })
      const out: SearchAllResults = {
        competitions: mapCompetitions(data?.competitions ?? null),
        dancers: mapPeople(data?.dancers ?? null),
        judges: mapPeople(data?.judges ?? null),
        pipers: mapPeople(data?.pipers ?? null),
        places: mapPlaces(data?.places ?? null),
      }
      responseCache.set(key, out)
      return out
    } finally {
      inFlight.delete(key)
    }
  })()
  inFlight.set(key, promise)
  return promise
}
