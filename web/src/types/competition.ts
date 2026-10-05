export interface CompetitionLink {
  name?: string
  /** Missing on some old links. */
  url?: string
  _order?: number
}

export interface Competition {
  name?: string
  date?: number
  description?: string
  image?: string
  venue?: string
  address?: string
  location?: string
  lat?: number
  lng?: number
  country?: string
  region?: string
  locality?: string
  registrationURL?: string
  registrationStart?: number
  registrationEnd?: number
  /** Keyed by push id (old and new admin alike). */
  links?: Record<string, CompetitionLink>
  sobhd?: string
  listed?: boolean
  published?: boolean
  /** The organisations it's run by or part of (see types/organisation). */
  organisations?: Record<string, boolean>
}

export interface StaffMember {
  id: string
  firstName?: string
  lastName?: string
  type?: string
  image?: string
  description?: string
  location?: string
  website?: string
  /** Back-pointer to the matching aggregate entity, written by the aggregator. */
  judgeId?: string
  piperId?: string
  _order?: number
}

export const staffMemberName = (m: StaffMember) =>
  `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim()

// Maps a staff record to its aggregate-entity favourite namespace + id, when
// the aggregator has matched it. Returns null for unmatched/other staff types.
export type StaffEntityRef = {
  type: 'judges' | 'pipers'
  id: string
  routePrefix: 'judge' | 'piper'
  idParam: 'judgeId' | 'piperId'
}

export function staffEntityRef(m: StaffMember): StaffEntityRef | null {
  if (m.judgeId) {
    return { type: 'judges', id: m.judgeId, routePrefix: 'judge', idParam: 'judgeId' }
  }
  if (m.piperId) {
    return { type: 'pipers', id: m.piperId, routePrefix: 'piper', idParam: 'piperId' }
  }
  return null
}

export interface Category {
  id: string
  name?: string
  _order?: number
}

export interface Group {
  id: string
  name?: string
  categoryId?: string
  /** The trophy's name, e.g. "Adeline Duncan Memorial". */
  trophy?: string
  /** Who sponsors it: a staff member's id, or (older competitions) a name. */
  sponsor?: string
  _order?: number
}

export interface EnrichedGroup extends Group {
  fullName: string
  category?: Category
}

export interface Dancer {
  id: string
  firstName?: string
  lastName?: string
  number?: number
  groupId?: string
  location?: string
  image?: string
  /** Back-pointer to the aggregate dancer profile, written by the aggregator. */
  dancerId?: string
  _order?: number
}

export interface EnrichedDancer extends Dancer {
  fullName: string
  group?: EnrichedGroup
}

export const dancerFullName = (d: Pick<Dancer, 'firstName' | 'lastName'>) =>
  `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim()

export const groupFullName = (g: Group, category?: Category) =>
  `${category?.name ?? ''} ${g.name ?? ''}`.trim()

export interface Dance {
  id: string
  name?: string
  shortName?: string
  steps?: string | number
  groupIds?: Record<string, boolean>
  _order?: number
}

export interface EnrichedDance extends Dance {
  fullName: string
}

export const danceFullName = (d: Pick<Dance, 'name' | 'steps'>) => {
  const name = String(d.name ?? '').trim()
  const steps = String(d.steps ?? '').trim()
  return steps ? `${name} (${steps})` : name
}

export const OVERALL_ID = 'overall'

export const overallDance: EnrichedDance = {
  id: OVERALL_ID,
  fullName: 'Overall',
}

/** Primary dancers have no overall results and no championship points. */
export const isPrimaryCategory = (name?: string | null) =>
  !!name?.trim().toLowerCase().startsWith('primary')

/** Its category has overall results (not Primary, nor unknown). */
export const groupHasOverall = (group?: { category?: { name?: string } | null } | null) =>
  Boolean(group?.category?.name && !isPrimaryCategory(group.category.name))

// Raw RTDB shapes:
// results[groupId][danceId] = string[] (with optional first "reverse:N" marker, dancers as "id" or "id:tie")
//                             | false  (explicitly empty)
// points[groupId][danceId][judgeId] = string[]
export type DancePlacing = string
export type ResultsTree = Record<
  string,
  Record<string, DancePlacing[] | false | undefined>
>
export type PointsTree = Record<string, Record<string, Record<string, string[]>>>

// draws[groupId][danceId] = string[] of dancer numbers in draw order.
export type DrawsTree = Record<string, Record<string, string[] | undefined>>

export interface Platform {
  id: string
  name?: string
  _order?: number
}

export interface SchedulePlatform {
  orderedGroupIds?: string[]
  orderedJudgeIds?: string[]
}

export interface ScheduleDance {
  id: string
  order?: number
  name?: string
  description?: string
  danceId?: string
  platforms?: Record<string, SchedulePlatform>
}

export interface ScheduleEvent {
  id: string
  order?: number
  name?: string
  description?: string
  dances?: Record<string, Omit<ScheduleDance, 'id'>>
}

export interface ScheduleBlock {
  id: string
  order?: number
  name?: string
  description?: string
  events?: Record<string, Omit<ScheduleEvent, 'id'>>
}

export interface ScheduleDay {
  id: string
  order?: number
  name?: string
  date?: number
  description?: string
  blocks?: Record<string, Omit<ScheduleBlock, 'id'>>
}

export interface Schedule {
  days?: Record<string, Omit<ScheduleDay, 'id'>>
}
