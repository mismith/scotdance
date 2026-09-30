<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { MapPin } from '@lucide/vue'
import type { ExpressionSpecification, FilterSpecification, LayerSpecification, Map as MaplibreMap, StyleSpecification } from 'maplibre-gl'
import { createMap, styleUrlFor } from '@/lib/maplibre'
import { useTheme } from '@/composables/useTheme'

// A still map of where a place is, with a pin in the middle. Tapping it opens
// the same directions link as the Directions button beside it, so it's hidden
// from screen readers and the keyboard (the button covers them). The map only
// starts once it scrolls into view: each one is a WebGL context.
const props = withDefaults(
  defineProps<{ lat: number; lng: number; href?: string | null; zoom?: number }>(),
  {
    href: null,
    zoom: 15.5,
  },
)

const container = ref<HTMLElement | null>(null)
const map = shallowRef<MaplibreMap | null>(null)
const loaded = ref(false)
const { isDark } = useTheme()

// Shops and landmarks are what people recognise when looking for the venue,
// so they stay; bus and train stop labels just crowd a map this small. The
// dark basemap has no shop/landmark layers, so borrow the light one's (same
// tiles, icons and fonts) and recolour the labels.
const POI_LAYERS = /^poi_r\d+$/
let lightPoiLayers: Promise<LayerSpecification[]> | null = null
function poiLayers(): Promise<LayerSpecification[]> {
  lightPoiLayers ??= fetch(styleUrlFor(false))
    .then((r) => r.json())
    .then((style: StyleSpecification) => style.layers.filter((l) => POI_LAYERS.test(l.id)))
    .catch(() => [])
  return lightPoiLayers
}

const withoutStops = (filter: FilterSpecification | undefined): FilterSpecification => [
  'all',
  (filter ?? true) as ExpressionSpecification,
  ['!', ['match', ['get', 'class'], ['bus', 'railway', 'bus_stop', 'tram_stop'], true, false]],
]

async function tune(m: MaplibreMap, dark: boolean) {
  if (m.getLayer('poi_transit')) m.setLayoutProperty('poi_transit', 'visibility', 'none')
  if (dark) {
    for (const layer of await poiLayers()) {
      if (m.getLayer(layer.id) || layer.type !== 'symbol') continue
      m.addLayer({
        ...layer,
        paint: { ...layer.paint, 'text-color': '#b4bcc6', 'text-halo-color': '#161b21', 'text-halo-width': 1 },
      })
    }
  }
  for (const layer of m.getStyle()?.layers ?? []) {
    if (layer.type === 'symbol' && POI_LAYERS.test(layer.id)) m.setFilter(layer.id, withoutStops(layer.filter))
  }
}

const { stop } = useIntersectionObserver(
  container,
  ([entry]) => {
    if (!entry?.isIntersecting || map.value || !container.value) return
    stop()
    const m = createMap(container.value, {
      style: styleUrlFor(isDark.value),
      center: [props.lng, props.lat],
      zoom: props.zoom,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    })
    m.on('style.load', () => tune(m, isDark.value))
    m.once('idle', () => (loaded.value = true))
    map.value = m
  },
  { rootMargin: '200px' },
)

watch(isDark, (dark) => map.value?.setStyle(styleUrlFor(dark)))
watch(
  () => [props.lat, props.lng],
  () => map.value?.jumpTo({ center: [props.lng, props.lat] }),
)

onBeforeUnmount(() => {
  map.value?.remove()
  map.value = null
})
</script>

<template>
  <component
    :is="href ? 'a' : 'div'"
    :href="href ?? undefined"
    :target="href ? '_blank' : undefined"
    :rel="href ? 'noopener' : undefined"
    tabindex="-1"
    aria-hidden="true"
    class="bg-muted relative block overflow-hidden"
  >
    <div
      ref="container"
      :class="[
        'pointer-events-none absolute inset-0 transition-opacity duration-300',
        loaded ? 'opacity-100' : 'opacity-0',
      ]"
    />
    <MapPin
      class="text-primary absolute top-1/2 left-1/2 size-9 -translate-x-1/2 -translate-y-full fill-[color-mix(in_oklab,var(--color-primary)_18%,var(--color-card))] drop-shadow-md"
      stroke-width="2.25"
    />
    <span
      class="bg-card/80 text-muted-foreground absolute right-1.5 bottom-1.5 rounded px-1 text-[0.625rem] leading-4"
    >
      © OpenStreetMap
    </span>
  </component>
</template>
