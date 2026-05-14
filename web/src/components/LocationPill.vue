<script setup lang="ts">
import { computed, ref } from 'vue'
import { Globe, LocateFixed, MapPin } from '@lucide/vue'
import ExpandingPill from '@/components/ExpandingPill.vue'
import { useLocationFilter, type LocationMode } from '@/composables/useLocationFilter'
import { countryFlag, regionFlag } from '@/lib/flagEmoji'
import { fetchRegionSuggestions, resolvePlace, type PlaceSuggestion } from '@/lib/maps'

const {
  mode,
  radius,
  country,
  region,
  locality,
  locationError,
  locationLoading,
  setNearby,
  setRegion,
  setWorldwide,
  setRadius,
  MIN_RADIUS_KM,
  MAX_RADIUS_KM,
  RADIUS_STEP_KM,
} = useLocationFilter()

type CompactDisplay =
  | { kind: 'flag'; emoji: string }
  | { kind: 'icon'; icon: typeof MapPin }

const compact = computed<CompactDisplay>(() => {
  if (mode.value === 'nearby') return { kind: 'icon', icon: LocateFixed }
  if (mode.value === 'region') {
    if (locality.value) return { kind: 'icon', icon: MapPin }
    if (region.value) {
      const flag = regionFlag(country.value, region.value)
      if (flag) return { kind: 'flag', emoji: flag }
      return { kind: 'icon', icon: MapPin }
    }
    if (country.value) {
      const flag = countryFlag(country.value)
      if (flag) return { kind: 'flag', emoji: flag }
      return { kind: 'icon', icon: MapPin }
    }
  }
  return { kind: 'icon', icon: Globe }
})

const regionSummary = computed(() => {
  const parts = [locality.value, region.value, country.value].filter(Boolean)
  return parts.join(', ')
})

const ariaLabel = computed(() => {
  if (mode.value === 'nearby') return `Location: nearby (${radius.value}km)`
  if (mode.value === 'region')
    return `Location: ${regionSummary.value || 'region (not set)'}`
  return 'Location: worldwide'
})

const options: Array<{ id: LocationMode; label: string }> = [
  { id: 'nearby', label: 'Nearby' },
  { id: 'region', label: 'Region' },
  { id: 'worldwide', label: 'Worldwide' },
]

function select(id: LocationMode): void {
  if (id === mode.value) return
  if (id === 'nearby') setNearby()
  else if (id === 'region') setRegion()
  else setWorldwide()
}

// Region autocomplete state. Event-driven (not watch) so programmatic
// updates — pick + Clear — don't re-trigger a search.
const inputValue = ref<string>(regionSummary.value)
const suggestions = ref<PlaceSuggestion[]>([])
const searching = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSearch(): void {
  if (searchTimer) clearTimeout(searchTimer)
  const q = inputValue.value.trim()
  if (!q) {
    suggestions.value = []
    searching.value = false
    return
  }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      suggestions.value = await fetchRegionSuggestions(q)
    } catch (e) {
      console.error('[places]', e)
      suggestions.value = []
    } finally {
      searching.value = false
    }
  }, 200)
}

async function pickSuggestion(s: PlaceSuggestion): Promise<void> {
  try {
    const picked = await resolvePlace(s.placeId)
    if (!picked) return
    setRegion({
      country: picked.country,
      region: picked.region,
      locality: picked.locality,
    })
    inputValue.value = picked.label
    suggestions.value = []
  } catch (e) {
    console.error('[places]', e)
  }
}

function clearRegion(): void {
  setRegion({ country: null, region: null, locality: null })
  inputValue.value = ''
  suggestions.value = []
}
</script>

<template>
  <ExpandingPill id="location" :aria-label="ariaLabel">
    <template #compact>
      <span v-if="compact.kind === 'flag'" class="text-base leading-none">
        {{ compact.emoji }}
      </span>
      <component :is="compact.icon" v-else class="size-4" />
    </template>

    <template #expanded>
      <div class="w-full">
        <!-- Toggle row — identical shape to DatePill. The mode-specific
             editor lives in its own row below; the buttons stay equal-width. -->
        <div class="flex h-12 w-full items-center gap-1 px-1">
          <button
            v-for="opt in options"
            :key="opt.id"
            type="button"
            :class="[
              'inline-flex h-10 flex-1 items-center justify-center rounded-full px-4 font-sans text-sm font-medium transition-colors',
              mode === opt.id
                ? 'bg-nav-foreground/15'
                : 'opacity-70 hover:opacity-100',
            ]"
            @click="select(opt.id)"
          >
            {{ opt.label }}
          </button>
        </div>

        <!-- Per-mode editor row -->
        <div v-if="mode === 'nearby'" class="space-y-1 px-4 pt-1 pb-3">
          <input
            type="range"
            :min="MIN_RADIUS_KM"
            :max="MAX_RADIUS_KM"
            :step="RADIUS_STEP_KM"
            :value="radius"
            class="w-full"
            @input="setRadius(Number(($event.target as HTMLInputElement).value))"
          />
          <div class="text-muted-foreground flex justify-between text-[10px] tabular-nums">
            <span>{{ MIN_RADIUS_KM }}km</span>
            <span>{{ MAX_RADIUS_KM }}km</span>
          </div>
          <p
            v-if="locationLoading"
            class="text-muted-foreground pt-1 text-xs"
          >
            Locating…
          </p>
          <p
            v-else-if="locationError === 'denied'"
            class="text-muted-foreground pt-1 text-xs"
          >
            Location permission denied. Enable it in your device settings.
          </p>
          <p
            v-else-if="locationError"
            class="text-muted-foreground pt-1 text-xs"
          >
            Couldn't get your location. Tap Nearby again to retry.
          </p>
        </div>

        <div v-else-if="mode === 'region'" class="space-y-2 px-3 pt-1 pb-3">
          <div class="flex items-center gap-2">
            <input
              v-model="inputValue"
              type="search"
              placeholder="Country, state, or city…"
              autocomplete="off"
              class="bg-background/50 border-nav-foreground/15 placeholder:text-muted-foreground/70 min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none"
              @input="scheduleSearch"
            />
            <button
              v-if="regionSummary"
              type="button"
              class="text-muted-foreground hover:text-foreground text-xs"
              @click="clearRegion"
            >
              Clear
            </button>
          </div>
          <ul
            v-if="suggestions.length"
            class="border-nav-foreground/10 max-h-56 overflow-y-auto rounded-lg border"
          >
            <li v-for="s in suggestions" :key="s.placeId">
              <button
                type="button"
                class="hover:bg-nav-foreground/10 w-full px-3 py-2 text-left"
                @click="pickSuggestion(s)"
              >
                <div class="text-sm">{{ s.primaryText }}</div>
                <div
                  v-if="s.secondaryText"
                  class="text-muted-foreground text-xs"
                >
                  {{ s.secondaryText }}
                </div>
              </button>
            </li>
          </ul>
          <p
            v-else-if="searching"
            class="text-muted-foreground text-xs"
          >
            Searching…
          </p>
          <p
            v-else-if="inputValue && !suggestions.length"
            class="text-muted-foreground text-xs"
          >
            No matches.
          </p>
        </div>
      </div>
    </template>
  </ExpandingPill>
</template>
