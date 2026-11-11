export interface CompetitionLink {
  name?: string
  /** Missing on some old links. */
  url?: string
  _order?: number
}

export interface Competition {
  /** Original submission, for system-admin follow-up. */
  submissionId?: string
  name?: string
  date?: number
  description?: string
  image?: string
  venue?: string
  /** The hall, theatre, gym or stage within the venue, when it's in one. */
  space?: string
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
  /** A championship class that ran as a regular competition: too few dancers turned up. */
  notChampionship?: boolean
  /** Its entries are teams, like duets or groups (ADR 0012): Manage adds teams here. */
  teams?: boolean
  _order?: number
}

export { isChampionshipName } from '@shared/labels'

export interface EnrichedGroup extends Group {
  fullName: string
  category?: Category
}

/**
 * A trophy across age groups, like Dancer of the Day: one list of placings,
 * picked by the organiser from the dancers in the age groups switched on.
 * Its placings are kept with the age groups' at results[trophyEventId][OVERALL_ID],
 * in the same shape, so entry, alerts and medals work the same way.
 */
export interface TrophyEvent {
  id: string
  name?: string
  /** The trophy's name, as on an age group. */
  trophy?: string
  /** Who sponsors it: a staff member's id, or a typed name. */
  sponsor?: string
  /** The age groups whose dancers can win it. */
  groupIds?: Record<string, boolean>
  /**
   * The dance, when it's danced on its own (a Trophy Fling, a dance-off).
   * Otherwise it's decided from the age groups' results. A danced one goes on
   * the schedule like an age group (its id among a platform's orderedGroupIds),
   * with callbacks like one, at results[trophyEventId].callbacks.
   */
  danceId?: string
  _order?: number
}

export interface EnrichedTrophyEvent extends TrophyEvent {
  fullName: string
  /** The age groups switched on, in the competition's order (ones since removed left out). */
  groups: EnrichedGroup[]
  /** Who can win it, said briefly: "All Premier · Intermediate 12 & Under 14". */
  openTo: string
}

/** One of a team's dancers, typed by the organiser (ADR 0012). */
export interface TeamMember {
  firstName?: string
  lastName?: string
  /** Back-pointer to their profile, written by the aggregator. */
  dancerId?: string
  _order?: number
}

/**
 * An entry in a competition: a number in an age group, danced by one person
 * (a dancer), or by several (`team: true`, ADR 0012).
 */
export interface Dancer {
  id: string
  /** A dancer's name; on a team, only what v3 shows (see lib/entries legacyNames). */
  firstName?: string
  lastName?: string
  number?: number
  groupId?: string
  location?: string
  image?: string
  /** Back-pointer to the aggregate dancer profile, written by the aggregator. Never on a team. */
  dancerId?: string
  /** The routine's name, e.g. a solo choreography's, or a team's. */
  title?: string
  /** Their dance school or teacher, as the organiser wrote it. */
  studio?: string
  team?: boolean
  members?: Record<string, TeamMember>
  _order?: number
}

/** A team member, ready to show. */
export interface EnrichedMember extends TeamMember {
  key: string
  name: string
}

export interface EnrichedDancer extends Dancer {
  /** A dancer's name, or a team's (lib/entries entryName). */
  fullName: string
  group?: EnrichedGroup
  /** A team's members, in order. */
  teamMembers?: EnrichedMember[]
}

export { dancerFullName, groupFullName } from '@shared/labels'

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

export { danceFullName } from '@shared/labels'

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

/**
 * One page of a dance's judges' sheet (how each judge placed the dancers): a
 * picture shrunk on the organiser's device, or a page of their PDF.
 */
export interface SheetPage {
  id: string
  url: string
  /** Where the file is kept in Storage (under the data namespace), so taking the page off deletes it. */
  path: string
  /** The picture's size in pixels, so it's laid out before it loads. */
  width: number
  height: number
  _order?: number
}

// sheets[groupId][danceId][pageId] = SheetPage (without its id).
export type SheetsTree = Record<string, Record<string, Record<string, Omit<SheetPage, 'id'>> | undefined> | undefined>

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
