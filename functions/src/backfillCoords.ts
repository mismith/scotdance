/* eslint-disable no-console, no-await-in-loop, no-restricted-syntax */
import type * as admin from 'firebase-admin';

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

async function geocode(address: string, apiKey: string): Promise<GeocodeHit | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`HTTP ${res.status} for "${address}"`);
    return null;
  }
  const body = (await res.json()) as GeocodeResponse;
  if (body.status !== 'OK' || body.results.length === 0) {
    console.warn(`no result for "${address}" (status=${body.status})`);
    return null;
  }
  const hit = body.results[0];
  const findComp = (type: string) => hit.address_components.find((c) => c.types.includes(type));
  const countryComp = findComp('country');
  const regionComp = findComp('administrative_area_level_1');
  const localityComp = findComp('locality');
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

function alreadyGeocoded(c: Competition): boolean {
  return Number.isFinite(c.lat) && Number.isFinite(c.lng);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => { setTimeout(r, ms); });
}

// Throttle to ~10 QPS — well under the Geocoding API's 50 QPS free-tier ceiling.
const THROTTLE_MS = 100;
// Cap how many sample updates we send back in the response payload.
const MAX_SAMPLES = 20;

export async function runBackfillCoords(
  competitionsRef: admin.database.Reference,
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
    if (alreadyGeocoded(c)) {
      summary.skipped += 1;
    } else {
      const query = buildQuery(c);
      if (!query) {
        summary.noQuery += 1;
      } else {
        const hit = await geocode(query, apiKey);
        if (!hit) {
          summary.failed += 1;
        } else {
          if (summary.samples.length < MAX_SAMPLES) {
            summary.samples.push({
              id,
              name: c.name,
              query,
              lat: hit.lat,
              lng: hit.lng,
              country: hit.country,
              region: hit.region,
              locality: hit.locality,
            });
          }
          if (!dryRun) {
            await competitionsRef.child(id).update({
              lat: hit.lat,
              lng: hit.lng,
              country: hit.country,
              region: hit.region,
              locality: hit.locality,
            });
          }
          summary.updated += 1;
        }
        await sleep(THROTTLE_MS);
      }
    }
  }

  return summary;
}
