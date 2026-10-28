import type { SheetPage, SheetsTree } from '@/types/competition'

// Judges' sheets: what the scrutineer posts after a dance (often taped to a
// wall at the venue), showing how each judge placed the dancers. Organisers
// add a photo of it, or its PDF, page by page in Manage › Results; everyone
// sees it under that dance's placings. See ADR 0013.

/** At most this many pages per dance: a sheet is a page or two. */
export const MAX_SHEET_PAGES = 6

/** A dance's pages in order, skipping anything that isn't a page (hand edits). */
export function sheetPages(tree: SheetsTree | null | undefined, groupId: string, danceId: string): SheetPage[] {
  const pages = tree?.[groupId]?.[danceId]
  if (!pages || typeof pages !== 'object') return []
  return Object.entries(pages)
    .filter(([, p]) => p && typeof p === 'object' && typeof p.url === 'string' && p.width > 0 && p.height > 0)
    .map(([id, p]) => ({ ...p, id }))
    .sort(byOrder)
}

// As the other lists: `_order` first, then push id (creation order) byte by byte.
function byOrder(a: SheetPage, b: SheetPage) {
  const ao = a._order ?? Number.POSITIVE_INFINITY
  const bo = b._order ?? Number.POSITIVE_INFINITY
  if (ao !== bo) return ao - bo
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** "2 pages", or nothing for one. */
export const pageCount = (n: number) => (n > 1 ? `${n} pages` : '')

/** Said before deleting a dance or an age group that has any: Undo brings back the rest, not these. */
export const sheetsGoForGood = (n: number) =>
  `${n === 1 ? 'Its judges’ sheets go' : 'Their judges’ sheets go'} for good: Undo won’t bring them back.`
