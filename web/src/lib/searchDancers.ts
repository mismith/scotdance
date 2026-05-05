import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'

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

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0][0]?.toUpperCase() ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1][0]?.toUpperCase() ?? '') : ''
  return `${first}${last}` || '?'
}

export async function searchDancers(q: string): Promise<SearchDancerGroup[]> {
  const trimmed = q.trim()
  if (!trimmed) return []
  const { data } = await callable({
    q: trimmed,
    group_by: '$name',
    group_limit: 99,
    per_page: 99,
  })
  return (data.grouped_hits ?? []).map<SearchDancerGroup>((g) => {
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
}
