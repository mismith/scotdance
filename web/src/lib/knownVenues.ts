import { child, get } from 'firebase/database'
import { dataRef } from '@/firebase'
import { normalizeEntityName } from '@/lib/entityIndex'
import { parseDate } from '@/lib/format'
import type { VenueFields } from '@/lib/maps'

// Venues the app already knows (the slim `venues:index`), offered before
// Google's suggestions when someone types a venue in. Picking one gives the
// competition that venue's name and town exactly as the app has them, so it
// joins that venue instead of starting another one spelled a little
// differently. (System admin › Venues merges the ones that already did.)

export interface KnownVenueRow {
  id: string
  name: string
  locality: string | null
  region: string | null
  country: string | null
  count: number
}

const SAME_WORD: Record<string, string> = { center: 'centre', theater: 'theatre', st: 'saint', ste: 'sainte' }
const FILLER = new Set(['the', 'and', 'of', 'at'])

/**
 * A venue's name with the usual spelling differences taken out: apostrophes,
 * Center/Centre, Theater/Theatre, St/Saint, and "the", "and", "of", "at".
 * Close enough to tell two spellings of one name apart from two names.
 */
export function looseVenueName(name: string | null | undefined): string {
  return normalizeEntityName(String(name ?? '').replace(/['’]/g, ''))
    .split(' ')
    .map((w) => SAME_WORD[w] ?? w)
    .filter((w) => w && !FILLER.has(w))
    .join(' ')
}

/**
 * The known venues matching what's typed (each word typed starts a word of
 * the venue's name or town), the most used first. Only those in `countries`
 * (ISO codes, as the venue search takes them), when given.
 */
export function matchKnownVenues(
  rows: KnownVenueRow[],
  query: string,
  countries?: string[],
  limit = 3,
): KnownVenueRow[] {
  const typed = looseVenueName(query).split(' ').filter(Boolean)
  if (!typed.length || typed.join('').length < 2) return []
  return rows
    .filter((r) => !countries?.length || !r.country || countries.includes(r.country))
    .filter((r) => {
      const words = `${looseVenueName(r.name)} ${looseVenueName(r.locality)}`.split(' ')
      return typed.every((t) => words.some((w) => w.startsWith(t)))
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}

interface Appearance {
  address?: string | null
  date?: number | string | null
}

/** "Calgary, AB": the town as competitions show it (as resolveVenue writes it). */
export const townLine = (locality?: string | null, region?: string | null) =>
  [locality, region].filter(Boolean).join(', ') || null

/**
 * A known venue as competition fields: its name, town and map position as
 * the app has them (so the competition joins it), and the address its latest
 * competition gave.
 */
export async function knownVenueFields(id: string): Promise<VenueFields> {
  const v = (await get(child(dataRef('venues'), id))).val() as
    | (Partial<Record<'name' | 'locality' | 'region' | 'country', string>> & {
        lat?: number
        lng?: number
        appearances?: Record<string, Appearance>
      })
    | null
  if (!v?.name) throw new Error('That venue isn’t in the app any more.')
  const when = (a: Appearance) => (a.date != null && a.date !== '' ? parseDate(a.date).getTime() || 0 : 0)
  const address =
    Object.values(v.appearances ?? {})
      .filter((a) => a.address)
      .sort((a, b) => when(b) - when(a))[0]?.address ?? null
  return {
    venue: v.name,
    address,
    location: townLine(v.locality, v.region),
    lat: typeof v.lat === 'number' ? v.lat : null,
    lng: typeof v.lng === 'number' ? v.lng : null,
    country: v.country ?? null,
    region: v.region ?? null,
    locality: v.locality ?? null,
  }
}
