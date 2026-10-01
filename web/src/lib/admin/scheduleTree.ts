import type { Schedule, ScheduleDance } from '@/types/competition'

/** Visit every dance item in the schedule with its path under competitions:data/{id}. */
export function forEachScheduleDance(
  schedule: Schedule | null | undefined,
  visit: (path: string, item: Omit<ScheduleDance, 'id'>) => void,
) {
  for (const [dayId, day] of Object.entries(schedule?.days ?? {}))
    for (const [blockId, block] of Object.entries(day?.blocks ?? {}))
      for (const [eventId, event] of Object.entries(block?.events ?? {}))
        for (const [itemId, item] of Object.entries(event?.dances ?? {}))
          if (item) visit(`schedule/days/${dayId}/blocks/${blockId}/events/${eventId}/dances/${itemId}`, item)
}
