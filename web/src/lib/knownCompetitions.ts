import { parseDate } from '@/lib/format'
import type { CountryChoice } from '@/lib/submitCountries'
import { addDays, inCountry, near, sameCompetition as alike, townOf, words } from '@shared/knownCompetitions'

// The pure parts of "is it one of these?" are shared with the assistants' add_competition (shared/knownCompetitions.ts).
export { addDays, inCountry, near, townOf, words }

// "Is it one of these?" on Add a competition (ADR 0009): what's already
// known on the day chosen, in the country chosen. The governing bodies'
// lists (functions/src/knownCompetitions.ts reads them into
// /knownCompetitions), the competitions already here, and yours from about
// a year before. A person picks; nothing is matched by itself.

export type KnownSource = 'sdc' | 'scotdance-usa' | 'rsobhd'
export const KNOWN_SOURCES: Array<{ key: KnownSource; name: string }> = [
  { key: 'sdc', name: 'ScotDance Canada' },
  { key: 'scotdance-usa', name: 'ScotDance USA' },
  { key: 'rsobhd', name: 'RSOBHD' },
]
export const sourceName = (key: string) => KNOWN_SOURCES.find((s) => s.key === key)?.name ?? key

/** A row of /knownCompetitions, with its key. */
export interface KnownCompetition {
  key: string
  source: KnownSource
  date: string
  end?: string
  name: string
  venue?: string
  address?: string
  locality?: string
  region?: string
  country?: string
  website?: string
  organisations?: Record<string, boolean>
}

/** A competition here, as the slide needs it. */
export interface HereCompetition {
  id: string
  name?: string
  date?: string | number
  venue?: string
  space?: string
  address?: string
  location?: string
  lat?: number
  lng?: number
  country?: string
  region?: string
  locality?: string
  organisations?: Record<string, boolean>
}

const DAY = 86_400_000
/** YYYY-MM-DD, whatever the date was stored as. */
export const dayOf = (value: string | number | undefined | null) => {
  if (value == null || value === '') return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = parseDate(value)
  return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY)

// Likeness ------------------------------------------------------------------------

/** The same competition, near enough: its name, venue and town alike (from the 2026 SDC list against what's here). */
export const sameCompetition = (known: KnownCompetition, here: HereCompetition) => alike(known, here)

// The groups ------------------------------------------------------------------------

export interface Suggestions {
  /** Yours from about a year before, then the known ones: what a pick fills in from. */
  yours: HereCompetition[]
  known: KnownCompetition[]
  /** Already here: picking one says so, rather than filling anything in. */
  here: HereCompetition[]
}

/**
 * What the slide offers for a day and country: yours from about a year
 * before (±3 weeks, anywhere), the known ones that aren't here already
 * (whichever list they're from), and what's here already. Nearest day first.
 */
export function suggestionsFor(
  day: string,
  choice: Pick<CountryChoice, 'iso' | 'region'> | null,
  { known, here, mine, skip = [] }: { known: KnownCompetition[]; here: HereCompetition[]; mine: HereCompetition[]; skip?: string[] },
): Suggestions {
  const closest = <T>(dayOfIt: (t: T) => string | null, to: string) => (a: T, b: T) =>
    Math.abs(daysBetween(dayOfIt(a) ?? to, to)) - Math.abs(daysBetween(dayOfIt(b) ?? to, to))
  const there = here.filter((c) => {
    const d = dayOf(c.date)
    return d && near(day, d) && inCountry(choice, c) && !skip.includes(c.id)
  })
  const listed = known.filter(
    (k) => near(day, k.date, k.end) && inCountry(choice, k) && !skip.includes(k.key) && !there.some((c) => sameCompetition(k, c)),
  )
  const lastYear = sameDayLastYear(day)
  const yours = mine
    .filter((c) => {
      const d = dayOf(c.date)
      return d && Math.abs(daysBetween(d, lastYear)) <= 21
    })
    .sort(closest((c) => dayOf(c.date), lastYear))
  return {
    yours,
    known: listed.sort(closest((k) => k.date, day)),
    here: there.sort(closest((c) => dayOf(c.date), day)),
  }
}
export const anySuggestions = (s: Suggestions | null) => !!s && (s.yours.length > 0 || s.known.length > 0 || s.here.length > 0)

/** The same day a year before (Feb 29 → Feb 28). */
export function sameDayLastYear(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  const back = new Date(Date.UTC(y - 1, m - 1, d))
  if (back.getUTCMonth() !== m - 1) back.setUTCDate(0)
  return back.toISOString().slice(0, 10)
}

/**
 * A name with its years moved on, for the same competition a year later:
 * "Fall Classic 2026" → "Fall Classic 2027", "2026-27 Winter Series" →
 * "2027-28 Winter Series".
 */
export function movedOn(name: string, years: number) {
  if (!years) return name
  return name.replace(/\b((?:19|20)\d\d)(?:([-–/])(\d\d))?\b/g, (_, year: string, dash?: string, end?: string) => {
    const moved = String(Number(year) + years)
    return dash && end ? `${moved}${dash}${String((Number(end) + years) % 100).padStart(2, '0')}` : moved
  })
}
