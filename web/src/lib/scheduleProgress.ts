import { blocks, dances as eventDances, days, events } from '@/lib/schedule'
import { isPosted } from '@/lib/results'
import { daysFromToday } from '@/lib/format'
import type { ResultsTree, Schedule, ScheduleEvent } from '@/types/competition'

// Where a competition has got to, from what's been posted, and nothing
// else: the data has no clock and no "on now", and times are typed by hand,
// so guessing what's on would often be wrong. An event says how many of its
// results are in, and is done once they all are.

export type EventProgress = 'done'

export interface EventCount {
  posted: number
  total: number
}

export interface ScheduleProgress {
  /** Results posted out of expected, per event id. */
  counts: Map<string, EventCount>
  /** Done, per event id (otherwise still to come, or no dances to post). */
  events: Map<string, EventProgress>
  /** Calendar days from today, per day id (0 today, 1 tomorrow). */
  dayOffset: Map<string, number>
}

/** Minutes after midnight of a time written like "8:30 am", "1 pm" or "13:00". */
export function clockMinutes(text: string | null | undefined): number | null {
  const s = text ?? ''
  const ampm = s.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*([ap])\.?\s*m\b/i)
  if (ampm) {
    const h = Number(ampm[1]) % 12
    return (ampm[3].toLowerCase() === 'p' ? h + 12 : h) * 60 + Number(ampm[2] ?? 0)
  }
  const h24 = s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
  return h24 ? Number(h24[1]) * 60 + Number(h24[2]) : null
}

export function eventCount(event: Pick<ScheduleEvent, 'dances'>, results: ResultsTree, groupIds: Set<string>): EventCount {
  let posted = 0
  let total = 0
  for (const sd of eventDances(event)) {
    if (!sd.danceId || !sd.platforms) continue
    for (const slot of Object.values(sd.platforms)) {
      for (const gid of slot.orderedGroupIds ?? []) {
        // Spacers (gaps on a platform) and deleted age groups have no results to wait for.
        if (!groupIds.has(gid)) continue
        total++
        if (isPosted(results?.[gid]?.[sd.danceId])) posted++
      }
    }
  }
  return { posted, total }
}

export function scheduleProgress(opts: {
  schedule: Schedule | null
  results: ResultsTree
  groupIds: Set<string>
  /** The competition's (first) date: days without their own follow on from it. */
  date: number | string | null | undefined
}): ScheduleProgress {
  const progress: ScheduleProgress = { counts: new Map(), events: new Map(), dayOffset: new Map() }
  const first = daysFromToday(opts.date ?? null)
  days(opts.schedule).forEach((day, i) => {
    const own = day.date ? daysFromToday(day.date) : null
    // As competitionSpan: a stray date nowhere near the competition doesn't count.
    const offset = own != null && first != null && own >= first && own - first <= 14 ? own : first != null ? first + i : null
    if (offset != null) progress.dayOffset.set(day.id, offset)

    for (const block of blocks(day))
      for (const event of events(block)) {
        const count = eventCount(event, opts.results, opts.groupIds)
        progress.counts.set(event.id, count)
        if (count.total && count.posted >= count.total) progress.events.set(event.id, 'done')
      }
  })
  return progress
}
