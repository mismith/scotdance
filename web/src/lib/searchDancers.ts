import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { initialsOf } from '@/lib/format'

interface RawHit {
  document?: {
    id?: string
    $name?: string
    $competitionId?: string
    firstName?: string
    lastName?: string
    number?: number
    groupId?: string
    location?: string
    image?: string
  }
}

interface RawGroupedHit {
  group_key?: string[]
  hits?: RawHit[]
}

interface RawSearchResponse {
  grouped_hits?: RawGroupedHit[]
}

const callable = httpsCallable<unknown, RawSearchResponse>(functions, 'searchDancers')

export interface SearchDancerHit {
  id: string
  fullName: string
  competitionId: string
  firstName?: string
  lastName?: string
  number?: number
  groupId?: string
  location?: string
  image?: string
}

export interface SearchDancerGroup {
  name: string
  initials: string
  dancers: SearchDancerHit[]
}

const responseCache = new Map<string, SearchDancerGroup[]>()
const inFlight = new Map<string, Promise<SearchDancerGroup[]>>()

export async function searchDancers(q: string): Promise<SearchDancerGroup[]> {
  const trimmed = q.trim()
  if (!trimmed) return []
  const cached = responseCache.get(trimmed)
  if (cached) return cached
  const pending = inFlight.get(trimmed)
  if (pending) return pending
  const promise = (async () => {
    try {
      const { data } = await callable({
        q: trimmed,
        group_by: '$name',
        group_limit: 99,
        per_page: 99,
      })
      const groups = (data.grouped_hits ?? []).map<SearchDancerGroup>((g) => {
        const name = g.group_key?.[0] ?? ''
        return {
          name,
          initials: initialsOf(name),
          dancers: (g.hits ?? [])
            .map<SearchDancerHit | null>((h) => {
              const doc = h.document
              if (!doc?.id || !doc?.$competitionId) return null
              return {
                id: doc.id,
                fullName: doc.$name ?? name,
                competitionId: doc.$competitionId,
                firstName: doc.firstName,
                lastName: doc.lastName,
                number: doc.number,
                groupId: doc.groupId,
                location: doc.location,
                image: doc.image,
              }
            })
            .filter((d): d is SearchDancerHit => d !== null),
        }
      })
      responseCache.set(trimmed, groups)
      return groups
    } finally {
      inFlight.delete(trimmed)
    }
  })()
  inFlight.set(trimmed, promise)
  return promise
}
