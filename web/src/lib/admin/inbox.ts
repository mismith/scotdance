import { push, serverTimestamp, set } from 'firebase/database'
import { dataRef } from '@/firebase'
import { formatRelative } from '@/lib/format'

// What the organiser's other ScotDance tools (Splits first) sent them, at
// /users:inbox/{uid}/{itemId}. Tools never write competition data: they drop
// what they made here, and Import dancers picks it up with the usual preview.

export interface InboxItem {
  id: string
  kind: 'dancers'
  /** The tool it came from, e.g. "Splits". */
  source: string
  /** File name. */
  name: string
  /** CSV, read like any pasted or chosen list. */
  text: string
  competitionId?: string
  sentAt: number
}

/** Lists of dancers for this competition, or sent without one (all of them, without a competition), newest first. */
export function inboxFor(tree: unknown, competitionId?: string): InboxItem[] {
  if (!tree || typeof tree !== 'object') return []
  return Object.entries(tree as Record<string, Partial<InboxItem>>)
    .filter(([, v]) => v?.kind === 'dancers' && typeof v.text === 'string')
    .filter(
      ([, v]) =>
        competitionId === undefined ||
        !v.competitionId ||
        v.competitionId === competitionId,
    )
    .map(([id, v]) => ({ ...(v as Omit<InboxItem, 'id'>), id }))
    .sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0))
}

const relativeTime = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
  style: 'long',
})

/** "just now", "2 minutes ago", "3 hours ago", then by the day ("yesterday"). */
export function sentAgo(sentAt: number, now = Date.now()): string {
  const minutes = Math.floor((now - sentAt) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return relativeTime.format(-minutes, 'minute')
  if (minutes < 24 * 60) return relativeTime.format(-Math.floor(minutes / 60), 'hour')
  return formatRelative(sentAt)
}

/** Drops a list into the organiser's own inbox (field by field: the rules turn away anything extra), and returns its id. */
export async function sendToInbox(
  uid: string,
  item: Pick<InboxItem, 'kind' | 'source' | 'name' | 'text'> & { competitionId: string },
): Promise<string> {
  const itemRef = push(dataRef(`users:inbox/${uid}`))
  const { kind, source, name, text, competitionId } = item
  await set(itemRef, { kind, source, name, text, competitionId, sentAt: serverTimestamp() })
  return itemRef.key!
}
