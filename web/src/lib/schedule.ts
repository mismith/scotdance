import type {
  EnrichedDance,
  ScheduleBlock,
  ScheduleDance,
  ScheduleDay,
  ScheduleEvent,
} from '@/types/competition'

interface Ordered {
  id: string
  order?: number
}

export function toOrderedArray<V extends Record<string, unknown>>(
  record: Record<string, V> | null | undefined,
): Array<V & { id: string }> {
  if (!record) return []
  return Object.entries(record)
    .map(([id, value]) => ({ id, ...(value as V) }))
    .sort((a, b) => {
      const ao = (a as unknown as Ordered).order
      const bo = (b as unknown as Ordered).order
      if (Number.isInteger(ao) && Number.isInteger(bo)) {
        return (ao as number) - (bo as number)
      }
      return a.id.localeCompare(b.id)
    })
}

export function days(
  schedule: { days?: Record<string, Omit<ScheduleDay, 'id'>> } | null,
): ScheduleDay[] {
  return toOrderedArray(schedule?.days)
}

export function blocks(day: Pick<ScheduleDay, 'blocks'>): ScheduleBlock[] {
  return toOrderedArray(day.blocks)
}

export function events(block: Pick<ScheduleBlock, 'events'>): ScheduleEvent[] {
  return toOrderedArray(block.events)
}

export function dances(event: Pick<ScheduleEvent, 'dances'>): ScheduleDance[] {
  return toOrderedArray(event.dances)
}

export function getScheduleDanceName(
  item: ScheduleDance,
  dancesList: EnrichedDance[],
): string {
  if (item.name?.trim()) return item.name.trim()
  if (item.danceId) {
    const match = dancesList.find((d) => d.id === item.danceId)
    if (match) return match.fullName
  }
  return ''
}

export function slugline(text: string | undefined): string {
  if (!text) return ''
  return text.split('\n')[0]?.trim() ?? ''
}
