import { child, get } from 'firebase/database'
import { dataRef } from '@/firebase'

// Mirror of `normalizeName` in functions/src/utility/normalize.ts. The web
// and functions packages don't share code; this implementation MUST stay in
// sync — otherwise lookups silently miss and entity pages 404.
export function normalizeEntityName(name: string): string {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
  return lookupEntityIdOrThrow(namespace, name).catch(() => null)
}

/**
 * Like lookupEntityId, but throws when the index can't be read (offline or a
 * hiccup), so null always means no one goes by that name.
 */
export async function lookupEntityIdOrThrow(
  namespace: string,
  name: string,
): Promise<string | null> {
  const key = normalizeEntityName(name)
  if (!key) return null
  return readIndex(namespace, key)
}

// Venues key on `normalize(name) + '|' + town || 'none'` so "Telus
// Convention Centre" in Calgary vs Brisbane don't silently merge. The town is
// the locality, else the town typed first in `location` ("Calgary, AB").
// Mirrors venueTown() and venueKey() in functions/src/utility/entityConfigs.ts.
export function venueTown(locality?: string | null, location?: string | null): string {
  return normalizeEntityName(locality || '') || normalizeEntityName((location ?? '').split(',')[0])
}

export function venueKey(venue: string | null | undefined, locality?: string | null, location?: string | null): string {
  const v = normalizeEntityName(venue ?? '')
  if (!v) return ''
  return `${v}|${venueTown(locality, location) || 'none'}`
}

export async function lookupVenueId(
  venue: string,
  locality?: string | null,
  location?: string | null,
): Promise<string | null> {
  const key = venueKey(venue, locality, location)
  if (!key) return null
  return readIndex('venues', key).catch(() => null)
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
        } catch (err) {
          // Offline or a hiccup: try again next time rather than never.
          cache.delete(ck)
          throw err
        }
      })(),
    )
  }
  return cache.get(ck)!
}
