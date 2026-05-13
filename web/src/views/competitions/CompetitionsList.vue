<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onClickOutside, useLocalStorage } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { SlidersVertical } from '@lucide/vue'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import CompetitionRow from '@/components/CompetitionRow.vue'
import CompetitionsCalendar from '@/components/CompetitionsCalendar.vue'
import CompetitionsMap from '@/views/competitions/CompetitionsMap.vue'
import HeroCompCard from '@/components/HeroCompCard.vue'
import LocationFilterFields from '@/components/LocationFilterFields.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import Skeleton from '@/components/Skeleton.vue'
import ViewModeTabs, { type ViewMode } from '@/components/ViewModeTabs.vue'
import { useLocationFilter } from '@/composables/useLocationFilter'
import { isBeforeToday, isSameDay, parseDate } from '@/lib/format'
import { useFavoritesStore } from '@/stores/favorites'

type Filter = 'upcoming' | 'past' | 'all'

const view = useLocalStorage<ViewMode>('competitions:view', 'list')
const filter = useLocalStorage<Filter>('competitions:filter', 'upcoming')

const filterOptions: Array<{ id: Filter; label: string }> = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'all', label: 'All' },
]

const filtersMenuRef = ref<HTMLElement | null>(null)
const filtersOpen = ref(false)
onClickOutside(filtersMenuRef, () => (filtersOpen.value = false))

// "Upcoming" doesn't need archived data; "Past" / "All" do. Tying these together
// avoids a separate toggle — "All" already means everything.
const includeArchived = computed(() => filter.value !== 'upcoming')

const { competitions, loading } = useCompetitions(includeArchived)

const {
  filterFor: locationFilterFor,
  country: locCountry,
  region: locRegion,
  locality: locLocality,
  near: locNear,
} = useLocationFilter()

// Effective filter (no-ops if values don't match any loaded comp). Drives
// both the predicate and the "is this filter actually doing anything" UI.
const effectiveLocationFilter = computed(() => locationFilterFor(competitions.value))

const showLocationSection = computed(() => view.value !== 'map')
const showDateSection = computed(() => view.value !== 'calendar')
const dateFilterActive = computed(() => filter.value !== 'upcoming')
const activeFilterCount = computed(
  () =>
    (showLocationSection.value && effectiveLocationFilter.value.isActive ? 1 : 0) +
    (showDateSection.value && dateFilterActive.value ? 1 : 0),
)

// URL <-> state sync (Decision 6). One-way on mount (URL hydrates state if
// params present), then refs ↔ URL with a flag to prevent the obvious loop.
const route = useRoute()
const router = useRouter()
let syncing = false

function readFromQuery(): void {
  syncing = true
  const q = route.query
  if (q.view === 'calendar' || q.view === 'map' || q.view === 'list') {
    view.value = q.view
  }
  if (typeof q.country === 'string') locCountry.value = q.country
  else if (q.country === undefined && route.path === '/competitions') {
    // explicit URL has no country → respect localStorage default
  }
  if (typeof q.region === 'string') locRegion.value = q.region
  if (typeof q.locality === 'string') locLocality.value = q.locality
  // Never auto-enable Near me from the URL: iOS standalone PWAs silently
  // block any geolocation request that isn't tied to a fresh user gesture,
  // so resuming on mount would leave the toggle stuck on with no coords.
  // The watch below will strip `near=1` from the URL on the next tick.
  if (q.near !== undefined && locNear.value) {
    locNear.value = false
  }
  syncing = false
}

onMounted(readFromQuery)

watch(
  [view, locCountry, locRegion, locLocality, locNear],
  () => {
    if (syncing) return
    router.replace({
      query: {
        ...route.query,
        view: view.value === 'list' ? undefined : view.value,
        country: locCountry.value || undefined,
        region: locRegion.value || undefined,
        locality: locLocality.value || undefined,
        near: locNear.value ? '1' : undefined,
      },
    })
  },
)

watch(
  () => route.query,
  () => {
    if (syncing) return
    readFromQuery()
  },
)

const locationFiltered = computed<CompetitionListItem[]>(() => {
  const ef = effectiveLocationFilter.value
  return ef.isActive ? competitions.value.filter(ef.predicate) : competitions.value
})

function dateMs(c: { date?: number | string }) {
  return c.date ? parseDate(c.date).getTime() : 0
}

const featuredComp = computed<CompetitionListItem | null>(() => {
  const list = locationFiltered.value
  if (!list.length) return null
  const live = list.find((c) => c.date && isSameDay(c.date))
  if (live) return live
  const upcoming = list
    .filter((c) => c.date && !isBeforeToday(c.date))
    .sort((a, b) => dateMs(a) - dateMs(b))
  return upcoming[0] ?? null
})

const filteredCompetitions = computed<CompetitionListItem[]>(() => {
  const list = locationFiltered.value.slice()
  if (filter.value === 'upcoming') {
    return list
      .filter((c) => c.date && !isBeforeToday(c.date))
      .sort((a, b) => dateMs(a) - dateMs(b))
  }
  if (filter.value === 'past') {
    return list
      .filter((c) => c.date && isBeforeToday(c.date) && !isSameDay(c.date))
      .sort((a, b) => dateMs(b) - dateMs(a))
  }
  return list.sort((a, b) => dateMs(a) - dateMs(b))
})

const featuredId = computed(() => featuredComp.value?.id ?? null)
const visibleCompetitions = computed(() =>
  filter.value === 'upcoming'
    ? filteredCompetitions.value.filter((c) => c.id !== featuredId.value)
    : filteredCompetitions.value,
)

const favorites = useFavoritesStore()

interface MonthGroup {
  key: string
  label: string
  members: CompetitionListItem[]
  favCount: number
}

const monthGroups = computed<MonthGroup[]>(() => {
  const groups = new Map<string, MonthGroup>()
  for (const c of visibleCompetitions.value) {
    const d = c.date ? parseDate(c.date) : null
    const key = d
      ? `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
      : 'undated'
    const label = d
      ? `${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`
      : 'Undated'
    let g = groups.get(key)
    if (!g) {
      g = { key, label, members: [], favCount: 0 }
      groups.set(key, g)
    }
    g.members.push(c)
    if (favorites.isFavoriteCompetition(c.id)) g.favCount++
  }
  return [...groups.values()]
})
</script>

<template>
  <div
    :class="[
      'flex flex-1 flex-col',
      view === 'map' ? 'h-dvh' : 'pb-(--chrome-bottom)',
    ]"
  >
    <main
      :class="[
        'w-full flex-1',
        view === 'map'
          ? 'flex flex-col'
          : 'mx-auto max-w-3xl space-y-5 p-4',
      ]"
    >
      <div
        :class="[
          'flex flex-wrap items-center gap-2',
          view === 'map' ? 'mx-auto w-full max-w-3xl p-4' : '',
        ]"
      >
        <ViewModeTabs v-model="view" />
        <div ref="filtersMenuRef" class="relative ml-auto">
          <div class="bg-chip inline-flex rounded-lg p-1">
            <button
              type="button"
              :class="[
                'inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors',
                activeFilterCount
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              ]"
              @click="filtersOpen = !filtersOpen"
            >
              <SlidersVertical class="size-3.5" />
              <span class="max-md:sr-only">Filters</span>
              <span
                v-if="activeFilterCount"
                class="bg-primary text-primary-foreground inline-flex size-4 items-center justify-center rounded-full text-[10px] font-bold"
              >
                {{ activeFilterCount }}
              </span>
            </button>
          </div>

          <div
            v-if="filtersOpen"
            class="bg-card absolute top-full right-0 z-30 mt-1 w-72 space-y-4 overflow-hidden rounded-xl border p-3 shadow-md"
          >
            <div v-if="showDateSection" class="space-y-1.5">
              <div class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Show
              </div>
              <div class="bg-chip flex gap-1 rounded-lg p-1">
                <button
                  v-for="opt in filterOptions"
                  :key="opt.id"
                  type="button"
                  :class="[
                    'flex flex-1 items-center justify-center rounded-md px-2 py-1.5 text-sm font-medium',
                    filter === opt.id
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  ]"
                  @click="filter = opt.id"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <div v-if="showLocationSection" class="space-y-1.5">
              <div class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Location
              </div>
              <LocationFilterFields :competitions="competitions" />
            </div>
          </div>
        </div>
      </div>

      <CompetitionsMap v-if="view === 'map'" />
      <CompetitionsCalendar
        v-else-if="view === 'calendar'"
        :competitions="locationFiltered"
        :loading="loading"
      />

      <template v-else>
        <HeroCompCard
          v-if="featuredComp && filter === 'upcoming'"
          :competition="featuredComp"
        />

        <div
          v-if="loading && !competitions.length"
          class="space-y-3"
          aria-busy="true"
          aria-live="polite"
        >
          <span class="sr-only">Loading competitions…</span>
          <div v-for="i in 5" :key="i" class="flex items-start gap-3 py-3">
            <Skeleton class="size-12 shrink-0 rounded-xl!" />
            <div class="flex-1 space-y-2 pt-1">
              <Skeleton class="h-5 w-3/4" />
              <Skeleton class="h-4 w-1/2" />
            </div>
          </div>
        </div>
        <div
          v-else-if="!competitions.length"
          class="text-muted-foreground text-lg italic"
        >
          No competitions found.
        </div>
        <div
          v-else-if="!visibleCompetitions.length"
          class="text-muted-foreground space-y-2 text-lg italic"
        >
          <div v-if="effectiveLocationFilter.isActive">No competitions match this location.</div>
          <div v-else-if="filter === 'upcoming'">No upcoming competitions.</div>
          <div v-else-if="filter === 'past'">No past competitions on record.</div>
          <div v-else>No competitions match.</div>
        </div>

        <template v-else>
          <section v-for="group in monthGroups" :key="group.key" class="space-y-2">
            <SectionHeader
              :label="group.label"
              :count="group.members.length"
              :favs="group.favCount"
            />
            <ul>
              <CompetitionRow
                v-for="competition in group.members"
                :key="competition.id"
                :competition="competition"
                :to="{
                  name: 'competition.info',
                  params: { competitionId: competition.id },
                }"
              />
            </ul>
          </section>
        </template>

      </template>
    </main>
  </div>
</template>
