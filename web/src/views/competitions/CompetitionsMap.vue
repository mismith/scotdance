<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import maplibregl, {
  type Map as MaplibreMap,
  type Marker as MaplibreMarker,
} from 'maplibre-gl'
import Supercluster from 'supercluster'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import { useFavoritesStore } from '@/stores/favorites'
import { createMap, persistCamera, styleUrlFor } from '@/lib/maplibre'
import { useTheme } from '@/composables/useTheme'
import { groupByVenue, type VenueGroup } from '@/lib/venues'

const props = withDefaults(
  defineProps<{
    competitions: CompetitionListItem[]
    /** Pin click destination. When omitted, falls back to venue.info (if the
     *  comp carries a venueId back-pointer) or competition.info. */
    linkTo?: (c: CompetitionListItem) => RouteLocationRaw
    /** Full-bleed mode (main competitions list). When false, the map is
     *  embedded in a content column (subtab map view) — controls drop their
     *  app-chrome insets and default to MapLibre's corner positions. */
    fullscreen?: boolean
  }>(),
  { linkTo: undefined, fullscreen: true },
)

const favorites = useFavoritesStore()
const { isDark } = useTheme()

const mapContainer = ref<HTMLElement | null>(null)
const mapInstance = shallowRef<MaplibreMap | null>(null)
const mapReady = ref(false)
const router = useRouter()

const venueGroups = computed<VenueGroup[]>(() => groupByVenue(props.competitions))

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
        const first = group.competitions[0]
        if (!first) return
        // Caller-provided destination wins (e.g. dancer.results sends pins to
        // competition.dancer). Otherwise: venues have first-class profiles, so
        // prefer the venueId back-pointer when present; fall back to the comp.
        if (props.linkTo) {
          router.push(props.linkTo(first))
          return
        }
        const venueId = group.competitions
          .map((c) => (c as { venueId?: string }).venueId)
          .find((id): id is string => !!id)
        if (venueId) {
          router.push({ name: 'venue.info', params: { venueId } })
        } else {
          router.push({
            name: 'competition.info',
            params: { competitionId: first.id },
          })
        }
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
  <div
    ref="mapContainer"
    :class="[
      'comp-map relative overflow-hidden',
      fullscreen ? 'comp-map--fullscreen flex-1' : 'comp-map--embedded',
    ]"
  />
</template>

<style>
/* Tailwind v4 isolates SFC <style> blocks — reference the main stylesheet
   so @apply can see our custom utilities (like .floating-nav). */
@reference '../../style.css';

/* Full-bleed mode: inset MapLibre's built-in control corners so they sit
   ~1rem outside the floating app chrome — bottom nav + in-map header
   above. On desktop, also constrain horizontally to the same max-w-3xl
   (48rem) content lane the floating header lives in. Embedded mode
   (subtab map) keeps MapLibre's default corner positions. */
.comp-map--fullscreen .maplibregl-ctrl-top-right,
.comp-map--fullscreen .maplibregl-ctrl-top-left {
  @apply top-[calc(var(--chrome-top)+1rem)];
}
.comp-map--fullscreen .maplibregl-ctrl-bottom-right,
.comp-map--fullscreen .maplibregl-ctrl-bottom-left {
  @apply bottom-[calc(var(--chrome-bottom)+1rem)];
}
.comp-map--fullscreen .maplibregl-ctrl-bottom-right > .maplibregl-ctrl-attrib,
.comp-map--fullscreen .maplibregl-ctrl-bottom-left > .maplibregl-ctrl-attrib {
  @apply m-0;
}
.comp-map--fullscreen .maplibregl-ctrl-top-right,
.comp-map--fullscreen .maplibregl-ctrl-bottom-right {
  @apply right-[max(1rem,calc((100vw-48rem)/2))];
}
.comp-map--fullscreen .maplibregl-ctrl-top-left,
.comp-map--fullscreen .maplibregl-ctrl-bottom-left {
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

/* Full-bleed only: restyle the locate-me control to match the
   .floating-nav utility (frosted card, blur, shadow, fully round). The
   embedded map keeps MapLibre's stock control chrome. */
.comp-map--fullscreen .maplibregl-ctrl-group:has(> .maplibregl-ctrl-geolocate) {
  @apply floating-nav m-0 overflow-hidden rounded-full border-0;
}
.comp-map--fullscreen .maplibregl-ctrl-group:has(> .maplibregl-ctrl-geolocate) > button {
  @apply w-10 h-10 bg-transparent border-none rounded-full transition-opacity duration-150 ease-[ease];
}
.comp-map--fullscreen .maplibregl-ctrl-group:has(> .maplibregl-ctrl-geolocate) > button:hover {
  @apply bg-transparent opacity-90;
}
.dark
  .comp-map--fullscreen
  .maplibregl-ctrl-group:has(> .maplibregl-ctrl-geolocate)
  .maplibregl-ctrl-icon {
  @apply invert;
}
</style>
