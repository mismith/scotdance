import { compareKeys } from '@/lib/competitionData'
import { formatDateTime, formatExternalURL, formatHumanURL, isPast } from '@/lib/format'
import type { Competition, CompetitionLink } from '@/types/competition'

// What a competition's Overview shows from its record: its links and files,
// registration, directions. Shared with Manage › Details' preview, so the
// preview is what people will see.

export interface LinkItem extends CompetitionLink {
  id: string
  url: string
}

/** Links and files, in the organiser's order. Stored keyed by push id; some old ones have no address. */
export function competitionLinks(c: Competition | null | undefined): LinkItem[] {
  return Object.entries(c?.links ?? {})
    .flatMap(([id, l]) => (l && typeof l === 'object' && l.url ? [{ ...l, id, url: l.url }] : []))
    .sort((a, b) => (a._order ?? Infinity) - (b._order ?? Infinity) || compareKeys(a.id, b.id))
}

/** An unnamed uploaded file reads as its file name, not a long storage address. */
export function linkLabel(link: { name?: string; url: string }): string {
  if (link.name?.trim()) return link.name.trim()
  try {
    const u = new URL(formatExternalURL(link.url))
    if (u.hostname.startsWith('firebasestorage.')) return decodeURIComponent(u.pathname).split('/').at(-1) || 'File'
  } catch {
    /* not a full address: show it as typed */
  }
  return formatHumanURL(link.url)
}

export function registrationLines(c: Competition | null | undefined): string[] {
  if (!c) return []
  const lines: string[] = []
  if (c.registrationStart)
    lines.push(`Registration ${isPast(c.registrationStart) ? 'opened' : 'opens'} ${formatDateTime(c.registrationStart)}`)
  if (c.registrationEnd)
    lines.push(`Registration ${isPast(c.registrationEnd) ? 'closed' : 'closes'} ${formatDateTime(c.registrationEnd)}`)
  return lines
}

export function registrationOpen(c: Competition | null | undefined): boolean {
  const end = c?.registrationEnd
  return end == null || !isPast(end)
}

export function mapsHref(c: Competition | null | undefined): string | null {
  if (!c?.venue && !c?.address && !c?.location) return null
  const parts = [c.venue, c.address, c.location].filter(Boolean).join(', ')
  return `https://maps.google.com/?q=${encodeURIComponent(parts)}`
}
