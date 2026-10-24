import { normalizeEntityName, venueKey } from '@/lib/entityIndex'
import { parseDate } from '@/lib/format'
import { looseVenueName, townLine } from '@/lib/knownVenues'
import type { VenueFields } from '@/lib/maps'
import { haversineMeters } from '@/lib/venues'
import type { Competition } from '@/types/competition'

// Duplicate venues (System admin › Venues). A venue is every listed
// competition whose name and town match once tidied (ADR 0003 §6), so one
// place typed two ways ("Centre"/"Center", a town left out) is two venues.
// This finds the ones that look like one place, sorts them by how sure that
// is, and merges them the only way that lasts: every competition in the
// group takes one name, address, town and map position (Google's, when it
// knows the place), so the venue triggers move them over, and anyone
// following a merged venue follows the kept one instead.

export const VENUE_FIELDS = ['venue', 'address', 'location', 'lat', 'lng', 'country', 'region', 'locality'] as const

export type CompetitionRecord = Competition & { venueId?: string }

export interface Venue {
  id: string
  /** Its identity key (name|town), as the venue triggers make it. */
  key: string
  /** Each field from its latest competition that has one. */
  fields: VenueFields
  competitionIds: string[]
}

/** Who follows what: users:favorites/{uid}/{type}/{id}. */
export type Favorites = Record<string, { venues?: Record<string, string | boolean> } | null>

/** Pairs marked as different places: venues:distinct/{id}/{otherId}, the lower id first. */
export type Distinct = Record<string, Record<string, boolean>>

const when = (c: CompetitionRecord) => (c.date != null ? parseDate(c.date).getTime() || 0 : 0)

/** The venues, as the listed competitions that point at them make them up. */
export function venuesFrom(comps: Record<string, CompetitionRecord>): Venue[] {
  const byId = new Map<string, Array<[string, CompetitionRecord]>>()
  for (const [id, c] of Object.entries(comps)) {
    if (!c || typeof c.venueId !== 'string' || !(c.listed || c.published)) continue
    byId.set(c.venueId, [...(byId.get(c.venueId) ?? []), [id, c]])
  }
  return [...byId].map(([id, list]) => {
    const latest = [...list].sort(([, a], [, b]) => when(b) - when(a))
    const fields = Object.fromEntries(
      VENUE_FIELDS.map((f) => [f, latest.find(([, c]) => c[f] != null && c[f] !== '')?.[1][f] ?? null]),
    ) as unknown as VenueFields
    return { id, key: venueKey(fields.venue, fields.locality), fields, competitionIds: latest.map(([cid]) => cid) }
  })
}

/** Metres between two map positions, if both have one. */
const metres = (a: VenueFields, b: VenueFields) =>
  a.lat == null || a.lng == null || b.lat == null || b.lng == null ? null : haversineMeters(a.lat, a.lng, b.lat, b.lng)

/** Pins this close are one place (a pin goes on the building, or its street number). */
const SAME_PLACE_M = 150
/** A name spelled the same way this close is one place (a town left out, say). */
const SAME_NAME_M = 25_000
/** Pins this close are one spot (the same address). */
const SAME_SPOT_M = 25
/** Google's place is the group's when it's this close to one of its pins. */
const GOOGLE_FITS_M = 300

const isDistinct = (distinct: Distinct, a: string, b: string) =>
  a < b ? !!distinct[a]?.[b] : !!distinct[b]?.[a]

const pairsOf = <T>(list: T[]) => list.flatMap((a, i) => list.slice(i + 1).map((b) => [a, b] as const))

/** Venues that look like one place, in groups, the most used of each first. */
export function duplicateGroups(venues: Venue[], distinct: Distinct = {}): Venue[][] {
  const loose = venues.map((v) => looseVenueName(v.fields.venue))
  const parent = venues.map((_, i) => i)
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])))
  for (let i = 0; i < venues.length; i++) {
    for (let j = i + 1; j < venues.length; j++) {
      const a = venues[i]
      const b = venues[j]
      if (isDistinct(distinct, a.id, b.id)) continue
      const d = metres(a.fields, b.fields)
      const sameName =
        !!loose[i] &&
        loose[i] === loose[j] &&
        (d == null ? !a.fields.country || !b.fields.country || a.fields.country === b.fields.country : d <= SAME_NAME_M)
      if ((d != null && d <= SAME_PLACE_M) || sameName) parent[root(i)] = root(j)
    }
  }
  const groups = new Map<number, Venue[]>()
  venues.forEach((v, i) => groups.set(root(i), [...(groups.get(root(i)) ?? []), v]))
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => g.sort((a, b) => b.competitionIds.length - a.competitionIds.length || (a.fields.venue ?? '').localeCompare(b.fields.venue ?? '')))
    .sort((a, b) => (a[0].fields.venue ?? '').localeCompare(b[0].fields.venue ?? ''))
}

/** Edits to turn one string into the other. */
function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    row = next
  }
  return row[b.length]
}

/**
 * Two names for one place, by their words: the same but for a typo or two
 * ("Jubliee"), run together or in another order ("RockPointe", "Civic and
 * Conference"), or one with a word or two more ("Hyatt Regency Calgary").
 */
export function namesAlike(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = looseVenueName(a)
  const y = looseVenueName(b)
  if (!x || !y) return false
  if (distance(x, y) <= 2) return true
  const joined = (s: string) => s.replace(/ /g, '')
  const sorted = (s: string) => s.split(' ').sort().join('')
  if (sorted(x) === sorted(y)) return true
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  if (short.length < 6) return false
  const words = new Set(long.split(' '))
  return short.split(' ').every((w) => words.has(w)) || joined(long).includes(joined(short))
}

/**
 * How sure a group is: `name`, one name written differently (they can all
 * go at once); `spot`, different names at one spot (a school and the hall in
 * it, or two places at one address); `near`, pins a little apart (often
 * different buildings).
 */
export type Tier = 'name' | 'spot' | 'near'
export function tierOf(g: Venue[]): Tier {
  const pairs = pairsOf(g)
  if (pairs.every(([a, b]) => namesAlike(a.fields.venue, b.fields.venue))) return 'name'
  if (pairs.every(([a, b]) => (metres(a.fields, b.fields) ?? Infinity) <= SAME_SPOT_M)) return 'spot'
  return 'near'
}

/** Google's place for a group, if it's that place (its pin at one of theirs, or its town when none has a pin). */
export function googleFits(g: Venue[], google: VenueFields | null | undefined): google is VenueFields {
  if (!google) return false
  const pinned = g.filter((v) => v.fields.lat != null)
  if (!pinned.length) return !!google.locality && g.some((v) => normalizeEntityName(v.fields.locality ?? '') === normalizeEntityName(google.locality ?? ''))
  return pinned.some((v) => (metres(v.fields, google) ?? Infinity) <= GOOGLE_FITS_M)
}

const sameText = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && normalizeEntityName(a) === normalizeEntityName(b)

/** The one to keep: the one named as Google names the place, else the most used. */
export function defaultKeeper(g: Venue[], google?: VenueFields | null): Venue {
  if (googleFits(g, google)) {
    const named = g.filter((v) => sameText(v.fields.venue, google.venue))
    return named.find((v) => sameText(v.fields.locality, google.locality)) ?? named[0] ?? g[0]
  }
  return g[0]
}

/**
 * What every competition in the group becomes: Google's address, town and
 * pin when it knows the place, under the kept venue's name and town (as
 * Google writes them, when they're the same words), so they all join the
 * kept venue. Without Google, the kept venue's own.
 */
export function canonicalFields(keep: Venue, google?: VenueFields | null): VenueFields {
  const base = keep.fields
  if (!google) return base
  const venue = sameText(google.venue, base.venue) ? google.venue : base.venue
  const locality = sameText(google.locality, base.locality) ? google.locality : base.locality
  const region = google.region ?? base.region
  return {
    venue,
    address: google.address ?? base.address,
    location: townLine(locality, region) ?? base.location,
    lat: google.lat ?? base.lat,
    lng: google.lng ?? base.lng,
    country: google.country ?? base.country,
    region,
    locality,
  }
}

export interface DiffPart {
  text: string
  /** `diff`: in the text, not the reference; `missing`: in the reference, not the text. */
  kind: 'same' | 'diff' | 'missing'
}

/**
 * How `text` differs from `reference`, word by word (exactly: case and
 * punctuation count). A word swapped for another shows only as different,
 * so `missing` is left for words with nothing in their place.
 */
export function wordDiff(text: string | null | undefined, reference: string | null | undefined): DiffPart[] {
  const a = (text ?? '').split(/\s+/).filter(Boolean)
  const b = (reference ?? '').split(/\s+/).filter(Boolean)
  const lcs = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  }
  const parts: DiffPart[] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      parts.push({ text: a[i++], kind: 'same' })
      j++
    } else if (j >= b.length || (i < a.length && lcs[i + 1][j] >= lcs[i][j + 1])) parts.push({ text: a[i++], kind: 'diff' })
    else parts.push({ text: b[j++], kind: 'missing' })
  }
  const merged: DiffPart[] = []
  for (const p of parts) {
    const last = merged.at(-1)
    if (last?.kind === p.kind) last.text += ` ${p.text}`
    else merged.push({ ...p })
  }
  return merged.filter((p, k) => p.kind !== 'missing' || (merged[k - 1]?.kind !== 'diff' && merged[k + 1]?.kind !== 'diff'))
}

export interface Merge {
  /** The multi-path update that merges them (paths under the data namespace). */
  after: Record<string, unknown>
  /** What it replaces, to undo it. */
  before: Record<string, unknown>
  competitions: number
  followers: number
}

/**
 * Merge a group into `keep`: every competition at one of its venues
 * (unlisted ones too, by name and town, so listing one later doesn't bring
 * a merged venue back) takes `fields`, which keep the kept venue's name and
 * town. A competition that shares its venue from a linked main one is left
 * to it: the link copies the main one's over.
 */
export function mergeVenues({
  keep,
  group,
  fields,
  comps,
  synced,
  favorites,
}: {
  keep: Venue
  group: Venue[]
  fields: VenueFields
  comps: Record<string, CompetitionRecord>
  /** Competitions whose venue comes from their linked main one. */
  synced: Set<string>
  favorites: Favorites
}): Merge {
  if (venueKey(fields.venue, fields.locality) !== keep.key) throw new Error('Those fields would make another venue.')
  const after: Record<string, unknown> = {}
  const before: Record<string, unknown> = {}
  const ids = new Set(group.map((v) => v.id))
  const keys = new Set(group.map((v) => v.key).filter(Boolean))
  let competitions = 0
  for (const [id, c] of Object.entries(comps)) {
    if (!c || synced.has(id)) continue
    if (!(typeof c.venueId === 'string' && ids.has(c.venueId)) && !keys.has(venueKey(c.venue, c.locality))) continue
    let changed = false
    for (const f of VENUE_FIELDS) {
      const was = c[f] ?? null
      const now = fields[f] ?? null
      if (was === now) continue
      after[`competitions/${id}/${f}`] = now
      before[`competitions/${id}/${f}`] = was
      changed = true
    }
    if (changed) competitions += 1
  }
  let followers = 0
  for (const [uid, f] of Object.entries(favorites)) {
    const follows = f?.venues ?? {}
    const theirs = Object.keys(follows).filter((id) => id !== keep.id && ids.has(id) && follows[id])
    if (!theirs.length) continue
    followers += 1
    for (const id of theirs) {
      after[`users:favorites/${uid}/venues/${id}`] = null
      before[`users:favorites/${uid}/venues/${id}`] = follows[id]
    }
    if (!follows[keep.id]) {
      after[`users:favorites/${uid}/venues/${keep.id}`] = fields.venue ?? true
      before[`users:favorites/${uid}/venues/${keep.id}`] = null
    }
  }
  return { after, before, competitions, followers }
}

const pairPath = (a: string, b: string) => (a < b ? `venues:distinct/${a}/${b}` : `venues:distinct/${b}/${a}`)

/** Mark `id` as a different place from each of the others in its group. */
export function keepApart(id: string, others: Venue[]): Record<string, true> {
  return Object.fromEntries(others.filter((o) => o.id !== id).map((o) => [pairPath(id, o.id), true]))
}

/** Mark every venue in a group as a different place from the rest. */
export const leaveSeparate = (g: Venue[]): Record<string, true> =>
  Object.fromEntries(pairsOf(g).map(([a, b]) => [pairPath(a.id, b.id), true]))

/**
 * The venues left separate, in the groups they were left in (any marked
 * different from another, together), each with the marks that bring it back.
 */
export function separated(venues: Venue[], distinct: Distinct): Array<{ venues: Venue[]; paths: string[] }> {
  const byId = new Map(venues.map((v) => [v.id, v]))
  const parent = new Map<string, string>()
  const root = (id: string): string => {
    const p = parent.get(id) ?? id
    if (p === id) return id
    const r = root(p)
    parent.set(id, r)
    return r
  }
  const paths: Array<[string, string]> = []
  for (const [a, others] of Object.entries(distinct)) {
    for (const [b, on] of Object.entries(others ?? {})) {
      if (!on || !byId.has(a) || !byId.has(b)) continue
      for (const id of [a, b]) if (!parent.has(id)) parent.set(id, id)
      parent.set(root(a), root(b))
      paths.push([a, `venues:distinct/${a}/${b}`])
    }
  }
  const groups = new Map<string, { venues: Venue[]; paths: string[] }>()
  for (const id of parent.keys()) {
    const g = groups.get(root(id)) ?? { venues: [], paths: [] }
    g.venues.push(byId.get(id)!)
    groups.set(root(id), g)
  }
  for (const [a, path] of paths) groups.get(root(a))!.paths.push(path)
  return [...groups.values()]
    .map((g) => ({ ...g, venues: g.venues.sort((x, y) => y.competitionIds.length - x.competitionIds.length) }))
    .sort((x, y) => (x.venues[0].fields.venue ?? '').localeCompare(y.venues[0].fields.venue ?? ''))
}
