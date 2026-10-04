<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { GeoJSONSource, Map as MaplibreMap, Marker } from 'maplibre-gl'
import { useTheme } from '@/composables/useTheme'

const props = defineProps<{
  lat: number
  lng: number
  radiusKm: number
}>()

const container = ref<HTMLElement | null>(null)
const mapInstance = shallowRef<MaplibreMap | null>(null)
const { isDark } = useTheme()

const CIRCLE_SOURCE_ID = 'nearby-radius'
const CIRCLE_FILL_ID = 'nearby-radius-fill'
const CIRCLE_LINE_ID = 'nearby-radius-line'

// Approximate a geodesic circle as a 64-side polygon. Accurate enough at the
// 50–5000 km range we care about; uses degrees-per-km constants (lng adjusted
// for latitude). Pure math — no turf dep.
function buildCircle(
  lat: number,
  lng: number,
  radiusKm: number,
  steps = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = []
  const dLngPerKm = 1 / (111.32 * Math.cos((lat * Math.PI) / 180))
  const dLatPerKm = 1 / 110.574
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI
    coords.push([lng + radiusKm * dLngPerKm * Math.cos(t), lat + radiusKm * dLatPerKm * Math.sin(t)])
  }
  coords.push(coords[0])
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
    properties: {},
  }
}

function boundsFor(
  lat: number,
  lng: number,
  radiusKm: number,
): [[number, number], [number, number]] {
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))
  const dLat = radiusKm / 110.574
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat + dLat],
  ]
}

let userMarker: Marker | null = null
// The renderer (most of a megabyte) downloads when the map first shows.
let gl: typeof import('maplibre-gl') | null = null
let styleUrl: ((dark: boolean) => string) | null = null
let gone = false

function refresh(): void {
  const map = mapInstance.value
  if (!map || !gl || !map.isStyleLoaded()) return
  const data = buildCircle(props.lat, props.lng, props.radiusKm)
  const src = map.getSource(CIRCLE_SOURCE_ID) as GeoJSONSource | undefined
  if (src) src.setData(data)
  if (!userMarker) {
    const el = document.createElement('div')
    el.className = 'maplibregl-user-location-dot'
    userMarker = new gl.Marker({ element: el })
      .setLngLat([props.lng, props.lat])
      .addTo(map)
  } else {
    userMarker.setLngLat([props.lng, props.lat])
  }
  map.fitBounds(boundsFor(props.lat, props.lng, props.radiusKm), {
    padding: 12,
    duration: 250,
    animate: true,
  })
}

function addCircleLayers(map: MaplibreMap): void {
  map.addSource(CIRCLE_SOURCE_ID, {
    type: 'geojson',
    data: buildCircle(props.lat, props.lng, props.radiusKm),
  })
  map.addLayer({
    id: CIRCLE_FILL_ID,
    type: 'fill',
    source: CIRCLE_SOURCE_ID,
    paint: { 'fill-color': '#1e88e5', 'fill-opacity': 0.18 },
  })
  map.addLayer({
    id: CIRCLE_LINE_ID,
    type: 'line',
    source: CIRCLE_SOURCE_ID,
    paint: { 'line-color': '#1e88e5', 'line-width': 2 },
  })
}

onMounted(async () => {
  const [{ createMap, styleUrlFor }, maplibre] = await Promise.all([import('@/lib/maplibre'), import('maplibre-gl')])
  if (gone || !container.value) return
  gl = maplibre
  const map = createMap(container.value, {
    style: styleUrlFor(isDark.value),
    center: [props.lng, props.lat],
    zoom: 5,
    interactive: false,
    attributionControl: false,
  })
  mapInstance.value = map

  map.on('load', () => {
    addCircleLayers(map)
    refresh()
  })

  styleUrl = styleUrlFor
})

// Re-add the source/layers after a basemap swap — setStyle wipes them.
watch(isDark, (dark) => {
  const map = mapInstance.value
  if (!map || !styleUrl) return
  map.once('styledata', () => {
    if (!map.getSource(CIRCLE_SOURCE_ID)) {
      addCircleLayers(map)
      refresh()
    }
  })
  map.setStyle(styleUrl(dark))
})

watch(
  () => [props.lat, props.lng, props.radiusKm],
  () => refresh(),
)

onBeforeUnmount(() => {
  gone = true
  userMarker?.remove()
  userMarker = null
  mapInstance.value?.remove()
  mapInstance.value = null
})
</script>

<template>
  <div ref="container" class="border-card-foreground/10 aspect-3/2 w-full overflow-hidden rounded-xl border" />
</template>
