<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import AccountAvatarButton from '@/components/AccountAvatarButton.vue'
import CompetitionRow from '@/components/CompetitionRow.vue'
import CompetitionsCalendar from '@/components/CompetitionsCalendar.vue'
import CompetitionsMap from '@/views/competitions/CompetitionsMap.vue'
import DatePill, { type DateFilter } from '@/components/DatePill.vue'
import HeroCompCard from '@/components/HeroCompCard.vue'
import LocationPill from '@/components/LocationPill.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import Skeleton from '@/components/Skeleton.vue'
import TopBackButton from '@/components/nav/TopBackButton.vue'
import ViewModePill, { type ViewMode } from '@/components/ViewModePill.vue'
import { providePillRow } from '@/composables/usePillRow'
import { useScrolledPast } from '@/composables/useScrolledPast'
import { useLocationFilter } from '@/composables/useLocationFilter'
import { daysFromToday, isBeforeToday, isSameDay, parseDate } from '@/lib/format'
import { useFavoritesStore } from '@/stores/favorites'

const view = useLocalStorage<ViewMode>('competitions:view', 'list')
const filter = useLocalStorage<DateFilter>('competitions:filter', 'current')

// In-flow title acts as the anchor for the small-title pill reveal: once the
// large title scrolls under the fixed nav, the pill fades in.
const titleAnchor = ref<HTMLElement | null>(null)
const scrolledPastTitle = useScrolledPast(titleAnchor)
// Map mode has nothing scrolling, so the in-flow title isn't rendered — force
// the pill on so users still see the page label.
const showTitlePill = computed(() => view.value === 'map' || scrolledPastTitle.value)

// ExpandingPill popovers anchor to whichever pill-row container is currently
// mounted (in-flow header for list/calendar, floating overlay for map).
const pillRowEl = ref<HTMLElement | null>(null)
providePillRow(pillRowEl)
function setPillRow(el: unknown) {
  pillRowEl.value = (el as HTMLElement | null) ?? null
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Only "Archived" and "All" need archived data; "Current" doesn't look further
// back than a week, so the un-archived feed is enough.
const includeArchived = computed(
  () => filter.value === 'archived' || filter.value === 'all',
)

// "Current" window: past week through next month.
const CURRENT_PAST_DAYS = -7
const CURRENT_FUTURE_DAYS = 30

const { competitions, loading } = useCompetitions(includeArchived)

const {
  filterFor: locationFilterFor,
  mode: locationMode,
  country: locationCountry,
  region: locationRegion,
  locality: locationLocality,
} = useLocationFilter()

const viewLabel = computed(() =>
  view.value === 'map' ? 'Map' : view.value === 'calendar' ? 'Calendar' : 'List',
)
const dateLabel = computed(() =>
  filter.value === 'archived' ? 'Archived' : filter.value === 'all' ? 'All' : 'Current',
)
const locationLabel = computed(() => {
  if (locationMode.value === 'nearby') return 'Nearby'
  if (locationMode.value === 'worldwide') return 'Worldwide'
  return (
    locationLocality.value || locationRegion.value || locationCountry.value || 'Region'
  )
})
const pillSubtitle = computed(() =>
  [
    viewLabel.value,
    view.value !== 'map' ? locationLabel.value : null,
    view.value !== 'calendar' ? dateLabel.value : null,
  ]
    .filter(Boolean)
    .join(' • '),
)

// Effective filter (no-ops if values don't match any loaded comp). Drives
// both the predicate and the "is this filter actually doing anything" UI.
const effectiveLocationFilter = computed(() => locationFilterFor(competitions.value))

// URL <-> view-tab sync only. Location lives in localStorage; URL sync was
// fragile around iOS PWA geolocation gestures.
const route = useRoute()
const router = useRouter()
let syncing = false

function readFromQuery(): void {
  syncing = true
  const q = route.query
  if (q.view === 'calendar' || q.view === 'map' || q.view === 'list') {
    view.value = q.view
  }
  syncing = false
}

onMounted(readFromQuery)

watch(view, () => {
  if (syncing) return
  router.replace({
    query: {
      ...route.query,
      view: view.value === 'list' ? undefined : view.value,
    },
  })
})

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
  if (filter.value === 'current') {
    return list
      .filter((c) => {
        const d = daysFromToday(c.date)
        return d !== null && d >= CURRENT_PAST_DAYS && d <= CURRENT_FUTURE_DAYS
      })
      .sort((a, b) => dateMs(a) - dateMs(b))
  }
  if (filter.value === 'archived') {
    return list
      .filter((c) => {
        const d = daysFromToday(c.date)
        return d !== null && d < CURRENT_PAST_DAYS
      })
      .sort((a, b) => dateMs(b) - dateMs(a))
  }
  return list.sort((a, b) => dateMs(a) - dateMs(b))
})

const showFeatured = computed(() => filter.value === 'current')
const featuredId = computed(() => featuredComp.value?.id ?? null)
const visibleCompetitions = computed(() =>
  showFeatured.value
    ? filteredCompetitions.value.filter((c) => c.id !== featuredId.value)
    : filteredCompetitions.value,
)

// Map view ignores the location filter — the map IS the geographic browser,
// narrowing it by Nearby/Region would collapse the very thing it's for.
const mapCompetitions = computed<CompetitionListItem[]>(() => {
  if (filter.value === 'current') {
    return competitions.value.filter((c) => {
      const d = daysFromToday(c.date)
      return d !== null && d >= CURRENT_PAST_DAYS && d <= CURRENT_FUTURE_DAYS
    })
  }
  if (filter.value === 'archived') {
    return competitions.value.filter((c) => {
      const d = daysFromToday(c.date)
      return d !== null && d < CURRENT_PAST_DAYS
    })
  }
  return competitions.value
})

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
      view === 'map' ? 'h-dvh' : 'pb-[calc(var(--chrome-bottom)+1rem)]',
    ]"
  >
    <nav class="pointer-events-none fixed inset-x-0 top-0 z-30 px-4 pt-(--nav-top)">
      <div class="mx-auto flex h-12 max-w-3xl items-center gap-2">
        <TopBackButton />
        <div class="min-w-0 flex-1">
          <Transition
            enter-active-class="transition ease-rubber-band"
            enter-from-class="-translate-y-full opacity-0"
            leave-active-class="transition ease-out"
            leave-to-class="-translate-y-full opacity-0"
          >
            <button
              v-if="showTitlePill"
              type="button"
              class="floating-nav pointer-events-auto flex h-12 w-full items-center rounded-full px-5 text-left hover:opacity-90"
              @click="scrollToTop"
            >
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate font-serif text-lg leading-none font-medium tracking-tight"
                >
                  Competitions
                </span>
                <span
                  class="mt-1 block truncate font-serif text-xs leading-none opacity-70"
                >
                  {{ pillSubtitle }}
                </span>
              </span>
            </button>
          </Transition>
        </div>
        <AccountAvatarButton />
      </div>
    </nav>

    <!-- Map mode: floating pill overlay (no in-flow chrome — map is full-bleed) -->
    <nav
      v-if="view === 'map'"
      class="pointer-events-none fixed inset-x-0 z-30 px-4"
      :style="{ top: 'calc(var(--nav-top) + 3.5rem)' }"
    >
      <div
        :ref="setPillRow"
        class="mx-auto flex h-12 max-w-3xl items-center justify-center"
      >
        <div class="floating-nav pointer-events-auto flex items-center rounded-3xl p-1">
          <ViewModePill v-model="view" />
          <DatePill v-model="filter" />
        </div>
      </div>
    </nav>

    <main
      :class="[
        'w-full flex-1',
        view === 'map'
          ? 'relative flex flex-col'
          : 'mx-auto max-w-3xl space-y-5 px-4 pt-[calc(var(--chrome-top)+1rem)] pb-4',
      ]"
    >
      <CompetitionsMap v-if="view === 'map'" :competitions="mapCompetitions" />

      <template v-else>
        <header ref="titleAnchor" class="space-y-3">
          <h1 class="text-title">Competitions</h1>
          <div :ref="setPillRow" class="relative flex">
            <div class="floating-nav flex items-center rounded-3xl p-1">
              <ViewModePill v-model="view" />
              <LocationPill :competitions="competitions" />
              <DatePill v-if="view !== 'calendar'" v-model="filter" />
            </div>
          </div>
        </header>

        <CompetitionsCalendar
          v-if="view === 'calendar'"
          :competitions="locationFiltered"
          :loading="loading"
        />

        <template v-else>
          <HeroCompCard v-if="featuredComp && showFeatured" :competition="featuredComp" />

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
            <div v-if="effectiveLocationFilter.isActive">
              No competitions match this location.
            </div>
            <div v-else-if="filter === 'current'">Nothing current — try All.</div>
            <div v-else-if="filter === 'archived'">
              No archived competitions on record.
            </div>
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
      </template>
    </main>
  </div>
</template>
