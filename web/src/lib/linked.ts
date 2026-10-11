import { formatDateSpan, formatMonthDay, parseDate } from '@/lib/format'

// Linked competitions (docs/adr/0007-linked-competitions.md): a weekend's
// two, or a week's seven, that their organisers linked. Families can jump
// between them, and lists keep them together. Words for families never say
// "linked": they say how many competitions and when ("7 competitions, Jul
// 5 – 11"). "Linked" is only for organisers, in Manage.

/** What a linked competition can take from its primary, in Manage's order (functions/src/links.ts PARTS). */
export const LINK_PARTS = [
  { id: 'about', label: 'Description and logo', detail: 'What families read about it, and its picture' },
  { id: 'venue', label: 'Where', detail: 'Venue and address' },
  { id: 'registration', label: 'Registration', detail: 'The link, and when it opens and closes' },
  { id: 'links', label: 'Links and files', detail: 'Programs, entry forms and other links' },
  {
    id: 'visibility',
    label: 'Listed and published',
    detail: 'Listed: families can find it in the competitions list.',
    more: 'Published: they can also see its dancers, schedule and results.',
  },
  { id: 'organisations', label: 'Organisations', detail: 'Who runs it' },
  { id: 'staff', label: 'Staff', detail: 'Judges, pipers, helpers and sponsors' },
] as const

export type LinkPart = (typeof LINK_PARTS)[number]['id']
export const LINK_PART_IDS = LINK_PARTS.map((p) => p.id) as LinkPart[]
export const linkPartLabel = (id: LinkPart) => LINK_PARTS.find((p) => p.id === id)?.label ?? id

/** /competitionLinks/{linkId}, as stored. */
export interface CompetitionLinkRecord {
  primary?: string | null
  competitions?: Record<string, boolean>
}

/** A link, read: its competitions' ids (in no particular order). */
export interface LinkedSet {
  linkId: string
  primary: string | null
  ids: string[]
}

/** Each competition's link, from the whole of /competitionLinks. */
export function setsByCompetition(links: Record<string, CompetitionLinkRecord> | null | undefined): Map<string, LinkedSet> {
  const out = new Map<string, LinkedSet>()
  for (const [linkId, link] of Object.entries(links ?? {})) {
    if (!link || typeof link !== 'object') continue
    const ids = Object.keys(link.competitions ?? {}).filter((id) => link.competitions?.[id] === true)
    if (ids.length < 2) continue
    const set: LinkedSet = { linkId, primary: link.primary ?? null, ids }
    for (const id of ids) out.set(id, set)
  }
  return out
}

interface Dated {
  id: string
  date?: number | string | null
  name?: string | null
}

const dayOf = (c: Dated) => {
  if (c.date == null || c.date === '') return Number.POSITIVE_INFINITY
  const t = parseDate(c.date).getTime()
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}

/** Date order, then name. */
export function compareByDate(a: Dated, b: Dated): number {
  return dayOf(a) - dayOf(b) || (a.name ?? '').localeCompare(b.name ?? '')
}

/** A run of rows in a list: one competition, or a linked group of them kept together. */
export interface LinkedBlock<T> {
  /** The link, when it's a group of two or more here. */
  linkId: string | null
  items: T[]
}

/**
 * Where competitions go in a list (ADR 0007 §8): date order, then name; a
 * linked group stays together at its first day, its own in date order.
 * Others on a group's first day go above it, and on its last day or after,
 * below it, so a weekend pair moves nothing. One on a group's middle day goes
 * straight after it. Two groups starting the same day stay apart, the one
 * whose first competition comes first by name first. Only the competitions
 * given are grouped: one left alone is just a row. `descending` (past ones,
 * newest first) is the same order the other way up.
 */
export function orderLinked<T extends Dated>(
  items: T[],
  linkOf: (id: string) => string | null | undefined,
  {
    descending = false,
    at = dayOf,
  }: {
    descending?: boolean
    /** Where one sits in time (a list's own reading of dates, e.g. dateless ones first). */
    at?: (item: T) => number
  } = {},
): LinkedBlock<T>[] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const linkId = linkOf(item.id)
    if (linkId) groups.set(linkId, [...(groups.get(linkId) ?? []), item])
  }
  const blocks: Array<LinkedBlock<T> & { at: number; group: boolean; name: string }> = []
  const placed = new Set<string>()
  for (const item of items) {
    const linkId = linkOf(item.id)
    const group = linkId ? groups.get(linkId) : undefined
    if (group && group.length > 1) {
      if (placed.has(linkId!)) continue
      placed.add(linkId!)
      const members = [...group].sort((a, b) => at(a) - at(b) || (a.name ?? '').localeCompare(b.name ?? ''))
      blocks.push({ linkId: linkId!, items: members, at: at(members[0]), group: true, name: members[0].name ?? '' })
    } else {
      blocks.push({ linkId: null, items: [item], at: at(item), group: false, name: item.name ?? '' })
    }
  }
  blocks.sort((a, b) => a.at - b.at || Number(a.group) - Number(b.group) || a.name.localeCompare(b.name))
  const ordered = blocks.map(({ linkId, items: rows }) => ({ linkId, items: rows }))
  if (!descending) return ordered
  return ordered.reverse().map((b) => ({ ...b, items: [...b.items].reverse() }))
}

/**
 * Keeps a ranked list's order (search results, best match first) but pulls
 * each linked group's matches together at its best match's place.
 */
export function groupInPlace<T extends Dated>(items: T[], linkOf: (id: string) => string | null | undefined): LinkedBlock<T>[] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const linkId = linkOf(item.id)
    if (linkId) groups.set(linkId, [...(groups.get(linkId) ?? []), item])
  }
  const out: LinkedBlock<T>[] = []
  const placed = new Set<string>()
  for (const item of items) {
    const linkId = linkOf(item.id)
    const group = linkId ? groups.get(linkId) : undefined
    if (group && group.length > 1) {
      if (placed.has(linkId!)) continue
      placed.add(linkId!)
      out.push({ linkId: linkId!, items: [...group].sort(compareByDate) })
    } else {
      out.push({ linkId: null, items: [item] })
    }
  }
  return out
}

/** Where a row sits on its group's rail: top, between or bottom (null when it's on its own). */
export type RailPosition = 'first' | 'middle' | 'last' | null
export function railOf(index: number, size: number): RailPosition {
  if (size < 2) return null
  if (index === 0) return 'first'
  return index === size - 1 ? 'last' : 'middle'
}

/** "7 competitions, Jul 5 – 11": a set, in families' words. */
export function setLabel(members: Dated[]): string {
  const span = formatDateSpan(members.map((m) => m.date))
  return `${members.length} competitions${span ? `, ${span}` : ''}`
}

/**
 * For one shown on its own, the line naming the rest of its set: "With
 * Maritime Open, Jul 4", or "With 6 others, Jul 5 – 11" (the whole set's
 * dates). Null when there's no one else to name.
 */
export function withOthersLine(self: Dated, members: Dated[]): string | null {
  const others = members.filter((m) => m.id !== self.id)
  if (!others.length) return null
  if (others.length === 1) {
    const [other] = others
    const day = formatMonthDay(other.date)
    return `With ${other.name?.trim() || 'another competition'}${day ? `, ${day}` : ''}`
  }
  const span = formatDateSpan([self, ...others].map((m) => m.date))
  return `With ${others.length} others${span ? `, ${span}` : ''}`
}

const sameVenue = (a?: string | null, b?: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

/** "Ailsa", "Ailsa and Mairi", "Ailsa, Mairi and Iona". */
export const listNames = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '')

/**
 * The line under one of a set, in the switcher and on Overview: Yesterday,
 * Today or Tomorrow when it is; your dancers when they're dancing in it; and
 * its venue when it isn't this one's. `tone` colours it (live on the day,
 * amber for another venue).
 */
export function memberNote(
  c: { venue?: string | null },
  { days, venue, dancers = [], current = false }: { days: number | null; venue?: string | null; dancers?: string[]; current?: boolean },
): { text: string; tone: 'live' | 'venue' | 'muted' } | null {
  const when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days === -1 ? 'Yesterday' : null
  const who = dancers.length ? `${listNames(dancers)} ${dancers.length > 1 ? 'are' : 'is'} dancing` : null
  const elsewhere = !current && c.venue?.trim() && venue?.trim() && !sameVenue(c.venue, venue) ? `Another venue: ${c.venue.trim()}` : null
  const text = [when, who, elsewhere].filter(Boolean).join(' · ')
  if (!text) return null
  return { text, tone: days === 0 ? 'live' : elsewhere ? 'venue' : 'muted' }
}

/**
 * A list's rows with their places on the rail, at most `limit` of them (a
 * group cut short keeps its rail for the ones shown). `alone`: a row not in
 * a group here, which may need its set named (withOthersLine).
 */
export function railRows<T>(blocks: LinkedBlock<T>[], limit = Number.POSITIVE_INFINITY): Array<{ item: T; rail: RailPosition; alone: boolean }> {
  const out: Array<{ item: T; rail: RailPosition; alone: boolean }> = []
  for (const b of blocks) {
    const room = limit - out.length
    if (room <= 0) break
    const items = b.items.slice(0, room)
    items.forEach((item, i) => out.push({ item, rail: railOf(i, items.length), alone: items.length === 1 }))
  }
  return out
}
