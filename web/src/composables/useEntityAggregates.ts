import { ref, type Ref } from 'vue'
import { get } from 'firebase/database'
import { dataRef } from '@/firebase'

// Module-scoped per-namespace cache for entity list rows (judges, pipers,
// venues, dancers). The list reads the slim `/{namespace}:index` node (each
// entry is `{ id, name, appearanceCount, ...entitySpecific }`) — NOT the full
// `/{namespace}` aggregates, which carry an `appearances` map and are
// orders-of-magnitude larger. Profile pages load the full aggregate
// separately.
//
// The cache survives component unmounts so:
//  - Repeat visits to /{section} render synchronously (no skeleton flash).
//  - Back-navigation from a detail page lands the view-transition on the
//    real list row instead of an empty-list snapshot.

export interface AggregateRow {
  name?: string
  appearanceCount?: number
  [key: string]: unknown
}

export interface EntityAggregatesEntry {
  data: Ref<Array<{ id: string; agg: AggregateRow }>>
  loaded: boolean
  inFlight: Promise<void> | null
  loading: Ref<boolean>
  error: Ref<Error | null>
}

const cache = new Map<string, EntityAggregatesEntry>()

function entryFor(namespace: string): EntityAggregatesEntry {
  let entry = cache.get(namespace)
  if (!entry) {
    entry = {
      data: ref([]),
      loaded: false,
      inFlight: null,
      loading: ref(false),
      error: ref(null),
    }
    cache.set(namespace, entry)
  }
  return entry
}

interface SlimIndexEntry {
  id?: string
  name?: string
  appearanceCount?: number
  [key: string]: unknown
}

async function loadInto(namespace: string): Promise<void> {
  const entry = entryFor(namespace)
  if (entry.inFlight) return entry.inFlight
  entry.loading.value = true
  entry.error.value = null
  entry.inFlight = (async () => {
    try {
      const snap = await get(dataRef(`${namespace}:index`))
      const value = (snap.val() as Record<string, unknown> | null) ?? {}
      const rows: Array<{ id: string; agg: AggregateRow }> = []
      for (const v of Object.values(value)) {
        // Legacy entries were bare id strings (no name/count) — skip; they get
        // upgraded to slim objects on the next trigger fire or backfill run.
        if (!v || typeof v !== 'object') continue
        const slim = v as SlimIndexEntry
        if (!slim.id) continue
        const { id, ...agg } = slim
        rows.push({ id, agg: agg as AggregateRow })
      }
      entry.data.value = rows
      entry.loaded = true
    } catch (e) {
      entry.error.value = e as Error
    } finally {
      entry.loading.value = false
      entry.inFlight = null
    }
  })()
  return entry.inFlight
}

export function useEntityAggregates(namespace: string): EntityAggregatesEntry {
  const entry = entryFor(namespace)
  if (!entry.loaded && !entry.inFlight) void loadInto(namespace)
  return entry
}

/**
 * Inserts (or replaces) a single aggregate in the list cache. Used by detail
 * pages so that on back-nav to the list, at least the focused row is already
 * in the DOM — that's what the view-transition needs to land the morph on.
 * Mirrors the way useCompetition seeds useCompetitions' cache.
 */
export function insertEntityAggregate(
  namespace: string,
  id: string,
  agg: object,
): void {
  const entry = entryFor(namespace)
  const row = { id, agg: agg as AggregateRow }
  const list = entry.data.value
  const i = list.findIndex((r) => r.id === id)
  if (i >= 0) list[i] = row
  else entry.data.value = [...list, row]
}
