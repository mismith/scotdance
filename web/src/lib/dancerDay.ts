import { blocks, dances as scheduleDances, days, events } from '@/lib/schedule'
import { CALLBACKS_ID, findGroupDances, getDancerPlace } from '@/lib/results'
import { daysFromToday } from '@/lib/format'
import {
  OVERALL_ID,
  groupHasOverall,
  type DrawsTree,
  type EnrichedDance,
  type EnrichedDancer,
  type EnrichedGroup,
  type Platform,
  type PointsTree,
  type ResultsTree,
  type Schedule,
} from '@/types/competition'

// "Your dancer's day": for one competition entry (a per-competition dancer
// record, so one number), every dance with its state in plain words.
//
// The data has no clock times and no "dancing now" flag, so states are
// inferred honestly from what has been posted:
//   placed / unplaced   results are posted for this dance
//   waiting             not posted, but something scheduled after it on the
//                       same platform has been, so it has been danced
//   next                the first dance not yet danced
//   later               after that
// Before competition day every dance is "upcoming"; after it, anything
// never posted is "not-posted".

export type Phase = 'before' | 'today' | 'after'

export type DanceState =
  | 'placed'
  | 'unplaced'
  | 'no-placings'
  | 'waiting'
  | 'next'
  | 'later'
  | 'upcoming'
  | 'not-posted'

export interface SlotInfo {
  seq: number
  dayName: string | null
  blockName: string | null
  /** Organisers usually put the start time in the block description ("8:00 am"). */
  blockTime: string | null
  eventName: string | null
  platformId: string
  platformName: string | null
  /** 1-based position of this group among the groups on that platform. */
  groupPos: number
  groupCount: number
}

export interface DanceStatus {
  dance: EnrichedDance
  state: DanceState
  place: number | null
  tied: boolean
  pointed: boolean
  slot: SlotInfo | null
  /** 1-based position in the draw (dancing order), when posted. */
  drawPos: number | null
  drawSize: number | null
}

export interface DancerDay {
  dancer: EnrichedDancer
  group: EnrichedGroup | null
  phase: Phase
  dances: DanceStatus[]
  overall: DanceStatus | null
  /** null when callbacks haven't been posted for the group. */
  calledBack: boolean | null
  next: DanceStatus | null
  resultsIn: number
}

export interface DayBundle {
  dances: EnrichedDance[]
  results: ResultsTree
  points: PointsTree
  schedule: Schedule | null
  platforms: Platform[]
  draws: DrawsTree
}

export function competitionPhase(date: number | string | null | undefined): Phase {
  const diff = daysFromToday(date ?? null)
  if (diff == null) return 'before'
  if (diff > 0) return 'before'
  if (diff < 0) return 'after'
  return 'today'
}

interface ScheduleSlot extends SlotInfo {
  danceId: string
  groupIds: string[]
}

interface ScheduleIndex {
  slots: ScheduleSlot[]
  /** `${groupId}:${danceId}` → first slot where that group dances it */
  byGroupDance: Map<string, ScheduleSlot>
}

const indexCache = new WeakMap<Schedule, ScheduleIndex>()

export function scheduleIndex(schedule: Schedule | null, platforms: Platform[]): ScheduleIndex {
  const empty: ScheduleIndex = { slots: [], byGroupDance: new Map() }
  if (!schedule) return empty
  const hit = indexCache.get(schedule)
  if (hit) return hit
  const platformName = new Map(platforms.map((p) => [p.id, p.name ?? null]))
  const platformOrder = new Map(platforms.map((p, i) => [p.id, i]))
  const index: ScheduleIndex = { slots: [], byGroupDance: new Map() }
  let seq = 0
  for (const day of days(schedule)) {
    for (const block of blocks(day)) {
      for (const event of events(block)) {
        for (const sd of scheduleDances(event)) {
          if (!sd.danceId || !sd.platforms) continue
          const entries = Object.entries(sd.platforms).sort(
            ([a], [b]) => (platformOrder.get(a) ?? 99) - (platformOrder.get(b) ?? 99),
          )
          for (const [platformId, slot] of entries) {
            const groupIds = slot.orderedGroupIds ?? []
            if (!groupIds.length) continue
            const s: ScheduleSlot = {
              seq: seq++,
              dayName: day.name ?? null,
              blockName: block.name ?? null,
              blockTime: firstLine(block.description),
              eventName: event.name ?? null,
              platformId,
              platformName: platformName.get(platformId) ?? null,
              groupPos: 0,
              groupCount: groupIds.length,
              danceId: sd.danceId,
              groupIds,
            }
            index.slots.push(s)
            groupIds.forEach((gid, i) => {
              const key = `${gid}:${sd.danceId}`
              if (!index.byGroupDance.has(key)) {
                index.byGroupDance.set(key, { ...s, groupPos: i + 1 })
              }
            })
          }
        }
      }
    }
  }
  indexCache.set(schedule, index)
  return index
}

function firstLine(text: string | undefined): string | null {
  if (!text) return null
  const line = text.replace(/<[^>]*>/g, ' ').split('\n')[0]?.trim()
  return line ? line.slice(0, 40) : null
}

function isPosted(results: ResultsTree, groupId: string, danceId: string): boolean {
  const raw = results?.[groupId]?.[danceId]
  return raw === false || (Array.isArray(raw) && raw.length > 0)
}

export function dancerDay(
  dancer: EnrichedDancer,
  bundle: DayBundle,
  phase: Phase,
): DancerDay {
  const group = dancer.group ?? null
  const empty: DancerDay = {
    dancer,
    group,
    phase,
    dances: [],
    overall: null,
    calledBack: null,
    next: null,
    resultsIn: 0,
  }
  if (!group) return empty

  const { results, points, draws } = bundle
  const index = scheduleIndex(bundle.schedule, bundle.platforms)
  const groupDances = findGroupDances(group, bundle.dances)

  const drawFor = (danceId: string) => {
    const list = draws?.[group.id]?.[danceId]
    if (!Array.isArray(list) || dancer.number == null) return { pos: null, size: null }
    const i = list.map(String).indexOf(String(dancer.number))
    return { pos: i >= 0 ? i + 1 : null, size: list.length }
  }

  // Order by schedule where known, else by the admin's dance order.
  const rows = groupDances
    .map((dance, i) => ({ dance, slot: index.byGroupDance.get(`${group.id}:${dance.id}`) ?? null, i }))
    .sort((a, b) => (a.slot?.seq ?? 1e6 + a.i) - (b.slot?.seq ?? 1e6 + b.i))

  // "Danced" = posted, or something later on the same platform is posted.
  const postedSeqByPlatform = new Map<string, number>()
  if (phase === 'today') {
    for (const s of index.slots) {
      if (s.groupIds.some((gid) => isPosted(results, gid, s.danceId))) {
        postedSeqByPlatform.set(
          s.platformId,
          Math.max(postedSeqByPlatform.get(s.platformId) ?? -1, s.seq),
        )
      }
    }
  }
  const lastPostedRow = rows.reduce(
    (last, r, i) => (isPosted(results, group.id, r.dance.id) ? i : last),
    -1,
  )

  let foundNext = false
  const statuses: DanceStatus[] = rows.map(({ dance, slot }, i) => {
    const { place, tied, pointed } = getDancerPlace(dancer.id, group.id, dance.id, results, points)
    const draw = drawFor(dance.id)
    const base = { dance, place, tied, pointed, slot, drawPos: draw.pos, drawSize: draw.size }
    const raw = results?.[group.id]?.[dance.id]
    if (raw === false) return { ...base, state: 'no-placings' as const }
    if (Array.isArray(raw) && raw.length) {
      return { ...base, state: place != null ? ('placed' as const) : ('unplaced' as const) }
    }
    if (phase === 'before') return { ...base, state: 'upcoming' as const }
    if (phase === 'after') return { ...base, state: 'not-posted' as const }
    const danced =
      i < lastPostedRow ||
      (slot != null && (postedSeqByPlatform.get(slot.platformId) ?? -1) > slot.seq)
    if (danced) return { ...base, state: 'waiting' as const }
    if (!foundNext) {
      foundNext = true
      return { ...base, state: 'next' as const }
    }
    return { ...base, state: 'later' as const }
  })

  let overall: DanceStatus | null = null
  if (groupHasOverall(group)) {
    const { place, tied, pointed } = getDancerPlace(dancer.id, group.id, OVERALL_ID, results, points)
    const raw = results?.[group.id]?.[OVERALL_ID]
    const posted = raw === false || (Array.isArray(raw) && raw.length > 0)
    overall = {
      dance: { id: OVERALL_ID, fullName: 'Overall' },
      state: posted ? (raw === false ? 'no-placings' : place != null ? 'placed' : 'unplaced') : phase === 'after' ? 'not-posted' : 'later',
      place,
      tied,
      pointed,
      slot: null,
      drawPos: null,
      drawSize: null,
    }
  }

  const callbacks = results?.[group.id]?.[CALLBACKS_ID]
  const calledBack = Array.isArray(callbacks) && callbacks.length ? callbacks.includes(dancer.id) : null

  return {
    dancer,
    group,
    phase,
    dances: statuses,
    overall,
    calledBack,
    next: statuses.find((s) => s.state === 'next') ?? null,
    resultsIn: statuses.filter((s) => ['placed', 'unplaced', 'no-placings'].includes(s.state)).length,
  }
}

/** The best (lowest) placing across a day, for share cards and summaries. */
export function bestPlacing(day: DancerDay): DanceStatus | null {
  const placed = [...day.dances, ...(day.overall ? [day.overall] : [])].filter(
    (s) => s.state === 'placed' && s.place != null,
  )
  if (!placed.length) return null
  return placed.reduce((best, s) => (s.place! < best.place! ? s : best))
}
