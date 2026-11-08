<script setup lang="ts">
import { computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { Check, ChevronDown, ChevronsUpDown, Globe, Locate, MapPinned } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/Dialog.vue'
import { useMorph } from '@/lib/morph'
import NearbyRadiusMap from '@/components/NearbyRadiusMap.vue'
import { useLocationFilter, type LocationMode } from '@/composables/useLocationFilter'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import { countryFlag, countryName, isoFor } from '@/lib/flagEmoji'
import { guessUserCountry } from '@/lib/locale'
import { regionName, regionsWord } from '@/lib/regionNames'
import { selectionHaptic } from '@/lib/haptics'

const props = defineProps<{ competitions: CompetitionListItem[] }>()

const {
  mode,
  radius,
  country,
  regions,
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
  availableRegions,
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
    if (locality.value || regions.value.length) return { kind: 'icon', icon: MapPinned }
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
  // No position yet means nothing is filtered: don't claim a distance.
  if (mode.value === 'nearby') return coords.value ? `Within ${radius.value} km` : 'Near me'
  if (mode.value === 'region') {
    if (locality.value) return locality.value
    if (regions.value.length) return pillRegions.value
    return country.value ? countryName(country.value) : 'Choose region'
  }
  return 'Everywhere'
})

const regionSummary = computed(() => {
  const parts = [locality.value, regions.value.length ? pickedLabel.value : null, country.value].filter(Boolean)
  return parts.join(', ')
})

const ariaLabel = computed(() => {
  if (mode.value === 'nearby') return coords.value ? `Location: within ${radius.value} km` : 'Location: near me'
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

// A sheet on phones (an inset list); on wider screens a popover under the
// pill (menu rows).
const sheet = useMorph()
const wide = useMediaQuery('(min-width: 768px)')
const row = computed(() =>
  wide.value
    ? 'press-row focus-inset flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left'
    : 'press-row focus-inset flex min-h-13 w-full items-center gap-3 px-4 text-left',
)
const inset = computed(() => (wide.value ? 'px-3' : 'px-4'))

function select(id: LocationMode): void {
  if (id === mode.value) return
  if (id === 'nearby') setNearby()
  else if (id === 'region') {
    if (!country.value) {
      const fallback = defaultRegionCountry()
      if (fallback) {
        setRegion({ country: fallback })
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

function pickCountry(value: string): void {
  if (mode.value === 'region' && country.value === value && !regions.value.length && !locality.value) {
    sheet.hide()
    return
  }
  setRegion({ country: value })
}

// The country's provinces (or states) that have competitions, A to Z, in a
// menu under it: tick any number, or none for all of them. A town picked in
// Search shows here too, until a province is ticked.
const regionMenu = useMorph()
const nameOf = (r: string) => regionName(country.value, r)
const regionChoices = computed(() =>
  [...new Set([...availableRegions(props.competitions, country.value), ...regions.value])].sort((a, b) =>
    nameOf(a).localeCompare(nameOf(b)),
  ),
)
const allRegions = computed(() => `All ${regionsWord(country.value)}`)
// Alberta, Saskatchewan; Alberta + 2 for three or more.
const pickedLabel = computed(() => {
  const names = regions.value.map(nameOf).sort((a, b) => a.localeCompare(b))
  return names.length < 3 ? names.join(', ') : `${names[0]} + ${names.length - 1}`
})
// The pill is short: one by name, more by code (AB, SK; AB, BC + 2 past three).
const pillRegions = computed(() => {
  const picked = [...regions.value].sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
  if (picked.length === 1) return nameOf(picked[0]!)
  return picked.length <= 3 ? picked.join(', ') : `${picked.slice(0, 2).join(', ')} + ${picked.length - 2}`
})
const narrowLabel = computed(() => locality.value || (regions.value.length ? pickedLabel.value : allRegions.value))

// It grows out of the arrows, not the whole field (wider than the menu), and
// hangs under the field (its anchor).
function openRegionMenu(e: MouseEvent): void {
  const field = e.currentTarget as HTMLElement
  regionMenu.show(field.querySelector<HTMLElement>('[data-grow-from]') ?? field)
}

function toggleRegion(r: string): void {
  selectionHaptic()
  const picked = regions.value.includes(r) ? regions.value.filter((x) => x !== r) : [...regions.value, r]
  setRegion({ country: country.value, regions: picked })
}
function pickAllRegions(): void {
  if (regions.value.length || locality.value) selectionHaptic()
  setRegion({ country: country.value })
  regionMenu.hide()
}
</script>

<template>
  <button
    type="button"
    class="press button-fill flex h-11 min-w-0 items-center gap-1.5 rounded-full px-4 text-callout font-semibold"
    :aria-label="ariaLabel"
    aria-haspopup="dialog"
    :aria-expanded="sheet.open"
    @click="sheet.show($event)"
  >
    <span v-if="compact.kind === 'flag'" class="text-lg leading-none" aria-hidden="true">{{ compact.emoji }}</span>
    <component :is="compact.icon" v-else class="text-primary size-[1.125rem] shrink-0" aria-hidden="true" />
    <span class="truncate">{{ compactLabel }}</span>
    <ChevronDown class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
  </button>

  <Dialog
    :open="sheet.open"
    :morph="sheet"
    :variant="wide ? 'dropdown' : 'sheet'"
    aria-label="Where to look"
    :class="wide && 'w-96'"
    @close="sheet.hide()"
  >
    <template #header>
      <h2 class="text-title">Where to look</h2>
    </template>
    <div :class="wide ? 'space-y-1.5' : 'space-y-4 p-4 pb-[calc(1.5rem+var(--safe-bottom))]'">
      <ul
        :class="!wide && 'rows-engraved -mx-4 [--inset:3.25rem] [--inset-end:1rem]'"
        role="radiogroup"
        aria-label="Where to look"
      >
        <li>
          <button type="button" role="radio" :aria-checked="mode === 'nearby'" :class="row" @click="select('nearby')">
            <Locate class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
            <span class="flex-1 text-base font-medium">Near me</span>
            <Check v-if="mode === 'nearby'" class="text-primary size-5" stroke-width="2.5" aria-hidden="true" />
          </button>
          <div v-if="mode === 'nearby'" :class="['space-y-3 pt-1 pb-4', inset]">
            <template v-if="coords">
              <NearbyRadiusMap :lat="coords.lat" :lng="coords.lng" :radius-km="radius" />
              <label class="block space-y-1">
                <span class="text-muted-foreground text-sm font-medium">Within {{ radius }} km</span>
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
              <Button variant="tonal" block @click="requestPosition">
                <Locate /> {{ locationError ? 'Try again' : 'Use my location' }}
              </Button>
            </template>
          </div>
        </li>
        <li v-for="qc in quickCountries" :key="qc.value">
          <button
            type="button"
            role="radio"
            :aria-checked="mode === 'region' && country === qc.value"
            :class="row"
            @click="pickCountry(qc.value)"
          >
            <span class="w-5 text-center text-xl leading-none" aria-hidden="true">{{ countryFlag(qc.value) ?? '🌐' }}</span>
            <span class="flex-1 text-base font-medium">{{ countryName(qc.value) }}</span>
            <Check v-if="mode === 'region' && country === qc.value" class="text-primary size-5" stroke-width="2.5" aria-hidden="true" />
          </button>
          <div
            v-if="mode === 'region' && country === qc.value && (regionChoices.length > 1 || regions.length || locality)"
            :class="['pt-1 pb-4', inset]"
          >
            <button
              type="button"
              class="field press flex h-12 w-full items-center gap-2 rounded-xl pr-2 pl-3 text-left"
              :aria-label="`Which ${regionsWord(country)}: ${narrowLabel}`"
              aria-haspopup="dialog"
              :aria-expanded="regionMenu.open"
              data-menu-anchor
              @click="openRegionMenu"
            >
              <span class="min-w-0 flex-1 truncate text-base">{{ narrowLabel }}</span>
              <span data-grow-from class="flex rounded-full">
                <ChevronsUpDown class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
              </span>
            </button>
            <Dialog
              :open="regionMenu.open"
              :morph="regionMenu"
              variant="dropdown"
              :aria-label="`Which ${regionsWord(country)}`"
              @close="regionMenu.hide()"
            >
              <ul role="group" :aria-label="`Which ${regionsWord(country)}`">
                <!-- All of them, set apart from the ones to tick, as other menus split their groups. -->
                <li class="mb-1.5 border-b pb-1.5">
                  <button
                    type="button"
                    role="checkbox"
                    :aria-checked="!regions.length && !locality"
                    class="press-row focus-inset flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-base font-medium"
                    @click="pickAllRegions"
                  >
                    <span class="min-w-0 flex-1">{{ allRegions }}</span>
                    <Check v-if="!regions.length && !locality" class="text-primary size-5 shrink-0" stroke-width="2.5" aria-hidden="true" />
                  </button>
                </li>
                <li v-for="r in regionChoices" :key="r">
                  <button
                    type="button"
                    role="checkbox"
                    :aria-checked="regions.includes(r)"
                    class="press-row focus-inset flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-base font-medium"
                    @click="toggleRegion(r)"
                  >
                    <span class="min-w-0 flex-1">{{ nameOf(r) }}</span>
                    <Check v-if="regions.includes(r)" class="text-primary size-5 shrink-0" stroke-width="2.5" aria-hidden="true" />
                  </button>
                </li>
              </ul>
            </Dialog>
          </div>
        </li>
        <li>
          <button type="button" role="radio" :aria-checked="mode === 'worldwide'" :class="row" @click="select('worldwide')">
            <Globe class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
            <span class="flex-1 text-base font-medium">Everywhere</span>
            <Check v-if="mode === 'worldwide'" class="text-primary size-5" stroke-width="2.5" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <Button variant="primary" :size="wide ? 'md' : 'lg'" block @click="sheet.hide()">Done</Button>
    </div>
  </Dialog>
</template>
