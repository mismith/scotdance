<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import maplibregl, {
  type Map as MaplibreMap,
  type Marker as MaplibreMarker,
} from 'maplibre-gl'
import Supercluster from 'supercluster'
import { useLocalStorage } from '@vueuse/core'
import { MapPin } from '@lucide/vue'
import CompetitionPickerSheet from '@/components/CompetitionPickerSheet.vue'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import { useFavoritesStore } from '@/stores/favorites'
import { daysFromToday } from '@/lib/format'
import { createMap, persistCamera, styleUrlFor } from '@/lib/maplibre'
import { useTheme } from '@/composables/useTheme'
import { groupByVenue, type VenueGroup } from '@/lib/venues'

type Filter = 'archived' | 'current' | 'all'
// Shared with CompetitionsList — picking a date scope here applies everywhere.
const filter = useLocalStorage<Filter>('competitions:filter', 'current')
const includeArchived = computed(
  () => filter.value === 'archived' || filter.value === 'all',
)

const { competitions } = useCompetitions(includeArchived)

const CURRENT_PAST_DAYS = -7
const CURRENT_FUTURE_DAYS = 30

const dateFiltered = computed<CompetitionListItem[]>(() => {
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

// Resolve a CSS length expression to pixels. Used to feed our chrome
// inset into MapLibre's per-call camera padding (e.g. so the pan
// triggered by "locate me" lands above the floating nav, not behind it).
function cssLengthPx(expr: string): number {
  const probe = document.createElement('div')
  probe.style.cssText = `position:absolute;visibility:hidden;height:${expr}`
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
  const chromeBottom = cssLengthPx('calc(var(--chrome-bottom) + 1rem)')
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
  <CompetitionPickerSheet
    :open="activeVenue !== null"
    :title="activeVenue?.venue || 'Venue'"
    :subtitle="activeVenue?.location"
    :icon="MapPin"
    :competitions="activeVenue?.competitions ?? []"
    @close="activeVenue = null"
  />
</template>

<style>
/* Tailwind v4 isolates SFC <style> blocks — reference the main stylesheet
   so @apply can see our custom utilities (like .floating-nav). */
@reference '../../style.css';

/* Inset MapLibre's built-in control corners so they sit ~1rem outside
   the floating app chrome — bottom nav + in-map header above. The map
   canvas itself still goes edge-to-edge; only the controls move. On
   desktop, also constrain horizontally to the same max-w-3xl (48rem)
   content lane the floating header lives in so the locate-me /
   attribution don't fly to the viewport edges. */
.maplibregl-ctrl-top-right,
.maplibregl-ctrl-top-left {
  @apply top-[calc(var(--chrome-top)+1rem)];
}
.maplibregl-ctrl-bottom-right,
.maplibregl-ctrl-bottom-left {
  @apply bottom-[calc(var(--chrome-bottom)+1rem)];
}
/* Zero MapLibre's default 10px outer margin on the attribution control so
   it sits exactly at the corner container's edge (matches the geolocate
   override below). */
.maplibregl-ctrl-bottom-right > .maplibregl-ctrl-attrib,
.maplibregl-ctrl-bottom-left > .maplibregl-ctrl-attrib {
  @apply m-0;
}
/* Match the floating header's horizontal inset: 1rem from the viewport
   edge on narrow screens, then snap to the 48rem content lane on wide
   screens. Keeps the locate-me button centered under the avatar. */
.maplibregl-ctrl-top-right,
.maplibregl-ctrl-bottom-right {
  @apply right-[max(1rem,calc((100vw-48rem)/2))];
}
.maplibregl-ctrl-top-left,
.maplibregl-ctrl-bottom-left {
  @apply left-[max(1rem,calc((100vw-48rem)/2))];
}
.map-pin {
  @apply block w-[22px] h-[28px] border-none p-0 bg-transparent cursor-pointer origin-bottom transition-transform duration-[120ms] ease-[ease];
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25));
}
.map-pin::before {
  content: '';
  @apply block w-[22px] h-[22px] rounded-full border-2 border-white bg-primary;
}
.map-pin::after {
  content: '';
  @apply block w-0 h-0 mx-auto -mt-[6px] mb-0;
  /* CSS-triangle trick: transparent side borders + colored top border
     forms a downward-pointing arrow. Keep raw — Tailwind border utils
     can express it but the multi-side shorthand reads worse. */
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 8px solid var(--color-primary);
}
.map-pin.is-fav::before {
  @apply bg-secondary;
}
.map-pin.is-fav::after {
  @apply border-t-secondary;
}
.map-pin:hover {
  @apply scale-110;
}

.map-cluster {
  @apply flex items-center justify-center min-w-9 h-9 px-[10px] py-0 border-2 border-white rounded-full bg-primary text-white font-semibold tabular-nums cursor-pointer shadow-[0_2px_6px_rgba(0,0,0,0.25)];
}
.map-cluster:hover {
  @apply scale-105;
}

/* Restyle the locate-me control to match the .floating-nav utility
   (frosted card, blur, shadow, fully round). Targeting a MapLibre-rendered
   DOM node we can't class — :has() scopes it to the geolocate group. */
.maplibregl-ctrl-group:has(> .maplibregl-ctrl-geolocate) {
  /* Zero out MapLibre's default 10px outer margin so the button sits
     exactly at the corner container's edge — which is itself aligned to
     the avatar above by the .maplibregl-ctrl-{top,bottom}-{right,left}
     overrides. */
  @apply floating-nav m-0 overflow-hidden rounded-full border-0;
}
.maplibregl-ctrl-group:has(> .maplibregl-ctrl-geolocate) > button {
  @apply w-10 h-10 bg-transparent border-none rounded-full transition-opacity duration-150 ease-[ease];
}
.maplibregl-ctrl-group:has(> .maplibregl-ctrl-geolocate) > button:hover {
  @apply bg-transparent opacity-90;
}
/* The default MapLibre icon ships as a dark SVG. Invert it in dark mode
   so it reads on the dark card bg; leave as-is in light mode where the
   card is white and the dark icon already contrasts. */
.dark
  .maplibregl-ctrl-group:has(> .maplibregl-ctrl-geolocate)
  .maplibregl-ctrl-icon {
  @apply invert;
}
</style>
