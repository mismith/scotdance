<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronDown, Globe, Locate, MapPinned, X } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import { useMorph } from '@/lib/morph'
import NearbyRadiusMap from '@/components/NearbyRadiusMap.vue'
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
} = useLocationFilter()

// Log-scale slider: most of the travel is in the 50–500km zone where users
// actually live, then it accelerates to continent-scale at the high end.
// The <input type=range> still operates on a linear 0–1000 abstract position;
// we convert in both directions on bind/input.
const SLIDER_STEPS = 1000
const MIN_LOG = Math.log(MIN_RADIUS_KM)
const MAX_LOG = Math.log(MAX_RADIUS_KM)

function snapKm(km: number): number {
  // Looser precision at larger radii — keeps the displayed values "nice"
  // without snapping so coarsely that the ring jumps.
  if (km < 100) return Math.round(km / 5) * 5
  if (km < 1000) return Math.round(km / 10) * 10
  return Math.round(km / 50) * 50
}

function positionToKm(pos: number): number {
  const ratio = pos / SLIDER_STEPS
  return snapKm(Math.exp(MIN_LOG + ratio * (MAX_LOG - MIN_LOG)))
}

function kmToPosition(km: number): number {
  const ratio = (Math.log(km) - MIN_LOG) / (MAX_LOG - MIN_LOG)
  return Math.round(ratio * SLIDER_STEPS)
}

const sliderPosition = computed(() => kmToPosition(radius.value))

function onSliderInput(e: Event): void {
  setRadius(positionToKm(Number((e.target as HTMLInputElement).value)))
}

type CompactDisplay =
  | { kind: 'flag'; emoji: string }
  | { kind: 'icon'; icon: typeof Locate }

const compact = computed<CompactDisplay>(() => {
  if (mode.value === 'nearby') return { kind: 'icon', icon: Locate }
  if (mode.value === 'region') {
    // Narrowed beyond country → use the Region tab's own icon to signal
    // "specific zone within the country" rather than a misleading flag.
    if (locality.value || region.value) return { kind: 'icon', icon: MapPinned }
    if (country.value) {
      const flag = countryFlag(country.value)
      if (flag) return { kind: 'flag', emoji: flag }
      return { kind: 'icon', icon: MapPinned }
    }
  }
  return { kind: 'icon', icon: Globe }
})

// The trigger says where you're looking, in words.
const compactLabel = computed(() => {
  if (mode.value === 'nearby') return `Within ${radius.value} km`
  if (mode.value === 'region') {
    if (locality.value || region.value) return locality.value || region.value
    const c = country.value
    if (c && /^[A-Z]{2}$/.test(c)) {
      try {
        return new Intl.DisplayNames(undefined, { type: 'region' }).of(c) ?? c
      } catch {
        return c
      }
    }
    return c || 'Choose region'
  }
  return 'Everywhere'
})

const countryName = (c: string) => {
  if (/^[A-Z]{2}$/.test(c)) {
    try {
      return new Intl.DisplayNames(undefined, { type: 'region' }).of(c) ?? c
    } catch {
      return c
    }
  }
  return c
}

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

const sheet = useMorph()

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
  } else {
    // Everywhere has nothing more to set, so close the sheet.
    setWorldwide()
    sheet.hide()
  }
}

// Region quick-picks: countries that actually exist in loaded comps, by count.
const quickCountries = computed(() => availableCountries(props.competitions))

// Narrow label = the part below country (locality, region). Country itself is
// already conveyed by the highlighted quick-row pill, so it's omitted here.
function buildNarrowLabel(loc: string | null, reg: string | null): string {
  return [loc, reg].filter(Boolean).join(', ')
}

function pickCountry(value: string): void {
  if (mode.value === 'region' && country.value === value && !region.value && !locality.value) {
    sheet.hide()
    return
  }
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
    sheet.hide()
  } catch (e) {
    console.error('[places]', e)
  }
}
</script>

<template>
  <button
    type="button"
    class="bg-card border-strong flex h-11 min-w-0 items-center gap-1.5 rounded-full border px-4 text-[0.9375rem] font-bold"
    :aria-label="ariaLabel"
    aria-haspopup="dialog"
    @click="sheet.show"
  >
    <span v-if="compact.kind === 'flag'" class="text-lg leading-none">{{ compact.emoji }}</span>
    <component :is="compact.icon" v-else class="text-primary size-[1.125rem] shrink-0" />
    <span class="truncate">{{ compactLabel }}</span>
    <ChevronDown class="text-muted-foreground size-4 shrink-0" />
  </button>

  <Dialog :open="sheet.open" :morph="sheet" variant="sheet" @close="sheet.hide()">
    <template #header>
      <h2 class="text-title">Where to look</h2>
    </template>
    <div class="space-y-4 p-4 pb-[calc(1.5rem+var(--safe-bottom))]">
      <ul class="bg-card divide-y overflow-hidden rounded-2xl border" role="radiogroup" aria-label="Where to look">
        <li>
          <button type="button" role="radio" :aria-checked="mode === 'nearby'" class="flex min-h-14 w-full items-center gap-3 px-4 text-left" @click="select('nearby')">
            <Locate class="text-primary size-5 shrink-0" />
            <span class="flex-1 text-base font-bold">Near me</span>
            <Check v-if="mode === 'nearby'" class="text-primary size-5" stroke-width="3" />
          </button>
          <div v-if="mode === 'nearby'" class="space-y-3 px-4 pb-4">
            <template v-if="coords">
              <NearbyRadiusMap :lat="coords.lat" :lng="coords.lng" :radius-km="radius" class="overflow-hidden rounded-xl" />
              <label class="block space-y-1">
                <span class="text-muted-foreground text-sm font-semibold">Within {{ radius }} km</span>
                <input type="range" :min="0" :max="SLIDER_STEPS" :value="sliderPosition" class="accent-primary w-full" @input="onSliderInput" />
              </label>
            </template>
            <p v-else-if="locationLoading" class="text-muted-foreground text-sm">Finding you…</p>
            <template v-else>
              <p class="text-muted-foreground text-sm">
                {{
                  locationError === 'denied' || permissionState === 'denied'
                    ? 'Location is turned off for ScotDance. Turn it on in your phone’s settings, then try again.'
                    : locationError
                      ? 'Your location couldn’t be found.'
                      : 'Show competitions near you.'
                }}
              </p>
              <button type="button" class="bg-primary text-primary-foreground flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[0.9375rem] font-bold" @click="requestPosition">
                <Locate class="size-4" /> {{ locationError ? 'Try again' : 'Use my location' }}
              </button>
            </template>
          </div>
        </li>
        <li v-for="qc in quickCountries" :key="qc.value">
          <button
            type="button"
            role="radio"
            :aria-checked="mode === 'region' && country === qc.value"
            class="flex min-h-14 w-full items-center gap-3 px-4 text-left"
            @click="pickCountry(qc.value)"
          >
            <span class="w-5 text-center text-xl leading-none">{{ countryFlag(qc.value) ?? '🌐' }}</span>
            <span class="flex-1 text-base font-bold">{{ countryName(qc.value) }}</span>
            <Check v-if="mode === 'region' && country === qc.value" class="text-primary size-5" stroke-width="3" />
          </button>
          <div v-if="mode === 'region' && country === qc.value" class="space-y-2 px-4 pb-4">
            <div class="relative">
              <input
                v-model="inputValue"
                type="search"
                placeholder="Narrow to a city or province"
                autocomplete="off"
                class="bg-card border-strong focus:border-primary h-12 w-full rounded-xl border-2 px-3 pr-10 text-base outline-none [&::-webkit-search-cancel-button]:hidden"
                @input="scheduleSearch"
              />
              <button
                v-if="region || locality || inputValue"
                type="button"
                aria-label="Clear city or province"
                class="text-muted-foreground absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-full"
                @click="clearNarrow"
              >
                <X class="size-5" />
              </button>
            </div>
            <ul v-if="suggestions.length" class="divide-y overflow-hidden rounded-xl border">
              <li v-for="s in suggestions" :key="s.placeId">
                <button type="button" class="w-full px-3 py-2.5 text-left hover:bg-accent" @click="pickSuggestion(s)">
                  <span class="block text-base font-semibold">{{ s.primaryText }}</span>
                  <span v-if="s.secondaryText" class="text-muted-foreground block text-sm">{{ s.secondaryText }}</span>
                </button>
              </li>
            </ul>
            <p v-else-if="searching" class="text-muted-foreground text-sm">Searching…</p>
          </div>
        </li>
        <li>
          <button type="button" role="radio" :aria-checked="mode === 'worldwide'" class="flex min-h-14 w-full items-center gap-3 px-4 text-left" @click="select('worldwide')">
            <Globe class="text-primary size-5 shrink-0" />
            <span class="flex-1 text-base font-bold">Everywhere</span>
            <Check v-if="mode === 'worldwide'" class="text-primary size-5" stroke-width="3" />
          </button>
        </li>
      </ul>
      <button type="button" class="bg-primary text-primary-foreground h-12 w-full rounded-xl text-base font-bold" @click="sheet.hide()">Done</button>
    </div>
  </Dialog>
</template>
