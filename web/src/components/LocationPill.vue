<script setup lang="ts">
import { computed, ref } from 'vue'
import { Globe, Locate, LandPlot, X } from '@lucide/vue'
import ExpandingPill from '@/components/ExpandingPill.vue'
import { useLocationFilter, type LocationMode } from '@/composables/useLocationFilter'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import { countryFlag, isoFor } from '@/lib/flagEmoji'
import { guessUserCountry } from '@/lib/locale'
import { fetchRegionSuggestions, resolvePlace, type PlaceSuggestion } from '@/lib/maps'

const props = defineProps<{ competitions: CompetitionListItem[] }>()

const {
  mode,
  radius,
  country,
  region,
  locality,
  coords,
  locationError,
  locationLoading,
  permissionState,
  setNearby,
  setRegion,
  setWorldwide,
  setRadius,
  requestPosition,
  availableCountries,
  MIN_RADIUS_KM,
  MAX_RADIUS_KM,
  RADIUS_STEP_KM,
} = useLocationFilter()

type CompactDisplay =
  | { kind: 'flag'; emoji: string }
  | { kind: 'icon'; icon: typeof Locate }

const compact = computed<CompactDisplay>(() => {
  if (mode.value === 'nearby') return { kind: 'icon', icon: Locate }
  if (mode.value === 'region') {
    // Narrowed beyond country → use the Region tab's own icon to signal
    // "specific zone within the country" rather than a misleading flag.
    if (locality.value || region.value) return { kind: 'icon', icon: LandPlot }
    if (country.value) {
      const flag = countryFlag(country.value)
      if (flag) return { kind: 'flag', emoji: flag }
      return { kind: 'icon', icon: LandPlot }
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

const options: Array<{ id: LocationMode; label: string; icon: typeof Globe }> = [
  { id: 'nearby', label: 'Nearby', icon: Locate },
  { id: 'region', label: 'Region', icon: LandPlot },
  { id: 'worldwide', label: 'Worldwide', icon: Globe },
]

// Choose a sensible default country when the user enters Region mode with
// none set: prefer their TZ/locale guess (matched against comps that exist
// in our data via ISO normalization), and only fall back to the most-populous
// country if the guess doesn't land on anything we have.
function defaultRegionCountry(): string | null {
  const guess = guessUserCountry()
  if (guess) {
    const match = quickCountries.value.find((qc) => isoFor(qc.value) === guess)
    if (match) return match.value
  }
  return quickCountries.value[0]?.value ?? null
}

function select(id: LocationMode): void {
  if (id === mode.value) return
  if (id === 'nearby') setNearby()
  else if (id === 'region') {
    if (!country.value) {
      const fallback = defaultRegionCountry()
      if (fallback) {
        setRegion({ country: fallback, region: null, locality: null })
        return
      }
    }
    setRegion()
  } else setWorldwide()
}

// Region quick-picks: countries that actually exist in loaded comps, by count.
const quickCountries = computed(() => availableCountries(props.competitions))

// Narrow label = the part below country (locality, region). Country itself is
// already conveyed by the highlighted quick-row pill, so it's omitted here.
function buildNarrowLabel(loc: string | null, reg: string | null): string {
  return [loc, reg].filter(Boolean).join(', ')
}

function pickCountry(value: string): void {
  setRegion({ country: value, region: null, locality: null })
  inputValue.value = ''
  suggestions.value = []
}

function clearNarrow(): void {
  setRegion({ country: country.value, region: null, locality: null })
  inputValue.value = ''
  suggestions.value = []
}

// Region autocomplete state. Event-driven (not watch) so programmatic
// updates — pick + Clear — don't re-trigger a search. Initialized from
// persisted state so a returning user sees their current narrow selection.
const inputValue = ref<string>(buildNarrowLabel(locality.value, region.value))
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
      // Bias by country ISO if available — narrows to states/cities within
      // the selected country instead of returning global matches.
      const bias = isoFor(country.value)
      suggestions.value = await fetchRegionSuggestions(q, bias)
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
    inputValue.value = buildNarrowLabel(picked.locality, picked.region)
    suggestions.value = []
  } catch (e) {
    console.error('[places]', e)
  }
}
</script>

<template>
  <ExpandingPill id="location" :aria-label="ariaLabel">
    <template #compact>
      <span v-if="compact.kind === 'flag'" class="text-xl leading-none">
        {{ compact.emoji }}
      </span>
      <component :is="compact.icon" v-else class="size-5" />
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
              'inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-4 font-sans text-sm font-medium transition-colors',
              mode === opt.id ? 'bg-nav-foreground/15' : 'opacity-70 hover:opacity-100',
            ]"
            @click="select(opt.id)"
          >
            <component :is="opt.icon" class="hidden size-4 md:inline-block" />
            {{ opt.label }}
          </button>
        </div>

        <!-- Nearby editor -->
        <div v-if="mode === 'nearby'" class="space-y-2 px-3 pt-1 pb-3">
          <!-- Has a fix: show the slider -->
          <template v-if="coords">
            <input
              type="range"
              :min="MIN_RADIUS_KM"
              :max="MAX_RADIUS_KM"
              :step="RADIUS_STEP_KM"
              :value="radius"
              class="w-full"
              @input="setRadius(Number(($event.target as HTMLInputElement).value))"
            />
            <div
              class="text-muted-foreground flex justify-between text-[10px] tabular-nums"
            >
              <span>{{ MIN_RADIUS_KM }}km</span>
              <span>{{ MAX_RADIUS_KM }}km</span>
            </div>
          </template>

          <!-- Locating -->
          <p v-else-if="locationLoading" class="text-muted-foreground pt-1 text-xs">
            Locating…
          </p>

          <!-- Permission blocked: be honest that we can't open settings for them -->
          <div
            v-else-if="locationError === 'denied' || permissionState === 'denied'"
            class="space-y-2"
          >
            <p class="text-muted-foreground text-xs">
              Location access is blocked. Enable it in your browser or device settings,
              then tap Retry.
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                class="bg-nav-foreground/15 hover:bg-nav-foreground/25 inline-flex h-10 flex-1 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors"
                @click="requestPosition"
              >
                Retry
              </button>
              <button
                type="button"
                class="hover:bg-nav-foreground/10 text-muted-foreground hover:text-foreground inline-flex h-10 flex-1 items-center justify-center rounded-full px-4 text-sm transition-colors"
                @click="setWorldwide"
              >
                Use Worldwide
              </button>
            </div>
          </div>

          <!-- Timeout / unavailable -->
          <div v-else-if="locationError" class="space-y-2">
            <p class="text-muted-foreground text-xs">
              Couldn't get your location. Try again?
            </p>
            <button
              type="button"
              class="bg-nav-foreground/15 hover:bg-nav-foreground/25 inline-flex h-10 w-full items-center justify-center rounded-full px-4 text-sm font-medium transition-colors"
              @click="requestPosition"
            >
              Try again
            </button>
          </div>

          <!-- Priming state: first time, or unknown perms. Don't auto-fire
               the OS prompt — make the user opt in with an explicit tap. -->
          <div v-else class="space-y-2">
            <p class="text-muted-foreground text-xs">
              Show competitions near you. We'll only ask for your location when you tap
              below.
            </p>
            <button
              type="button"
              class="bg-nav-foreground/15 hover:bg-nav-foreground/25 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors"
              @click="requestPosition"
            >
              <Locate class="size-4" />
              Use my location
            </button>
          </div>
        </div>

        <!-- Region editor -->
        <div v-else-if="mode === 'region'" class="space-y-2 px-3 pt-1 pb-3">
          <!-- Quick country picks: only countries with comps, sorted by count -->
          <div v-if="quickCountries.length" class="flex gap-1.5 overflow-x-auto pb-1">
            <button
              v-for="qc in quickCountries"
              :key="qc.value"
              type="button"
              :class="[
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors',
                country === qc.value
                  ? 'bg-nav-foreground/15'
                  : 'bg-nav-foreground/5 opacity-80 hover:opacity-100',
              ]"
              @click="pickCountry(qc.value)"
            >
              <span class="text-base leading-none">
                {{ countryFlag(qc.value) ?? '🌐' }}
              </span>
              <span class="hidden md:inline">{{ qc.value }}</span>
            </button>
          </div>

          <!-- Narrow further: search input. Bias changes when a country is set.
               Shows the picked region/locality as its value (with inline clear). -->
          <div class="relative">
            <input
              v-model="inputValue"
              type="search"
              placeholder="Narrow to a city or province…"
              autocomplete="off"
              :class="[
                'bg-background/50 border-nav-foreground/15 placeholder:text-muted-foreground/70 w-full rounded-full border px-4 py-2 text-base focus:outline-none',
                region || locality ? 'pr-10' : '',
                '[&::-webkit-search-cancel-button]:hidden',
              ]"
              @input="scheduleSearch"
            />
            <button
              v-if="region || locality"
              type="button"
              aria-label="Clear region/city"
              class="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full"
              @click="clearNarrow"
            >
              <X class="size-4" />
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
                <div v-if="s.secondaryText" class="text-muted-foreground text-xs">
                  {{ s.secondaryText }}
                </div>
              </button>
            </li>
          </ul>
          <p v-else-if="searching" class="text-muted-foreground text-xs">Searching…</p>
        </div>
      </div>
    </template>
  </ExpandingPill>
</template>
