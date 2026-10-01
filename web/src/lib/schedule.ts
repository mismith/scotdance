import type {
  EnrichedDance,
  ScheduleBlock,
  ScheduleDance,
  ScheduleDay,
  ScheduleEvent,
  SchedulePlatform,
} from '@/types/competition'
import { compareKeys } from '@/lib/competitionData'
import { formatWeekday, parseDate } from '@/lib/format'
import { stripTags } from '@/lib/sanitize'

interface Ordered {
  id: string
  order?: number
}

export function toOrderedArray<V extends Record<string, unknown>>(
  record: Record<string, V> | null | undefined,
): Array<V & { id: string }> {
  if (!record) return []
  return Object.entries(record)
    .filter(([, value]) => value && typeof value === 'object')
    .map(([id, value]) => ({ id, ...(value as V) }))
    .sort((a, b) => {
      const ao = (a as unknown as Ordered).order
      const bo = (b as unknown as Ordered).order
      if (Number.isInteger(ao) && Number.isInteger(bo)) {
        return (ao as number) - (bo as number)
      }
      return compareKeys(a.id, b.id)
    })
}

/**
 * A stored list of ids as strings: an array, or an object if it was ever
 * saved sparse. Old spacers are numbers (timestamps).
 */
export function idList(v: unknown): string[] {
  const values = Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []
  return values.filter((x) => x != null && x !== '').map(String)
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

/** An event's dances in order, each platform's age groups and judges as plain id lists. */
export function dances(event: Pick<ScheduleEvent, 'dances'>): ScheduleDance[] {
  return toOrderedArray(event.dances).map((d) =>
    d.platforms && typeof d.platforms === 'object'
      ? {
          ...d,
          platforms: Object.fromEntries(
            Object.entries(d.platforms)
              .filter(([, p]) => p && typeof p === 'object')
              .map(([id, p]): [string, SchedulePlatform] => [
                id,
                { orderedGroupIds: idList(p.orderedGroupIds), orderedJudgeIds: idList(p.orderedJudgeIds) },
              ]),
          ),
        }
      : d,
  )
}

/** Spacers (gaps between age groups on a platform) have all-digit ids. */
export const isSpacerId = (id: string) => /^\d+$/.test(id)

/** A day's heading: its name, else its date's weekday, else "Day 2". */
export function dayLabel(day: { name?: string; date?: number | string | null }, index: number): string {
  const date = day.date
  const weekday =
    date != null && date !== '' && !Number.isNaN(parseDate(date).getTime()) ? formatWeekday(date) : ''
  return day.name?.trim() || weekday || `Day ${index + 1}`
}

/**
 * A platform's name as people see it: "B" → "Platform B". Names that already
 * say "Platform" aren't doubled, and a leading "=" shows the rest as is
 * ("=Main hall" → "Main hall"), as in the old app.
 */
export function platformLabel(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  if (!n) return ''
  if (n.startsWith('=')) return n.slice(1).trim()
  const rest = n.replace(/^platform\b\s*/i, '')
  return rest ? `Platform ${rest}` : 'Platform'
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
  // Strip any organizer-authored HTML before truncating to a single line —
  // tags would otherwise survive as literal text or, worse, break truncate.
  return stripTags(text).split('\n')[0]?.trim() ?? ''
}
