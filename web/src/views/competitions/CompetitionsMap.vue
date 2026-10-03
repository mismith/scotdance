<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { onKeyStroke, useMediaQuery } from '@vueuse/core'
import * as maplibregl from 'maplibre-gl'
import type { Map as MaplibreMap, Marker as MaplibreMarker } from 'maplibre-gl'
import Supercluster from 'supercluster'
import { ChevronRight, ChevronUp, X } from '@lucide/vue'
import CompetitionDateRow from '@/components/CompetitionDateRow.vue'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import { useFavoritesStore } from '@/stores/favorites'
import { createMap, persistCamera, styleUrlFor } from '@/lib/maplibre'
import { parseDate } from '@/lib/format'
import { useTheme } from '@/composables/useTheme'
import { groupByVenue, type VenueGroup } from '@/lib/venues'

// The competitions as a place: the map fills the screen under the page's
// header. Each venue is a pin showing its next date; tapping one grows a
// callout listing what's on there. A sheet along the bottom lists what's in
// view and follows the map as it moves. Choosing a location flies there.
const props = defineProps<{
  /** In the order the list would show them. */
  competitions: CompetitionListItem[]
  /** Changes when the location (or Upcoming/Past) does: the map fits to what's left. */
  fitKey: string
}>()

const favorites = useFavoritesStore()
const { isDark } = useTheme()
const wide = useMediaQuery('(min-width: 768px)')

const mapContainer = ref<HTMLElement | null>(null)
const mapInstance = shallowRef<MaplibreMap | null>(null)
const mapReady = ref(false)

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
  const sc = new Supercluster<PinProps, ClusterProps>({ radius: 60, maxZoom: 16 })
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

const shortDate = (c: CompetitionListItem) =>
  c.date ? parseDate(c.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'TBA'

// A pin is its venue's next (or, under Past results, latest) date, with how
// many more are on there.
function pinElement(group: VenueGroup, idx: number): HTMLElement {
  const el = document.createElement('button')
  el.type = 'button'
  const fav = group.competitions.some((c) => favorites.isFavoriteCompetition(c.id))
  el.className = `map-pin${fav ? ' is-fav' : ''}`
  const n = group.competitions.length
  el.setAttribute(
    'aria-label',
    `${group.venue || group.location || 'Venue'}: ${n} competition${n === 1 ? '' : 's'}, ${shortDate(group.competitions[0])}`,
  )
  const pill = document.createElement('span')
  pill.className = 'map-pin-label'
  pill.textContent = shortDate(group.competitions[0])
  if (n > 1) {
    const more = document.createElement('span')
    more.className = 'map-pin-more'
    more.textContent = `+${n - 1}`
    pill.append(more)
  }
  const tail = document.createElement('span')
  tail.className = 'map-pin-tail'
  el.append(pill, tail)
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    select(idx)
  })
  return el
}

function renderMarkers(): void {
  const map = mapInstance.value
  const sc = cluster.value
  if (!map || !sc) return

  const b = map.getBounds()
  const features = sc.getClusters([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], Math.floor(map.getZoom())) as Feature[]
  const seen = new Set<string>()

  for (const f of features) {
    const [lng, lat] = f.geometry.coordinates
    const { properties } = f
    const key = properties.cluster ? `c:${properties.cluster_id}` : `p:${properties.idx}`
    seen.add(key)
    if (markers.has(key)) continue

    let el: HTMLElement
    if (properties.cluster) {
      el = document.createElement('button')
      ;(el as HTMLButtonElement).type = 'button'
      el.className = 'map-cluster'
      el.textContent = String(properties.point_count_abbreviated)
      el.setAttribute('aria-label', `${properties.point_count} venues: zoom in`)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        const zoom = sc.getClusterExpansionZoom(properties.cluster_id)
        map.easeTo({ center: [lng, lat], zoom: Math.min(zoom, 18) })
      })
    } else {
      el = pinElement(venueGroups.value[properties.idx], properties.idx)
    }

    const marker = new maplibregl.Marker({ element: el, anchor: properties.cluster ? 'center' : 'bottom' })
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

// ─── The callout ─────────────────────────────────────────────────────────────
// Where the chosen pin is on screen, kept up to date as the map moves.
const selected = ref<number | null>(null)
const selectedGroup = computed(() => (selected.value == null ? null : (venueGroups.value[selected.value] ?? null)))
const at = ref<{ x: number; y: number } | null>(null)
const venueId = computed(
  () =>
    selectedGroup.value?.competitions
      .map((c) => (c as { venueId?: string }).venueId)
      .find((id): id is string => !!id) ?? null,
)

function place() {
  const map = mapInstance.value
  const g = selectedGroup.value
  if (!map || !g) return (at.value = null)
  const p = map.project([g.lng, g.lat])
  const half = 152
  at.value = { x: Math.min(Math.max(p.x, half + 8), map.getContainer().clientWidth - half - 8), y: p.y }
}

function select(idx: number) {
  const map = mapInstance.value
  const g = venueGroups.value[idx]
  if (!map || !g) return
  selected.value = idx
  place()
  // Room above the pin for the callout (about 20rem), clear of the controls.
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const below = (wide.value ? 4.5 : 7.5) * rem + 20 * rem
  const p = map.project([g.lng, g.lat])
  if (p.y < below) {
    map.easeTo({ center: [g.lng, g.lat], offset: [0, below - map.getContainer().clientHeight / 2], duration: 300 })
  }
}
const unselect = () => (selected.value = null)
onKeyStroke('Escape', unselect)

// ─── What's in view ──────────────────────────────────────────────────────────
const inView = ref<CompetitionListItem[]>([])
const sheetOpen = ref(false)
function syncInView() {
  const map = mapInstance.value
  if (!map) return
  const b = map.getBounds()
  inView.value = props.competitions.filter(
    (c) => Number.isFinite(c.lat) && Number.isFinite(c.lng) && b.contains([c.lng as number, c.lat as number]),
  )
}
const sheetTitle = computed(() => {
  const n = inView.value.length
  return n ? `${n} competition${n === 1 ? '' : 's'} in view` : 'Nothing in view'
})

// ─── Fitting to the chosen location ──────────────────────────────────────────
// Once per location (or Upcoming/Past) a session, so a map someone has moved
// around stays where they left it when they come back to it.
const FITTED = 'competitions:map:fitted'
function fit(animate: boolean) {
  const map = mapInstance.value
  const groups = venueGroups.value
  if (!map || !groups.length) return
  const bounds = new maplibregl.LngLatBounds()
  for (const g of groups) bounds.extend([g.lng, g.lat])
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  map.fitBounds(bounds, {
    // Clear of the header along the top and the sheet along the bottom.
    padding: wide.value
      ? { top: 10 * rem, bottom: 10 * rem, left: 3 * rem, right: 3 * rem }
      : { top: 10 * rem, bottom: 13 * rem, left: 2.5 * rem, right: 2.5 * rem },
    maxZoom: 11,
    duration: animate ? 900 : 0,
  })
  try {
    sessionStorage.setItem(FITTED, props.fitKey)
  } catch {
    /* noop */
  }
}
const fittedFor = () => {
  try {
    return sessionStorage.getItem(FITTED)
  } catch {
    return null
  }
}

onMounted(() => {
  if (!mapContainer.value) return
  const map = createMap(mapContainer.value, { style: styleUrlFor(isDark.value) })
  mapInstance.value = map
  // Swap the basemap when the app theme flips. setStyle keeps DOM markers
  // and camera position; only the tile style is replaced.
  watch(isDark, (dark) => map.setStyle(styleUrlFor(dark)))
  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      showUserLocation: true,
      fitBoundsOptions: { maxZoom: 12, duration: 400 },
    }),
    'top-right',
  )
  map.on('load', () => {
    mapReady.value = true
    // MapLibre's compact attribution starts expanded; collapse it on load
    // so it doesn't eat half the bottom of the map until first interaction.
    map.getContainer().querySelector('.maplibregl-ctrl-attrib.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show')
    rebuildCluster()
    if (fittedFor() !== props.fitKey) fit(false)
    renderMarkers()
    syncInView()
  })
  map.on('move', place)
  map.on('moveend', () => {
    persistCamera(map)
    renderMarkers()
    syncInView()
  })
  map.on('click', unselect)
})

onBeforeUnmount(() => {
  clearMarkers()
  mapInstance.value?.remove()
  mapInstance.value = null
})

watch(venueGroups, () => {
  if (!mapReady.value) return
  unselect()
  clearMarkers()
  rebuildCluster()
  // The list arriving (or changing) after the map: fit to it once.
  if (fittedFor() !== props.fitKey) fit(true)
  renderMarkers()
  syncInView()
})
watch(
  () => props.fitKey,
  () => mapReady.value && fit(true),
)
</script>

<template>
  <div class="comp-map">
    <div ref="mapContainer" class="size-full" />

    <!-- A venue's competitions, grown out of its pin. -->
    <Transition
      enter-from-class="scale-50 opacity-0"
      enter-active-class="transition-[scale,opacity] duration-(--dur-base) ease-snappy motion-reduce:transition-opacity"
      leave-active-class="transition-[scale,opacity] duration-(--dur-quick) ease-exit"
      leave-to-class="scale-90 opacity-0"
    >
      <section
        v-if="selectedGroup && at"
        class="surface-raised absolute z-20 w-76 origin-bottom overflow-hidden rounded-2xl"
        :style="{ left: `${at.x}px`, top: `${at.y - 40}px`, translate: '-50% -100%' }"
        :aria-label="selectedGroup.venue || 'Venue'"
      >
        <header class="flex items-center gap-1 py-1 pr-1 pl-4">
          <component
            :is="venueId ? RouterLink : 'div'"
            :to="venueId ? { name: 'venue.info', params: { venueId } } : undefined"
            :class="['flex min-w-0 flex-1 items-center gap-1 py-1.5', venueId && 'press-row -my-1 -ml-4 rounded-lg py-2.5 pl-4']"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base font-semibold">{{ selectedGroup.venue || selectedGroup.location }}</span>
              <span v-if="selectedGroup.venue && selectedGroup.location" class="text-muted-foreground block truncate text-sm">
                {{ selectedGroup.location }}
              </span>
            </span>
            <ChevronRight v-if="venueId" class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
          </component>
          <button type="button" class="press text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-full" aria-label="Close" @click="unselect">
            <X class="size-5" />
          </button>
        </header>
        <ul class="rows-inset max-h-64 overflow-y-auto shadow-[inset_0_1px_0_var(--border)] [--inset:4.5rem]">
          <CompetitionDateRow
            v-for="c in selectedGroup.competitions"
            :key="c.id"
            :competition="c"
            :to="{ name: 'competition.info', params: { competitionId: c.id } }"
            :followed="favorites.isFavorite('competitions', c.id)"
            class="bg-transparent!"
          />
        </ul>
      </section>
    </Transition>

    <!-- What's in view, following the map. -->
    <section
      class="glass absolute inset-x-2 bottom-[calc(var(--chrome-bottom)+0.5rem)] z-10 overflow-hidden rounded-3xl md:inset-x-auto md:bottom-6 md:left-6 md:w-96"
      aria-label="Competitions in view"
    >
      <button
        type="button"
        class="press-row focus-inset flex h-12 w-full items-center gap-2 px-4 text-left"
        :aria-expanded="sheetOpen"
        :disabled="inView.length < 2"
        @click="sheetOpen = !sheetOpen"
      >
        <span class="flex-1 text-base font-semibold">{{ sheetTitle }}</span>
        <ChevronUp
          v-if="inView.length > 1"
          :class="['text-muted-foreground size-5 transition-transform duration-(--dur-base) ease-snappy', sheetOpen && 'rotate-180']"
          aria-hidden="true"
        />
      </button>
      <ul v-if="inView.length" class="rows-inset [--inset:4.5rem]">
        <CompetitionDateRow
          :competition="inView[0]"
          :to="{ name: 'competition.info', params: { competitionId: inView[0].id } }"
          :followed="favorites.isFavorite('competitions', inView[0].id)"
          class="bg-transparent!"
        />
      </ul>
      <div
        :class="[
          'grid transition-[grid-template-rows] duration-(--dur-base) ease-standard motion-reduce:transition-none',
          sheetOpen && inView.length > 1 ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        ]"
      >
        <div class="min-h-0 overflow-hidden">
          <ul class="rows-inset max-h-[45dvh] overflow-y-auto [--inset:4.5rem]" :inert="!sheetOpen">
            <CompetitionDateRow
              v-for="c in inView.slice(1)"
              :key="c.id"
              :competition="c"
              :to="{ name: 'competition.info', params: { competitionId: c.id } }"
              :followed="favorites.isFavorite('competitions', c.id)"
              class="bg-transparent! shadow-[inset_0_1px_0_var(--border)]"
            />
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>

<style>
/* Tailwind v4 isolates SFC <style> blocks — reference the main stylesheet
   so @apply can see its utilities. MapLibre makes these nodes itself. */
@reference '../../style.css';

/* Clear of the page's header along the top, in line with its edge. */
.comp-map .maplibregl-ctrl-top-right {
  @apply top-[7.75rem] right-4;
}
.comp-map .maplibregl-ctrl-bottom-right,
.comp-map .maplibregl-ctrl-bottom-left {
  @apply bottom-[calc(var(--chrome-bottom)+6.5rem)] md:bottom-2;
}
.comp-map .maplibregl-ctrl-group:has(> .maplibregl-ctrl-geolocate) {
  @apply glass m-0 overflow-hidden rounded-full;
}
.comp-map .maplibregl-ctrl-group:has(> .maplibregl-ctrl-geolocate) > button {
  @apply size-11 rounded-full border-none bg-transparent;
}
.dark .comp-map .maplibregl-ctrl-geolocate .maplibregl-ctrl-icon {
  @apply invert;
}

.map-pin {
  @apply flex cursor-pointer flex-col items-center border-none bg-transparent p-0 transition-transform duration-(--dur-quick) ease-snappy;
  filter: drop-shadow(0 2px 4px rgb(0 0 0 / 0.25));
  transform-origin: bottom center;
}
.map-pin:hover {
  @apply scale-110;
}
.map-pin-label {
  @apply bg-primary-fill text-primary-foreground flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap tabular-nums;
}
.map-pin-more {
  @apply opacity-75;
}
.map-pin-tail {
  @apply border-t-primary-fill -mt-px h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent;
}
.map-pin.is-fav .map-pin-label {
  @apply bg-secondary text-secondary-foreground;
}
.map-pin.is-fav .map-pin-tail {
  @apply border-t-secondary;
}
.map-cluster {
  @apply bg-primary-fill text-primary-foreground flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white px-2.5 text-sm font-semibold tabular-nums shadow-[0_2px_6px_rgb(0_0_0/0.25)] transition-transform duration-(--dur-quick) ease-snappy;
}
.map-cluster:hover {
  @apply scale-105;
}
</style>
