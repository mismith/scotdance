import { ensureAdmin } from './utility/competition';
import { createAggregator, type AggregatorConfig } from './utility/aggregate';
import { normalizeName } from './utility/normalize';

// Venue aggregator: maintains /venues and /venues:index from competition meta
// writes. Each competition has at most one venue (so recordIdParam is null —
// the comp itself is the source record). Identity is composite — normalized
// venue + locality, so two same-named venues in different cities don't merge.
//
// See docs/adr/0003-first-class-entities.md.

interface CompRecord {
  venue?: string
  locality?: string | null
  region?: string | null
  country?: string | null
  lat?: number | null
  lng?: number | null
  address?: string | null
  date?: number | null
  venueId?: string
}

interface VenueAppearance {
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

function hasVenue(comp: CompRecord | null | undefined): comp is CompRecord {
  return !!(comp && typeof comp.venue === 'string' && comp.venue.trim());
}

const aggregatorConfig: AggregatorConfig<CompRecord, VenueAppearance> = {
  namespace: 'venues',
  recordIdParam: null,
  backPointerField: 'venueId',
  predicate: hasVenue,
  nameOf: (c) => c.venue ?? '',
  identityKey: (c) => {
    const v = normalizeName(c.venue ?? '');
    if (!v) return '';
    const l = normalizeName(c.locality ?? '');
    return `${v}|${l || 'none'}`;
  },
  identityKeyFromAppearance: (a) => {
    const v = normalizeName(a.venue ?? '');
    if (!v) return '';
    const l = normalizeName(a.locality ?? '');
    return `${v}|${l || 'none'}`;
  },
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
    date: typeof c.date === 'number' ? c.date : null,
  }),
  // Pick the latest-by-date appearance for each display field. Comp dates can
  // shift over time; this keeps the aggregate showing current values.
  recomputeFromAppearances: (apps) => {
    const sorted = [...apps].sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
    const pick = <K extends keyof VenueAppearance>(f: K) =>
      sorted.find((a) => a[f] != null)?.[f] ?? null;
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

export function getOnCreate(db: any) {
  return createAggregator(db, aggregatorConfig).onCreate;
}

export function getOnUpdate(db: any) {
  return createAggregator(db, aggregatorConfig).onUpdate;
}

export function getOnDelete(db: any) {
  return createAggregator(db, aggregatorConfig).onDelete;
}

export function getOnBackfillAggregates(db: any) {
  const agg = createAggregator(db, aggregatorConfig);
  return async function onBackfillAggregates(_data: unknown, ctx: any) {
    await ensureAdmin(ctx, db);
    return agg.backfill();
  };
}
