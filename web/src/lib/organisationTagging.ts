import type { Competition } from '@/types/competition'
import type { Organisation } from '@/types/organisation'

// System admin › Organisations › Tag: putting hundreds of existing
// competitions under their organisations quickly. Most competitions come
// back every year under the same name, so they're grouped into families
// ("Foothills Spring Competition", 2019 to 2026) and tagged a family at a
// time; and a family some of whose years are already tagged suggests the
// same organisations for the rest.

export interface TagCompetition extends Competition {
  id: string
}

export interface Family {
  key: string
  /** The most recent year's name, without its year. */
  name: string
  competitions: TagCompetition[]
  /** First and last years, e.g. [2019, 2026]. */
  years: [number, number] | null
  location: string | null
}

export interface Suggestion {
  organisationId: string
  /** Why, in a few words: "Tagged in 3 other years". */
  reason: string
  /** Strong ones can be accepted all at once. */
  strong: boolean
}

const ORDINAL = /\b\d+(st|nd|rd|th)\b/gi
const YEAR = /\b(19|20)\d{2}\b/g
const FILLER = /\b(the|annual|edition)\b/gi

/** "The 39th Annual Banff Highland Games 2025" and "Banff Highland Games" are one family. */
export function familyKey(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(YEAR, ' ')
    .replace(ORDINAL, ' ')
    .replace(FILLER, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** A name without its year or edition number, for the family's heading. */
export function familyName(name: string | null | undefined): string {
  return (name ?? '')
    .replace(YEAR, ' ')
    .replace(/\b(the\s+)?\d+(st|nd|rd|th)\s+annual\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\s*[-–—:,]\s*|\s*[-–—:,]\s*$/g, '')
    .trim() || (name ?? '').trim() || 'Untitled'
}

const yearOf = (c: Competition) => {
  const y = Number(String(c.date ?? '').slice(0, 4))
  return y > 1900 ? y : null
}

/** Competitions grouped by family, the most recent family first. */
export function groupFamilies(competitions: TagCompetition[]): Family[] {
  const byKey = new Map<string, TagCompetition[]>()
  for (const c of competitions) {
    const key = familyKey(c.name) || `#${c.id}`
    byKey.set(key, [...(byKey.get(key) ?? []), c])
  }
  const families = [...byKey.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
    const years = sorted.map(yearOf).filter((y): y is number => y != null)
    return {
      key,
      name: familyName(sorted[0]?.name),
      competitions: sorted,
      years: years.length ? ([Math.min(...years), Math.max(...years)] as [number, number]) : null,
      location: sorted.find((c) => c.location)?.location ?? null,
    }
  })
  return families.sort((a, b) => String(b.competitions[0]?.date ?? '').localeCompare(String(a.competitions[0]?.date ?? '')))
}

const tagged = (c: Competition) => Object.entries(c.organisations ?? {}).filter(([, on]) => on === true).map(([id]) => id)

/** The organisations every competition in a family has, and those only some have. */
export function familyTags(f: Family): { all: string[]; some: string[] } {
  const counts = new Map<string, number>()
  for (const c of f.competitions) for (const id of tagged(c)) counts.set(id, (counts.get(id) ?? 0) + 1)
  const all = [...counts.entries()].filter(([, n]) => n === f.competitions.length).map(([id]) => id)
  const some = [...counts.entries()].filter(([, n]) => n < f.competitions.length).map(([id]) => id)
  return { all, some }
}

const words = (s: string | null | undefined) => new Set(familyKey(s ?? '').split(' ').filter(Boolean))

/**
 * What a family might be missing: an organisation some of its years have
 * (strong), or one whose short name or full name is in its name.
 */
export function suggest(f: Family, organisations: Array<Organisation & { id: string }>): Suggestion[] {
  const { all, some } = familyTags(f)
  const out: Suggestion[] = some.map((id) => {
    const n = f.competitions.filter((c) => c.organisations?.[id] === true).length
    return { organisationId: id, reason: n === 1 ? 'Tagged in another year' : `Tagged in ${n} other years`, strong: true }
  })
  const have = new Set([...all, ...some])
  const nameWords = words(f.name)
  const nameKey = ` ${familyKey(f.name)} `
  for (const o of organisations) {
    if (have.has(o.id)) continue
    const short = familyKey(o.shortName)
    const full = familyKey(o.name)
    if (short && short.length >= 2 && !short.includes(' ') && nameWords.has(short)) {
      out.push({ organisationId: o.id, reason: `“${o.shortName}” is in its name`, strong: false })
    } else if (full && nameKey.includes(` ${full} `)) {
      out.push({ organisationId: o.id, reason: 'Its name is in the competition’s', strong: false })
    }
  }
  return out
}

export interface NewOrganisation {
  name: string
  shortName: string | null
  /** Where most of its competitions are: where it's probably based. */
  location: string | null
  competitions: TagCompetition[]
}

// "EHDA", "SDGHDA", "W&DHDA": three or more capitals (an & inside is fine).
const ABBREVIATION = /(?<![\p{L}&])\p{Lu}[\p{Lu}&]+\p{Lu}(?![\p{L}&])/gu
// Ones that name something else: the board that sanctions nearly every
// competition, places, and numbering.
const NOT_ORGANISATIONS = new Set(['RSOBHD', 'SOBHD', 'USA', 'PEI', 'NWT', 'III', 'VII', 'VIII', 'XII', 'XIII'])
// The national and provincial associations, however they're spelled.
const SCOTDANCE = /\bScot\s?Dance\s+(Canada|Alberta|BC|British Columbia|Saskatchewan|Manitoba|Ontario|Quebec|New Brunswick|Nova Scotia|Newfoundland|PEI)\b/i

const mostCommon = (values: Array<string | null | undefined>) => {
  const counts = new Map<string, number>()
  for (const v of values) if (v?.trim()) counts.set(v.trim(), (counts.get(v.trim()) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

/**
 * Organisations that competitions' names point to but that aren't here yet:
 * an abbreviation ("EHDA Evelyn Gerard Jones Competition") or a ScotDance
 * association ("Scotdance Alberta Open"). Most competitions first. Only
 * what's in the names: a full name for an abbreviation is for a person to add.
 */
export function organisationsInNames(competitions: TagCompetition[], organisations: Organisation[]): NewOrganisation[] {
  const known = new Set(organisations.flatMap((o) => [o.shortName, o.name]).filter(Boolean).map((s) => String(s).trim().toLowerCase()))
  const found = new Map<string, { name: string; shortName: string | null; competitions: TagCompetition[] }>()
  for (const c of competitions) {
    const name = c.name ?? ''
    // A name in capitals throughout has no abbreviations to tell apart.
    const letters = name.replace(/[^\p{L}]/gu, '')
    if (letters && name.replace(/[^\p{Lu}]/gu, '').length / letters.length > 0.6) continue
    const here: Array<{ name: string; shortName: string | null }> = []
    for (const [abbr] of name.matchAll(ABBREVIATION)) {
      if (!NOT_ORGANISATIONS.has(abbr)) here.push({ name: abbr, shortName: abbr })
    }
    const sd = name.match(SCOTDANCE)
    if (sd) here.push({ name: `ScotDance ${sd[1].replace(/\b\w/g, (l) => l.toUpperCase()).replace(/^Bc$/, 'BC').replace(/^Pei$/, 'PEI')}`, shortName: null })
    for (const org of here) {
      const key = org.name.toLowerCase()
      if (known.has(key)) continue
      const entry = found.get(key) ?? { ...org, competitions: [] }
      if (!entry.competitions.includes(c)) entry.competitions.push(c)
      found.set(key, entry)
    }
  }
  return [...found.values()]
    .map((o) => ({ ...o, location: mostCommon(o.competitions.map((c) => c.location)) }))
    .sort((a, b) => b.competitions.length - a.competitions.length || a.name.localeCompare(b.name))
}
