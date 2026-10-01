// What each first-class entity (dancers, judges, pipers, venues) feeds the
// aggregator factory. Kept free of Firebase and Typesense imports so the
// configs can be unit tested on their own (web/src/lib/__tests__).
//
// See docs/adr/0003-first-class-entities.md.

import type { AggregatorConfig } from './aggregate';
import { normalizeName } from './normalize';

// What shows where, as Manage tells organisers: "Listed: basic details are
// public; dancers, schedule and results aren't yet"; listing "shows in the
// competitions list with its date, venue and judges". Private competitions
// (neither) show nowhere.
const published = (c: { published?: unknown }) => c.published === true;
const listed = (c: { published?: unknown, listed?: unknown }) => (
  c.published === true || c.listed === true
);

// Legacy records can hold numbers (or worse) where text belongs; one odd
// record mustn't crash a trigger or a whole backfill.
const text = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');

/** "First Last" from a record or appearance. */
export function personName(p: { firstName?: unknown, lastName?: unknown }): string {
  return `${text(p.firstName)} ${text(p.lastName)}`.trim();
}

/**
 * Display fields for a person's aggregate. "Latest" is approximate — the last
 * non-null in appearance key order (competition ids grow over time), since
 * appearances don't carry a date. Profile pages still do the proper
 * date-sorted pick client-side via comp meta.
 */
interface PersonAppearance {
  firstName: unknown
  lastName: unknown
  image: unknown
  location: unknown
}
function personDisplay<A extends PersonAppearance>(apps: A[]) {
  const newest = [...apps].reverse();
  const pick = (f: 'image' | 'location') => (
    newest.find((a) => a[f] != null && a[f] !== '')?.[f] ?? null
  );
  // Both halves of the name from one appearance: "Mary Jane" + "Smith" in one
  // competition and "Mary" + "Jane Smith" in another mustn't mix, nor "Emma
  // Smith" + nothing and "Emma" + "Smith" make "Emma Smith Smith".
  const named = newest.find((a) => personName(a));
  return {
    name: named ? personName(named) : '',
    image: pick('image'),
    location: pick('location'),
  };
}

// --- Dancers

export interface DancerRecord {
  firstName?: string
  lastName?: string
  image?: string
  location?: string
  number?: number | string
  dancerId?: string
}

export interface DancerAppearance {
  competitionId: string
  dancerId: string | null
  firstName: string | null
  lastName: string | null
  image: string | null
  location: string | null
  number: number | null
}

export const dancerAggregator: AggregatorConfig<DancerRecord, DancerAppearance> = {
  namespace: 'dancers',
  sectionName: 'dancers',
  recordIdParam: 'dancerId',
  backPointerField: 'dancerId',
  // Every dancer record contributes — no type filter like staff has.
  predicate: (d): d is DancerRecord => !!d,
  // Aggregates are public; entries stay private until a competition is published.
  shownIn: published,
  nameOf: personName,
  nameFromAppearance: personName,
  toAppearance: (dancer, { competitionId, recordId }) => ({
    competitionId,
    // The per-comp dancer push key. NOT the aggregate id — that's the key of
    // /dancers/{aggregateId}/appearances/{compId:dancerId}.
    dancerId: recordId,
    firstName: dancer.firstName ?? null,
    lastName: dancer.lastName ?? null,
    image: dancer.image ?? null,
    location: dancer.location ?? null,
    number: typeof dancer.number === 'string'
      ? Number.parseInt(dancer.number, 10) || null
      : dancer.number ?? null,
  }),
  // Denorm name/image/location onto the agg root so the slim index can carry them.
  recomputeFromAppearances: personDisplay,
  slimFields: (agg) => ({
    image: agg.image ?? null,
    location: agg.location ?? null,
  }),
};

// --- Judges and pipers (staff records with a `type`)

export interface StaffRecord {
  type?: string
  firstName?: string
  lastName?: string
  location?: string
  image?: string
  description?: string
}

export interface StaffAppearance {
  competitionId: string
  staffId: string | null
  firstName: string | null
  lastName: string | null
  image: string | null
  bio: string | null
  location: string | null
}

export interface StaffEntityKind {
  /** Discriminator on `/staff/{id}.type`, e.g. 'Judge' or 'Piper'. */
  staffType: string
  /** Aggregate namespace + Typesense collection name, e.g. 'judges'. */
  namespace: string
  /** Back-pointer field written onto the source staff record. */
  backPointerField: string
}

export function staffAggregator(
  { staffType, namespace, backPointerField }: StaffEntityKind,
): AggregatorConfig<StaffRecord, StaffAppearance> {
  return {
    namespace,
    sectionName: 'staff',
    recordIdParam: 'staffId',
    backPointerField,
    predicate: (m) => !!m && m.type === staffType,
    shownIn: listed,
    nameOf: personName,
    nameFromAppearance: personName,
    toAppearance: (m, { competitionId, recordId }) => ({
      competitionId,
      staffId: recordId,
      firstName: m.firstName ?? null,
      lastName: m.lastName ?? null,
      image: m.image ?? null,
      bio: m.description ?? null,
      location: m.location ?? null,
    }),
    // Denorm name/image/location onto the agg root so the slim index can carry them.
    recomputeFromAppearances: personDisplay,
    slimFields: (agg) => ({
      image: agg.image ?? null,
      location: agg.location ?? null,
    }),
  };
}

// --- Venues: from competition meta writes. Each competition has at most one
// venue (so recordIdParam is null — the comp itself is the source record).
// Identity is composite — normalized venue + locality, so two same-named
// venues in different cities don't merge.

export interface CompRecord {
  venue?: string
  published?: boolean
  listed?: boolean
  locality?: string | null
  region?: string | null
  country?: string | null
  lat?: number | null
  lng?: number | null
  address?: string | null
  date?: number | string | null
  venueId?: string
}

export interface VenueAppearance {
  competitionId: string
  venue: string | null
  locality: string | null
  region: string | null
  country: string | null
  lat: number | null
  lng: number | null
  address: string | null
  date: number | null
}

/** A listed (or published) competition with a venue: the comp is its own record. */
function hasVenue(comp: CompRecord | null | undefined): comp is CompRecord {
  return !!(comp && typeof comp.venue === 'string' && comp.venue.trim() && listed(comp));
}

/** Competition dates are mostly strings ('2019-01-22' or ISO); a few are ms. */
function dateMs(d: unknown): number | null {
  if (typeof d === 'number') return Number.isFinite(d) ? d : null;
  const t = typeof d === 'string' && d ? Date.parse(d) : NaN;
  return Number.isFinite(t) ? t : null;
}

function venueKey(venue: unknown, locality: unknown): string {
  const v = normalizeName(venue as string);
  if (!v) return '';
  const l = normalizeName(locality as string);
  return `${v}|${l || 'none'}`;
}

export const venueAggregator: AggregatorConfig<CompRecord, VenueAppearance> = {
  namespace: 'venues',
  recordIdParam: null,
  backPointerField: 'venueId',
  predicate: hasVenue,
  nameOf: (c) => c.venue ?? '',
  identityKey: (c) => venueKey(c.venue, c.locality),
  identityKeyFromAppearance: (a) => venueKey(a.venue, a.locality),
  seedAggregate: (c) => ({
    locality: c.locality ?? null,
    region: c.region ?? null,
    country: c.country ?? null,
  }),
  // List view's subtitle uses locality/region/country — keep them in the slim
  // index entry so the list renders without pulling each venue's full
  // appearances map.
  slimFields: (agg) => ({
    locality: agg.locality ?? null,
    region: agg.region ?? null,
    country: agg.country ?? null,
  }),
  toAppearance: (c, { competitionId }) => ({
    competitionId,
    venue: c.venue ?? null,
    locality: c.locality ?? null,
    region: c.region ?? null,
    country: c.country ?? null,
    lat: typeof c.lat === 'number' ? c.lat : null,
    lng: typeof c.lng === 'number' ? c.lng : null,
    address: c.address ?? null,
    date: dateMs(c.date),
  }),
  // Pick the latest-by-date appearance for each display field. Comp dates can
  // shift over time; this keeps the aggregate showing current values.
  recomputeFromAppearances: (apps) => {
    const sorted = [...apps].sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
    const pick = <K extends keyof VenueAppearance>(f: K) => (
      sorted.find((a) => a[f] != null)?.[f] ?? null
    );
    return {
      name: pick('venue'),
      locality: pick('locality'),
      region: pick('region'),
      country: pick('country'),
      lat: pick('lat'),
      lng: pick('lng'),
    };
  },
  // The "record" for venues is the comp meta itself — yield every comp and let
  // the predicate filter venueless ones (so they're counted in `skipped`).
  iterate: async (_db, _compId, comp) => [[null, comp]],
};
