import { seasonOf } from '@/lib/dancerProgress'
import { STANDARD_DANCES, key, standardDance } from '@/lib/standardDances'

// A dancer's placings grouped by dance for the profile's "By dance" view.
// Organisers type dance names freely ("FLING", "Fling (4)", "Trophy
// Hornpipe"), so grouping happens here, on the way to the screen; the
// data keeps what was typed.

export interface DanceMark {
  competitionId: string
  entryId: string
  /** ms since epoch (the caller converts with parseDate). */
  date: number
  competitionName: string
  /** The dance's name as the organiser typed it ('Overall' for overall). */
  rawName: string
  /** null = danced, not placed. */
  place: number | null
  tied: boolean
}

export interface DanceRow {
  /** Stable id for v-for. */
  key: string
  name: string
  standard: boolean
  /** Other spellings seen in this row, most common first. */
  aka: string[]
  /** Times danced. */
  count: number
  /** Oldest season first (by the year it starts), marks oldest first. */
  years: Array<{ year: number; marks: DanceMark[] }>
}

// Words that make a standard dance a special occasion of it: "Trophy Fling",
// "Special Event Hornpipe", "Highland Fling Championship". Longest first so
// "special event" goes before "special".
const VARIANT_WORDS =
  /\b(?:special event|trophy dance|dance[\s-]?off|trophy|special|title|championship|premiership|challenge|section)\b/gi

/**
 * What a typed dance name is, for grouping. Standard dances (and their
 * special-event variants) share one row each; anything else groups with
 * names that differ only in case, apostrophes and spacing.
 */
export function danceName(raw: string): { key: string; name: string; standard: boolean; variant: boolean } {
  const typed = raw.trim()
  if (typed.toLowerCase() === 'overall') return { key: 'overall', name: 'Overall', standard: false, variant: false }
  const exact = standardDance(typed)
  if (exact) return { key: `std:${exact.dance.name}`, name: exact.dance.name, standard: true, variant: false }
  const stripped = typed
    .replace(VARIANT_WORDS, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—:,&/]+|[\s\-–—:,&/]+$/g, '')
  const folded = stripped && stripped !== typed ? standardDance(stripped) : null
  if (folded) return { key: `std:${folded.dance.name}`, name: folded.dance.name, standard: true, variant: true }
  return { key: `raw:${key(typed)}`, name: typed, standard: false, variant: false }
}

const orderOf = (r: DanceRow) => {
  const i = STANDARD_DANCES.findIndex((d) => `std:${d.name}` === r.key)
  return i < 0 ? STANDARD_DANCES.length : i
}

function toRow(rowKey: string, marks: DanceMark[], standardName?: string): DanceRow {
  const sorted = [...marks].sort((a, b) => a.date - b.date)
  const spellings = new Map<string, number>()
  for (const m of sorted) {
    const s = m.rawName.trim()
    spellings.set(s, (spellings.get(s) ?? 0) + 1)
  }
  // Most common first; ties keep the order they were first seen.
  const common = [...spellings.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
  const name = standardName ?? common[0] ?? ''
  const years: DanceRow['years'] = []
  for (const m of sorted) {
    const year = seasonOf(m.date)
    const last = years[years.length - 1]
    if (last?.year === year) last.marks.push(m)
    else years.push({ year, marks: [m] })
  }
  return {
    key: rowKey,
    name,
    standard: standardName != null,
    // "FLING" and "Fling" are one spelling here, so list the first of each.
    aka: common.filter((s, i) => s.toLowerCase() !== name.toLowerCase() && common.findIndex((c) => c.toLowerCase() === s.toLowerCase()) === i),
    count: sorted.length,
    years,
  }
}

/** One row per dance, most danced first; Overall kept apart. */
export function groupByDance(marks: DanceMark[]): { dances: DanceRow[]; overall: DanceRow | null } {
  const groups = new Map<string, { marks: DanceMark[]; standardName?: string }>()
  for (const m of marks) {
    const d = danceName(m.rawName)
    const g = groups.get(d.key) ?? { marks: [], standardName: d.standard ? d.name : undefined }
    g.marks.push(m)
    groups.set(d.key, g)
  }
  const rows = [...groups.entries()].map(([k, g]) => toRow(k, g.marks, g.standardName))
  const overall = rows.find((r) => r.key === 'overall') ?? null
  const dances = rows
    .filter((r) => r.key !== 'overall')
    .sort((a, b) => b.count - a.count || orderOf(a) - orderOf(b) || a.name.localeCompare(b.name))
  return { dances, overall }
}
