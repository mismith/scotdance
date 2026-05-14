<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import maplibregl, {
  type Map as MaplibreMap,
  type Marker as MaplibreMarker,
} from 'maplibre-gl'
import Supercluster from 'supercluster'
import { useLocalStorage } from '@vueuse/core'
import MapVenueSheet from '@/components/MapVenueSheet.vue'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import { useFavoritesStore } from '@/stores/favorites'
import { daysFromToday, isBeforeToday } from '@/lib/format'
import { createMap, persistCamera, styleUrlFor } from '@/lib/maplibre'
import { useTheme } from '@/composables/useTheme'
import { groupByVenue, type VenueGroup } from '@/lib/venues'

type Filter = 'archived' | 'current' | 'upcoming' | 'all'
// Shared with CompetitionsList — picking a date scope here applies everywhere.
const filter = useLocalStorage<Filter>('competitions:filter', 'current')
const includeArchived = computed(
  () => filter.value === 'archived' || filter.value === 'all',
)

const { competitions } = useCompetitions(includeArchived)

const CURRENT_PAST_DAYS = -7
const CURRENT_FUTURE_DAYS = 30

const dateFiltered = computed<CompetitionListItem[]>(() => {
  if (filter.value === 'upcoming')
    return competitions.value.filter((c) => c.date && !isBeforeToday(c.date))
  if (filter.value === 'current')
    return competitions.value.filter((c) => {
      const d = daysFromToday(c.date)
      return d !== null && d >= CURRENT_PAST_DAYS && d <= CURRENT_FUTURE_DAYS
    })
  if (filter.value === 'archived')
    return competitions.value.filter((c) => {
      const d = daysFromToday(c.date)
      return d !== null && d < CURRENT_PAST_DAYS
    })
  return competitions.value
})
const favorites = useFavoritesStore()
const { isDark } = useTheme()

const mapContainer = ref<HTMLElement | null>(null)
const mapInstance = shallowRef<MaplibreMap | null>(null)
const mapReady = ref(false)
const activeVenue = ref<VenueGroup | null>(null)

const venueGroups = computed<VenueGroup[]>(() => groupByVenue(dateFiltered.value))

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
const markers = new Map<string, MaplibreMarker>()

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

function renderMarkers(): void {
  const map = mapInstance.value
  const sc = cluster.value
  if (!map || !sc) return

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
    const key = props.cluster ? `c:${props.cluster_id}` : `p:${(props as PinProps).idx}`
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
      const isFav = group.competitions.some((c) => favorites.isFavoriteCompetition(c.id))
      el.className = `map-pin ${isFav ? 'is-fav' : ''}`
      el.setAttribute('aria-label', group.venue || 'Venue')
      el.addEventListener('click', () => {
        activeVenue.value = group
      })
    }

    const marker = new maplibregl.Marker({
      element: el,
      anchor: props.cluster ? 'center' : 'bottom',
    })
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

// Resolve a CSS length variable to pixels. Used to feed our --chrome-bottom
// safe-area into MapLibre's per-call camera padding (e.g. so the pan
// triggered by "locate me" lands above the floating nav, not behind it).
function cssLengthPx(name: string): number {
  const probe = document.createElement('div')
  probe.style.cssText = `position:absolute;visibility:hidden;height:var(${name})`
  document.body.appendChild(probe)
  const px = probe.getBoundingClientRect().height
  probe.remove()
  return px
}

onMounted(() => {
  if (!mapContainer.value) return
  const map = createMap(mapContainer.value, { style: styleUrlFor(isDark.value) })
  mapInstance.value = map
  // Swap the basemap when the app theme flips. setStyle keeps DOM markers
  // and camera position; only the tile style is replaced.
  watch(isDark, (dark) => {
    map.setStyle(styleUrlFor(dark))
  })
  const chromeBottom = cssLengthPx('--chrome-bottom')
  const geolocate = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    showUserLocation: true,
    // Per-call padding (vs persistent map.setPadding) — only affects this
    // pan, doesn't shift the camera vanishing point afterwards.
    fitBoundsOptions: {
      maxZoom: 12,
      duration: 400,
      padding: { top: 0, bottom: chromeBottom, left: 0, right: 0 },
    },
  })
  map.addControl(geolocate, 'top-right')

  // Show a one-shot user-location dot on load if permission is already
  // granted — without GeolocateControl.trigger()'s pan animation, which
  // would overwrite the restored camera. Uses stock MapLibre CSS so it's
  // visually identical to the control-painted dot.
  let userMarker: maplibregl.Marker | null = null
  navigator.permissions
    ?.query({ name: 'geolocation' as PermissionName })
    .then((status) => {
      if (status.state !== 'granted') return
      navigator.geolocation.getCurrentPosition((pos) => {
        const el = document.createElement('div')
        el.className = 'maplibregl-user-location-dot'
        userMarker = new maplibregl.Marker({ element: el })
          .setLngLat([pos.coords.longitude, pos.coords.latitude])
          .addTo(map)
      })
    })
    .catch(() => {})
  geolocate.on('geolocate', () => {
    userMarker?.remove()
    userMarker = null
  })
  map.on('load', () => {
    mapReady.value = true
    // MapLibre's compact attribution starts expanded; collapse it on load
    // so it doesn't eat half the bottom of the map until first interaction.
    map
      .getContainer()
      .querySelector('.maplibregl-ctrl-attrib.maplibregl-compact-show')
      ?.classList.remove('maplibregl-compact-show')
    rebuildCluster()
    renderMarkers()
  })
  map.on('moveend', () => {
    persistCamera(map)
    renderMarkers()
  })
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
  <div ref="mapContainer" class="relative flex-1 overflow-hidden" />
  <MapVenueSheet :venue="activeVenue" @close="activeVenue = null" />
</template>

<style>
/* Inset MapLibre's built-in control corners so they sit inside the safe
   area defined by our floating app chrome — bottom nav today, floating
   header above. The map canvas itself still goes edge-to-edge; only the
   controls move. On desktop, also constrain horizontally to the same
   max-w-3xl (48rem) content lane the floating header lives in so the
   locate-me / attribution don't fly to the viewport edges. */
.maplibregl-ctrl-top-right,
.maplibregl-ctrl-top-left {
  top: var(--chrome-top, 0px);
}
.maplibregl-ctrl-bottom-right,
.maplibregl-ctrl-bottom-left {
  bottom: var(--chrome-bottom, 0px);
}
/* Match the floating header's horizontal inset: 1rem from the viewport
   edge on narrow screens, then snap to the 48rem content lane on wide
   screens. Keeps the locate-me button centered under the avatar. */
.maplibregl-ctrl-top-right,
.maplibregl-ctrl-bottom-right {
  right: max(1rem, calc((100vw - 48rem) / 2));
}
.maplibregl-ctrl-top-left,
.maplibregl-ctrl-bottom-left {
  left: max(1rem, calc((100vw - 48rem) / 2));
}
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

/* Lift the map's bottom chrome (attribution, scale, etc.) above the
   floating app nav so it stays legible and tappable. */
.maplibregl-ctrl-bottom-right,
.maplibregl-ctrl-bottom-left {
  bottom: var(--chrome-bottom);
}

/* Restyle the locate-me control to match the floating nav island pill
   style (bg-nav/90, shadow, blur, fully round). Scoped via :has() so it
   only hits the geolocate group, not other controls. */
.maplibregl-ctrl-group:has(> .maplibregl-ctrl-geolocate) {
  /* Zero out MapLibre's default 10px outer margin so the button sits
     exactly at the corner container's edge — which is itself aligned to
     the avatar above by the .maplibregl-ctrl-{top,bottom}-{right,left}
     overrides. */
  margin: 0;
  background: color-mix(in oklab, var(--nav) 90%, transparent);
  color: var(--nav-foreground);
  border: none;
  border-radius: 9999px;
  box-shadow:
    0 10px 15px -3px rgb(0 0 0 / 0.1),
    0 4px 6px -4px rgb(0 0 0 / 0.1);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  overflow: hidden;
}
.maplibregl-ctrl-group:has(> .maplibregl-ctrl-geolocate) > button {
  width: 2.5rem;
  height: 2.5rem;
  background: transparent;
  border: none;
  border-radius: 9999px;
  transition: opacity 150ms ease;
}
.maplibregl-ctrl-group:has(> .maplibregl-ctrl-geolocate) > button:hover {
  background: transparent;
  opacity: 0.9;
}
/* The default MapLibre icon ships as a dark SVG. Invert it in light mode
   so it reads on the near-black nav bg; leave as-is in dark mode where
   the nav is cream and the dark icon already contrasts. */
html:not(.dark) .maplibregl-ctrl-group:has(> .maplibregl-ctrl-geolocate) .maplibregl-ctrl-icon {
  filter: invert(1);
}
</style>
