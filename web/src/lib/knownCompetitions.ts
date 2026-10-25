import { parseDate } from '@/lib/format'
import type { CountryChoice } from '@/lib/submitCountries'

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
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY)

/** On the day, or a day either side (sources disagree), for any of the days it runs. */
export function near(day: string, first: string, last = first) {
  return first <= addDays(day, 1) && last >= addDays(day, -1)
}

/**
 * In the country chosen, as far as anyone can tell: one with no country yet
 * could be anywhere, and a UK one that doesn't say which nation could be in
 * any of them.
 */
export function inCountry(choice: Pick<CountryChoice, 'iso' | 'region'> | null, at: { country?: string | null; region?: string | null }) {
  if (!choice || !at.country) return true
  if (at.country !== choice.iso) return false
  return !choice.region || !at.region || at.region.toLowerCase() === choice.region.toLowerCase()
}

// Likeness ------------------------------------------------------------------------

const FILLER = new Set(
  'the and of in at for to on competition competitions highland dance dancing dancers dancer association assoc society annual school'.split(' '),
)
/** The words that tell competitions apart: "W&DHDA 9th Annual Winter" → wdhda, winter. */
export function words(s = '') {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/([A-Z])&([A-Z])/g, '$1$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 1 && !FILLER.has(w) && !/^\d+(st|nd|rd|th)?$/.test(w))
}
/** Shared words over the shorter side's: a long listed title still matches a short name here. */
function overlap(a: string[], b: string[]) {
  if (!a.length || !b.length) return 0
  const set = new Set(b)
  return new Set(a.filter((w) => set.has(w))).size / Math.min(new Set(a).size, set.size)
}
/** The same competition, near enough: its name, venue and town alike (from the 2026 SDC list against what's here). */
export function sameCompetition(known: KnownCompetition, here: HereCompetition) {
  const town = words(known.locality)
  const score =
    overlap(words(known.name), words(here.name)) * 2 +
    overlap(words(known.venue), words(here.venue)) * 1.5 +
    (town.length && overlap(town, words(here.location ?? here.locality)) === 1 ? 0.5 : 0)
  return score >= 1.5
}

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

/** "Calgary, AB", as the app writes a town (a UK one's nation isn't added); nothing without a town. */
export const townOf = (k: { locality?: string; region?: string }) =>
  k.locality ? [k.locality, k.region && /^[A-Z]{2,3}$/.test(k.region) ? k.region : null].filter(Boolean).join(', ') : ''
