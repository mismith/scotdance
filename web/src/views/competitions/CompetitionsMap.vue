<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { Map as MaplibreMap, Marker } from 'maplibre-gl'
import Supercluster from 'supercluster'
import { useLocalStorage } from '@vueuse/core'
import { MapPinOff } from '@lucide/vue'
import EmptyState from '@/components/EmptyState.vue'
import MapVenueSheet from '@/components/MapVenueSheet.vue'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import { useFavoritesStore } from '@/stores/favorites'
import { isBeforeToday, isSameDay } from '@/lib/format'
import { createMap } from '@/lib/maplibre'
import { groupByVenue, type VenueGroup } from '@/lib/venues'

type Filter = 'upcoming' | 'past' | 'all'
// Shared with CompetitionsList — picking a date scope here applies everywhere.
const filter = useLocalStorage<Filter>('competitions:filter', 'upcoming')
const includeArchived = computed(() => filter.value !== 'upcoming')

const { competitions, loading } = useCompetitions(includeArchived)

const dateFiltered = computed<CompetitionListItem[]>(() => {
  if (filter.value === 'upcoming')
    return competitions.value.filter((c) => c.date && !isBeforeToday(c.date))
  if (filter.value === 'past')
    return competitions.value.filter(
      (c) => c.date && isBeforeToday(c.date) && !isSameDay(c.date),
    )
  return competitions.value
})
const favorites = useFavoritesStore()

const mapContainer = ref<HTMLElement | null>(null)
const mapInstance = shallowRef<MaplibreMap | null>(null)
const mapReady = ref(false)
const activeVenue = ref<VenueGroup | null>(null)

const venueGroups = computed<VenueGroup[]>(() => groupByVenue(dateFiltered.value))

const hasPins = computed(() => venueGroups.value.length > 0)

interface PinProps {
  cluster: false
  idx: number
}
interface ClusterProps {
  cluster: true
  cluster_id: number
  point_count: number
  point_count_abbreviated: string | number
}
type Feature = GeoJSON.Feature<GeoJSON.Point, PinProps | ClusterProps>

const cluster = shallowRef<Supercluster<PinProps, ClusterProps> | null>(null)
const markers = new Map<string, Marker>()

function rebuildCluster(): void {
  const sc = new Supercluster<PinProps, ClusterProps>({
    radius: 60,
    maxZoom: 16,
  })
  sc.load(
    venueGroups.value.map<GeoJSON.Feature<GeoJSON.Point, PinProps>>((g, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [g.lng, g.lat] },
      properties: { cluster: false, idx: i },
    })),
  )
  cluster.value = sc
}

function clearMarkers(): void {
  markers.forEach((m) => m.remove())
  markers.clear()
}

async function renderMarkers(): Promise<void> {
  const map = mapInstance.value
  const sc = cluster.value
  if (!map || !sc) return
  const { Marker } = await import('maplibre-gl')

  const b = map.getBounds()
  const bbox: [number, number, number, number] = [
    b.getWest(),
    b.getSouth(),
    b.getEast(),
    b.getNorth(),
  ]
  const features = sc.getClusters(bbox, Math.floor(map.getZoom())) as Feature[]
  const seen = new Set<string>()

  for (const f of features) {
    const [lng, lat] = f.geometry.coordinates
    const props = f.properties
    const key = props.cluster
      ? `c:${props.cluster_id}`
      : `p:${(props as PinProps).idx}`
    seen.add(key)

    if (markers.has(key)) continue

    const el = document.createElement('button')
    el.type = 'button'

    if (props.cluster) {
      el.className = 'map-cluster'
      el.textContent = String(props.point_count_abbreviated)
      el.addEventListener('click', () => {
        const zoom = sc.getClusterExpansionZoom(props.cluster_id)
        map.easeTo({ center: [lng, lat], zoom: Math.min(zoom, 18) })
      })
    } else {
      const idx = (props as PinProps).idx
      const group = venueGroups.value[idx]
      const isFav = group.competitions.some((c) =>
        favorites.isFavoriteCompetition(c.id),
      )
      el.className = `map-pin ${isFav ? 'is-fav' : ''}`
      el.setAttribute('aria-label', group.venue || 'Venue')
      el.addEventListener('click', () => {
        activeVenue.value = group
      })
    }

    const marker = new Marker({ element: el, anchor: props.cluster ? 'center' : 'bottom' })
      .setLngLat([lng, lat])
      .addTo(map)
    markers.set(key, marker)
  }

  for (const [key, m] of markers) {
    if (!seen.has(key)) {
      m.remove()
      markers.delete(key)
    }
  }
}

function fitToPins(): void {
  const map = mapInstance.value
  const groups = venueGroups.value
  if (!map || groups.length === 0) return
  if (groups.length === 1) {
    map.easeTo({ center: [groups[0].lng, groups[0].lat], zoom: 9 })
    return
  }
  import('maplibre-gl').then(({ LngLatBounds }) => {
    const bounds = new LngLatBounds()
    for (const g of groups) bounds.extend([g.lng, g.lat])
    map.fitBounds(bounds, { padding: 48, maxZoom: 9, duration: 0 })
  })
}

onMounted(async () => {
  if (!mapContainer.value) return
  const map = await createMap(mapContainer.value)
  mapInstance.value = map
  map.on('load', () => {
    mapReady.value = true
    rebuildCluster()
    fitToPins()
    renderMarkers()
  })
  map.on('moveend', renderMarkers)
  map.on('zoomend', renderMarkers)
})

onBeforeUnmount(() => {
  clearMarkers()
  mapInstance.value?.remove()
  mapInstance.value = null
})

watch(venueGroups, () => {
  if (!mapReady.value) return
  clearMarkers()
  rebuildCluster()
  renderMarkers()
})
</script>

<template>
  <div class="relative h-[70vh] min-h-100 overflow-hidden rounded-2xl border">
    <div ref="mapContainer" class="absolute inset-0" />

    <div
      v-if="mapReady && !hasPins && !loading"
      class="bg-background/90 absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-2xl border p-6 backdrop-blur"
    >
      <EmptyState
        :icon="MapPinOff"
        title="No venues to show"
        description="No competitions have coordinates yet — try again after the backfill runs."
      />
    </div>

    <MapVenueSheet :venue="activeVenue" @close="activeVenue = null" />
  </div>
</template>

<style>
.map-pin {
  display: block;
  width: 22px;
  height: 28px;
  border: none;
  padding: 0;
  background: transparent;
  cursor: pointer;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25));
  transform-origin: 50% 100%;
  transition: transform 120ms ease;
}
.map-pin::before {
  content: '';
  display: block;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid white;
  background: var(--primary, #1e88e5);
}
.map-pin::after {
  content: '';
  display: block;
  width: 0;
  height: 0;
  margin: -6px auto 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 8px solid var(--primary, #1e88e5);
}
.map-pin.is-fav::before {
  background: var(--secondary, #ec407a);
}
.map-pin.is-fav::after {
  border-top-color: var(--secondary, #ec407a);
}
.map-pin:hover {
  transform: scale(1.1);
}

.map-cluster {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 10px;
  border: 2px solid white;
  border-radius: 999px;
  background: var(--primary, #1e88e5);
  color: white;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}
.map-cluster:hover {
  transform: scale(1.05);
}
</style>
