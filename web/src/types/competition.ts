export interface CompetitionLink {
  name?: string
  url: string
}

export interface Competition {
  name?: string
  date?: number
  description?: string
  image?: string
  venue?: string
  address?: string
  location?: string
  registrationURL?: string
  registrationStart?: number
  registrationEnd?: number
  links?: CompetitionLink[]
  sobhd?: string
  listed?: boolean
  published?: boolean
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
  _order?: number
}

export const staffMemberName = (m: StaffMember) =>
  `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim()

export interface Category {
  id: string
  name?: string
  _order?: number
}

export interface Group {
  id: string
  name?: string
  categoryId?: string
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
  steps?: string
  groupIds?: Record<string, boolean>
  _order?: number
}

export interface EnrichedDance extends Dance {
  fullName: string
}

export const danceFullName = (d: Pick<Dance, 'name' | 'steps'>) => {
  const name = (d.name ?? '').trim()
  const steps = (d.steps ?? '').trim()
  return steps ? `${name} (${steps})` : name
}

export const OVERALL_ID = 'overall'

export const overallDance: EnrichedDance = {
  id: OVERALL_ID,
  fullName: 'Overall',
}

export const groupHasOverall = (group?: EnrichedGroup) =>
  Boolean(
    group?.category?.name &&
      !group.category.name.trim().toLowerCase().startsWith('primary'),
  )

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
