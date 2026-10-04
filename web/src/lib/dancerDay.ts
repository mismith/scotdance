import { blocks, dances as scheduleDances, days, events, isSpacerId } from '@/lib/schedule'
import { CALLBACKS_ID, findGroupDances, getDancerPlace, isPosted } from '@/lib/results'
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
//   upcoming            still to dance, as far as anyone can tell
//   later               Overall, until it's posted
// There's no "next": plenty of competitions post nothing until the end, so a
// guess at what's on now would often be wrong. Upcoming dances show what the
// schedule says (platform, session, time, draw) instead. After the day, anything
// never posted is "not-posted".

export type Phase = 'before' | 'today' | 'after'

export type DanceState =
  | 'placed'
  | 'unplaced'
  | 'no-placings'
  | 'waiting'
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
  /** The event's own start time, from its description, when it has one. */
  eventTime: string | null
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
  resultsIn: number
}

export interface DayBundle {
  dances: EnrichedDance[]
  results: ResultsTree
  points: PointsTree
  schedule: Schedule | null
  platforms: Platform[]
  draws: DrawsTree
  /** The competition's age groups: a schedule can still list deleted ones. */
  groups?: Array<{ id: string }>
}

/**
 * Calendar days from today to a competition's first and last day (negative
 * = past). The last is its last schedule day: the day's own date where it
 * has one, otherwise days follow on from the competition's date.
 */
export function competitionSpan(
  date: number | string | null | undefined,
  schedule?: Schedule | null,
): { first: number; last: number } | null {
  const first = daysFromToday(date ?? null)
  if (first == null || !Number.isFinite(first)) return null
  let last = first
  days(schedule ?? null).forEach((day, i) => {
    const own = day.date ? daysFromToday(day.date) : null
    // A stray date nowhere near the competition (old test data) doesn't stretch it.
    const at = own != null && own >= first && own - first <= 14 ? own : first + i
    last = Math.max(last, at)
  })
  return { first, last }
}

/** Pass the schedule so every day of a multi-day competition counts as today. */
export function competitionPhase(date: number | string | null | undefined, schedule?: Schedule | null): Phase {
  const span = competitionSpan(date, schedule)
  if (!span || span.first > 0) return 'before'
  if (span.last < 0) return 'after'
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

// Per schedule, and per platforms list: a platform renamed or reordered on
// the day arrives as a new list with the same schedule.
const indexCache = new WeakMap<Schedule, { platforms: Platform[]; index: ScheduleIndex }>()

export function scheduleIndex(schedule: Schedule | null, platforms: Platform[]): ScheduleIndex {
  const empty: ScheduleIndex = { slots: [], byGroupDance: new Map() }
  if (!schedule) return empty
  const hit = indexCache.get(schedule)
  if (hit && hit.platforms === platforms) return hit.index
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
            // Spacers (gaps between age groups) aren't groups.
            const groupIds = (slot.orderedGroupIds ?? []).filter((g) => !isSpacerId(g))
            if (!groupIds.length) continue
            const s: ScheduleSlot = {
              seq: seq++,
              dayName: day.name ?? null,
              blockName: block.name ?? null,
              blockTime: firstLine(block.description),
              eventName: event.name ?? null,
              eventTime: firstLine(event.description),
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
  indexCache.set(schedule, { platforms, index })
  return index
}

function firstLine(text: string | undefined): string | null {
  if (!text) return null
  const line = text.replace(/<[^>]*>/g, ' ').split('\n')[0]?.trim()
  return line ? line.slice(0, 40) : null
}

// A Championship start on its own ("reverse:6", nobody placed yet) isn't posted.
const postedAt = (results: ResultsTree, groupId: string, danceId: string) => isPosted(results?.[groupId]?.[danceId])

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
  // "Group 2 of 3" among the age groups that still exist.
  const known = bundle.groups?.length ? new Set(bundle.groups.map((g) => g.id)) : null
  const slotFor = (danceId: string): SlotInfo | null => {
    const s = index.byGroupDance.get(`${group.id}:${danceId}`)
    if (!s || !known) return s ?? null
    const real = s.groupIds.filter((g) => known.has(g) || g === group.id)
    return { ...s, groupPos: real.indexOf(group.id) + 1, groupCount: real.length }
  }

  const rows = groupDances
    .map((dance, i) => ({ dance, slot: slotFor(dance.id), i }))
    .sort((a, b) => (a.slot?.seq ?? 1e6 + a.i) - (b.slot?.seq ?? 1e6 + b.i))

  // "Danced" = posted, or something later on the same platform is posted.
  const postedSeqByPlatform = new Map<string, number>()
  if (phase === 'today') {
    for (const s of index.slots) {
      if (s.groupIds.some((gid) => postedAt(results, gid, s.danceId))) {
        postedSeqByPlatform.set(
          s.platformId,
          Math.max(postedSeqByPlatform.get(s.platformId) ?? -1, s.seq),
        )
      }
    }
  }
  const lastPostedRow = rows.reduce(
    (last, r, i) => (postedAt(results, group.id, r.dance.id) ? i : last),
    -1,
  )

  const statuses: DanceStatus[] = rows.map(({ dance, slot }, i) => {
    const { place, tied, pointed } = getDancerPlace(dancer.id, group.id, dance.id, results, points)
    const draw = drawFor(dance.id)
    const base = { dance, place, tied, pointed, slot, drawPos: draw.pos, drawSize: draw.size }
    const raw = results?.[group.id]?.[dance.id]
    if (raw === false) return { ...base, state: 'no-placings' as const }
    if (isPosted(raw)) {
      return { ...base, state: place != null ? ('placed' as const) : ('unplaced' as const) }
    }
    if (phase === 'before') return { ...base, state: 'upcoming' as const }
    if (phase === 'after') return { ...base, state: 'not-posted' as const }
    const danced =
      i < lastPostedRow ||
      (slot != null && (postedSeqByPlatform.get(slot.platformId) ?? -1) > slot.seq)
    if (danced) return { ...base, state: 'waiting' as const }
    return { ...base, state: 'upcoming' as const }
  })

  let overall: DanceStatus | null = null
  if (groupHasOverall(group)) {
    const { place, tied, pointed } = getDancerPlace(dancer.id, group.id, OVERALL_ID, results, points)
    const raw = results?.[group.id]?.[OVERALL_ID]
    const posted = isPosted(raw)
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

// ─── Several entries, one person ────────────────────────────────────────────
// Home and the dancer page treat a person's entries at one competition (a
// Premier dancer also in a Broadsword event) as one day.

const statusesOf = (days: DancerDay[]) => days.flatMap((d) => [...d.dances, ...(d.overall ? [d.overall] : [])])

const slotOrder = (s: DanceStatus | null) => s?.slot?.seq ?? Infinity

/** Their soonest dance still to come, by the schedule (not a guess at "now"). */
export function soonestUpcoming(days: DancerDay[]): DanceStatus | null {
  return (
    days
      .flatMap((d) => d.dances)
      .filter((s) => s.state === 'upcoming')
      .sort((a, b) => slotOrder(a) - slotOrder(b))[0] ?? null
  )
}

/**
 * Where and when they start: the first scheduled dance with its time,
 * platform and place in the draw, for the night before.
 */
export function firstDance(days: DancerDay[]): DanceStatus | null {
  return (
    days
      .flatMap((d) => d.dances)
      .filter((s) => s.slot)
      .sort((a, b) => slotOrder(a) - slotOrder(b))[0] ?? null
  )
}

/**
 * How pressing a dancer's day is, most first:
 *   upcoming  dances still to come (or nothing listed yet)
 *   waiting   every dance danced, some results still to come
 *   done      every result in
 */
export type DayStage = 'upcoming' | 'waiting' | 'done'
const STAGES: DayStage[] = ['upcoming', 'waiting', 'done']

export function dayStage(days: DancerDay[]): DayStage {
  const all = statusesOf(days)
  if (!days.some((d) => d.dances.length) || all.some((s) => s.state === 'upcoming')) return 'upcoming'
  if (all.some((s) => s.state === 'waiting' || s.state === 'later')) return 'waiting'
  return 'done'
}

/** Most pressing first; among those still to dance, the soonest by the schedule. */
export function compareDays(a: DancerDay[], b: DancerDay[]): number {
  const stage = STAGES.indexOf(dayStage(a)) - STAGES.indexOf(dayStage(b))
  if (stage) return stage
  const na = soonestUpcoming(a)
  const nb = soonestUpcoming(b)
  return slotOrder(na) - slotOrder(nb) || (na?.drawPos ?? 99) - (nb?.drawPos ?? 99)
}

/** Every placing across their entries, in dancing order, Overall last. */
export function placings(days: DancerDay[]): DanceStatus[] {
  return [...days.flatMap((d) => d.dances), ...days.flatMap((d) => (d.overall ? [d.overall] : []))].filter(
    (s) => s.state === 'placed' && s.place != null,
  )
}
