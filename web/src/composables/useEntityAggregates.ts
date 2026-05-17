import { ref, type Ref } from 'vue'
import { get } from 'firebase/database'
import { dataRef } from '@/firebase'

// Module-scoped per-namespace cache for entity aggregates (judges, pipers,
// venues, dancers). The aggregates ref survives component unmounts so:
//  - Repeat visits to /{section} render synchronously (no skeleton flash).
//  - Back-navigation from a detail page lands the view-transition on the
//    real list row instead of an empty-list snapshot.
//
// Detail pages pre-warm by calling `preloadEntityAggregates(namespace)` on
// mount, so by the time the user taps "back to {section}" the list is ready.

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

async function loadInto(namespace: string): Promise<void> {
  const entry = entryFor(namespace)
  if (entry.inFlight) return entry.inFlight
  entry.loading.value = true
  entry.error.value = null
  entry.inFlight = (async () => {
    try {
      const snap = await get(dataRef(namespace))
      const value = (snap.val() as Record<string, AggregateRow> | null) ?? {}
      entry.data.value = Object.entries(value).map(([id, agg]) => ({ id, agg }))
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
