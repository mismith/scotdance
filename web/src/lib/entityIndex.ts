import { child, get } from 'firebase/database'
import { dataRef } from '@/firebase'

// Mirror of `normalizeName` in functions/src/utility/normalize.ts. The web
// and functions packages don't share code; this implementation MUST stay in
// sync — otherwise lookups silently miss and entity pages 404.
export function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

const cache = new Map<string, Promise<string | null>>()

function cacheKey(namespace: string, key: string): string {
  return `${namespace}::${key}`
}

export async function lookupEntityId(
  namespace: string,
  name: string,
): Promise<string | null> {
  const key = normalizeEntityName(name)
  if (!key) return null
  return readIndex(namespace, key)
}

// Venues key on `normalize(name) + '|' + normalize(locality) || 'none'` so
// "Telus Convention Centre" in Calgary vs Brisbane don't silently merge.
// Mirrors functions/src/venues.ts venueKey().
export async function lookupVenueId(
  venue: string,
  locality?: string | null,
): Promise<string | null> {
  const v = normalizeEntityName(venue)
  if (!v) return null
  const l = normalizeEntityName(locality || '')
  const key = `${v}|${l || 'none'}`
  return readIndex('venues', key)
}

async function readIndex(namespace: string, key: string): Promise<string | null> {
  const ck = cacheKey(namespace, key)
  if (!cache.has(ck)) {
    cache.set(
      ck,
      (async () => {
        try {
          const snap = await get(child(dataRef(`${namespace}:index`), key))
          const v = snap.val()
          // Legacy entries stored a bare id string; new entries are slim
          // objects with `.id`.
          if (typeof v === 'string' && v) return v
          if (v && typeof v === 'object' && typeof v.id === 'string') return v.id
          return null
        } catch {
          return null
        }
      })(),
    )
  }
  return cache.get(ck)!
}
