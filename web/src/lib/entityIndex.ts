import { child, get } from 'firebase/database'
import { dataRef } from '@/firebase'

// Mirrors `normalizeName` in functions/src/utility/normalize.ts: both are shared/normalize.ts.
import { normalizeName as normalizeEntityName } from '@shared/normalize'
export { normalizeEntityName }

/** A `/{namespace}:index/{key}` entry: the aggregate's id plus what lists show of it. */
export interface IndexEntry {
  id: string
  name?: string
  /** How many published competitions they're in. */
  appearanceCount?: number
}

const cache = new Map<string, Promise<IndexEntry | null>>()

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

/** The index entry for a name, or null when no one goes by it (or it can't be read). */
export async function lookupEntityEntry(
  namespace: string,
  name: string,
): Promise<IndexEntry | null> {
  const key = normalizeEntityName(name)
  if (!key) return null
  return readEntry(namespace, key).catch(() => null)
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
  return (await readEntry(namespace, key))?.id ?? null
}

async function readEntry(namespace: string, key: string): Promise<IndexEntry | null> {
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
          if (typeof v === 'string' && v) return { id: v }
          if (v && typeof v === 'object' && typeof v.id === 'string') return v as IndexEntry
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
