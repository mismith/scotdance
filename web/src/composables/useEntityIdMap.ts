import { shallowReactive } from 'vue'
import { lookupEntityId, lookupVenueId } from '@/lib/entityIndex'

// Reactive name → aggregate-id map. Lets list rows tag themselves with a
// view-transition-name keyed on the destination ID (so the source row morphs
// into the destination header). The async resolve is fire-and-forget; rows
// render with no VT name until the lookup completes — acceptable since the
// transition only matters at navigation time.
//
// Module-scoped (singleton per namespace) so resolved ids survive component
// unmounts. Without this, back-navigation from a detail page to a list page
// would land on a fresh empty map and the morph target row would render
// without a view-transition-name until the async lookup resolves — too late
// for the snapshot.

export type IdMap = Record<string, string | null>

interface MapEntry {
  map: IdMap
  inFlight: Set<string>
}

const entityMaps = new Map<string, MapEntry>()

function entityEntry(namespace: string): MapEntry {
  let entry = entityMaps.get(namespace)
  if (!entry) {
    entry = { map: shallowReactive<IdMap>({}), inFlight: new Set() }
    entityMaps.set(namespace, entry)
  }
  return entry
}

export function useEntityIdMap(namespace: string) {
  const { map, inFlight } = entityEntry(namespace)

  function resolve(name: string): string | null {
    if (name in map) return map[name]
    if (inFlight.has(name)) return null
    inFlight.add(name)
    lookupEntityId(namespace, name).then((id) => {
      // shallowReactive only tracks top-level keys — reassigning the property
      // is enough to re-trigger templates.
      map[name] = id
      inFlight.delete(name)
    })
    return null
  }

  function get(name: string): string | null {
    return map[name] ?? null
  }

  return { map, resolve, get }
}

/** Direct seed (used by detail pages that already know the name→id mapping). */
export function seedEntityId(namespace: string, name: string, id: string): void {
  const { map } = entityEntry(namespace)
  map[name] = id
}

// Venues key on (name, locality) so two same-named venues in different cities
// don't collide. The map key embeds both.
function venueKey(name: string, locality: string | null | undefined): string {
  return `${name}::${locality ?? ''}`
}

const venueEntry: MapEntry = {
  map: shallowReactive<IdMap>({}),
  inFlight: new Set(),
}

export function useVenueIdMap() {
  const { map, inFlight } = venueEntry

  function resolve(name: string, locality?: string | null): string | null {
    const k = venueKey(name, locality)
    if (k in map) return map[k]
    if (inFlight.has(k)) return null
    inFlight.add(k)
    lookupVenueId(name, locality ?? null).then((id) => {
      map[k] = id
      inFlight.delete(k)
    })
    return null
  }

  function get(name: string, locality?: string | null): string | null {
    return map[venueKey(name, locality)] ?? null
  }

  return { map, resolve, get }
}
