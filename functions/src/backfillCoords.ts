 
import type { Reference } from 'firebase-admin/database';

interface Competition {
  name?: string;
  venue?: string;
  address?: string;
  location?: string;
  lat?: number;
  lng?: number;
  country?: string;
  region?: string;
  locality?: string;
}

interface GeocodeHit {
  lat: number;
  lng: number;
  country: string | null;
  region: string | null;
  locality: string | null;
}

interface GeocodeResponse {
  status: string;
  results: Array<{
    geometry: { location: { lat: number; lng: number } };
    address_components: Array<{ short_name: string; types: string[] }>;
  }>;
}

export interface BackfillSummary {
  scanned: number;
  updated: number;
  skipped: number;
  noQuery: number;
  failed: number;
  dryRun: boolean;
  samples: Array<{
    id: string;
    name?: string;
    query: string;
    lat: number;
    lng: number;
    country: string | null;
    region: string | null;
    locality: string | null;
  }>;
}

// `address=…` finds a place from its words; `latlng=…` names the place at a
// map position.
async function geocode(query: string, apiKey: string): Promise<GeocodeHit | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?${query}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`HTTP ${res.status} for "${query}"`);
    return null;
  }
  const body = (await res.json()) as GeocodeResponse;
  if (body.status !== 'OK' || body.results.length === 0) {
    console.warn(`no result for "${query}" (status=${body.status})`);
    return null;
  }
  const hit = body.results[0];
  const findComp = (type: string) => hit.address_components.find((c) => c.types.includes(type));
  const countryComp = findComp('country');
  const regionComp = findComp('administrative_area_level_1');
  // UK addresses have a postal town instead (Manage's venue search does the same).
  const localityComp = findComp('locality') ?? findComp('postal_town');
  return {
    lat: hit.geometry.location.lat,
    lng: hit.geometry.location.lng,
    country: countryComp ? countryComp.short_name : null,
    region: regionComp ? regionComp.short_name : null,
    locality: localityComp ? localityComp.short_name : null,
  };
}

function buildQuery(c: Competition): string {
  return [c.venue, c.address, c.location].filter(Boolean).join(', ');
}

function hasCoords(c: Competition): boolean {
  return Number.isFinite(c.lat) && Number.isFinite(c.lng);
}

// The v3 app's Submit kept a picked venue's position and country but not its
// province (or state) and town, which Competitions filters by: those are
// looked up from the position, and only what's missing is written.
const PLACE_FIELDS = ['country', 'region', 'locality'] as const;
function complete(c: Competition): boolean {
  return hasCoords(c) && PLACE_FIELDS.every((f) => c[f]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => { setTimeout(r, ms); });
}

// Throttle to ~10 QPS — well under the Geocoding API's 50 QPS free-tier ceiling.
const THROTTLE_MS = 100;
// Cap how many sample updates we send back in the response payload.
const MAX_SAMPLES = 20;

export async function runBackfillCoords(
  competitionsRef: Reference,
  apiKey: string,
  dryRun: boolean,
): Promise<BackfillSummary> {
  const snap = await competitionsRef.once('value');
  const all = (snap.val() ?? {}) as Record<string, Competition>;
  const ids = Object.keys(all);

  const summary: BackfillSummary = {
    scanned: ids.length,
    updated: 0,
    skipped: 0,
    noQuery: 0,
    failed: 0,
    dryRun,
    samples: [],
  };

  for (const id of ids) {
    const c = all[id];
    if (complete(c)) {
      summary.skipped += 1;
    } else {
      const words = buildQuery(c);
      const query = hasCoords(c) ? `latlng=${c.lat},${c.lng}` : words && `address=${encodeURIComponent(words)}`;
      if (!query) {
        summary.noQuery += 1;
      } else {
        const hit = await geocode(query, apiKey);
        const update: Partial<Competition> = {
          ...(!hasCoords(c) && hit && { lat: hit.lat, lng: hit.lng }),
          ...Object.fromEntries(PLACE_FIELDS.filter((f) => !c[f] && hit?.[f]).map((f) => [f, hit![f]])),
        };
        if (!hit || !Object.keys(update).length) {
          summary.failed += 1;
        } else {
          if (summary.samples.length < MAX_SAMPLES) {
            summary.samples.push({
              id,
              name: c.name,
              query: words || query,
              lat: update.lat ?? (c.lat as number),
              lng: update.lng ?? (c.lng as number),
              country: update.country ?? c.country ?? null,
              region: update.region ?? c.region ?? null,
              locality: update.locality ?? c.locality ?? null,
            });
          }
          if (!dryRun) await competitionsRef.child(id).update(update);
          summary.updated += 1;
        }
        await sleep(THROTTLE_MS);
      }
    }
  }

  return summary;
}
