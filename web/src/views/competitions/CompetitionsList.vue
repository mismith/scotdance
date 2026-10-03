<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { CalendarClock, CalendarDays, CloudOff, List, Map as MapIcon, SquarePlus, Trophy } from '@lucide/vue'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import AppBar from '@/components/nav/AppBar.vue'
import Button from '@/components/ui/Button.vue'
import Segmented from '@/components/ui/Segmented.vue'
import CompetitionDateRow from '@/components/CompetitionDateRow.vue'
import CompetitionsCalendar from '@/components/CompetitionsCalendar.vue'
import EmptyState from '@/components/EmptyState.vue'
import LocationFilter from '@/components/LocationFilter.vue'
import Skeleton from '@/components/Skeleton.vue'
import MenuPill from '@/components/MenuPill.vue'
import { swapInPlace } from '@/lib/navMotion'
import { useScrolledPast } from '@/composables/useScrolledPast'
import { useLocationFilter } from '@/composables/useLocationFilter'
import { useFollowedCompetitions } from '@/composables/useFollowedCompetitions'
import { useCompetitionSpans } from '@/composables/useCompetitionSpans'
import { parseDate } from '@/lib/format'
import { lateSkeleton, settle, settleDelay } from '@/lib/settle'
import { useFavoritesStore } from '@/stores/favorites'

// The map (MapLibre, ~1 MB) loads only when someone opens it.
const CompetitionsMap = defineAsyncComponent(() => import('@/views/competitions/CompetitionsMap.vue'))

// How (list, calendar or map) beside the title, then where (a region,
// nearby, or everywhere) and when (Upcoming or Past results). The calendar is
// itself a view of when, so it drops Upcoming/Past; the map is a view of
// where, so it drops the location (it shows everywhere, framed on the last
// one picked).
type ViewMode = 'list' | 'calendar' | 'map'
const VIEWS = [
  { value: 'list', label: 'List', icon: List },
  { value: 'calendar', label: 'Calendar', icon: CalendarDays },
  { value: 'map', label: 'Map', icon: MapIcon },
] as const
type Range = 'upcoming' | 'past'
const RANGES = [
  { value: 'upcoming', label: 'Upcoming', hint: 'Soonest first', icon: CalendarClock },
  { value: 'past', label: 'Past results', hint: 'Most recent first', icon: Trophy },
] as const
const view = useLocalStorage<ViewMode>('competitions:view', 'list')
// Switching views moves the content toward the chosen one, under a still header.
const setView = (v: ViewMode) => swapInPlace(VIEWS.map((o) => o.value), view.value, v, () => (view.value = v))
const range = useLocalStorage<Range>('competitions:range', 'upcoming')

const titleEl = ref<HTMLElement | null>(null)
const scrolledPast = useScrolledPast(titleEl)

const includeArchived = computed(() => range.value === 'past' || view.value === 'calendar')
const { competitions, loading, error, reload } = useCompetitions(includeArchived)
const { filterFor, setWorldwide, mode: locationMode } = useLocationFilter()
const favorites = useFavoritesStore()
const { byCompetition } = useFollowedCompetitions()

// URL ↔ view sync (so a shared link keeps map/calendar).
const route = useRoute()
const router = useRouter()
onMounted(() => {
  const v = route.query.view
  if (v === 'calendar' || v === 'map' || v === 'list') view.value = v
})
watch(view, (v) => router.replace({ query: { ...route.query, view: v === 'list' ? undefined : v } }))

const location = computed(() => filterFor(competitions.value))
const located = computed<CompetitionListItem[]>(() =>
  location.value.isActive ? competitions.value.filter(location.value.predicate) : competitions.value,
)

// A date that can't be read (e.g. "2026-02-30") counts as none: "Date to be announced".
const dateOf = (c: { date?: number | string }) => {
  const d = c.date ? parseDate(c.date) : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}
const ms = (c: { date?: number | string }) => dateOf(c)?.getTime() ?? 0

// A multi-day competition stays under Upcoming (as Today) through its last
// schedule day.
const { span } = useCompetitionSpans(competitions)
// Dateless ones count as upcoming.
const isUpcoming = (c: CompetitionListItem) => (span(c)?.last ?? 0) >= 0
const isOn = (c: CompetitionListItem) => {
  const days = span(c)
  return !!days && days.first <= 0 && days.last >= 0
}
const dayNote = (c: CompetitionListItem) => {
  const s = span(c)
  return s && isOn(c) && s.last > s.first ? `Day ${1 - s.first} of ${s.last - s.first + 1}` : null
}

const byRange = (list: CompetitionListItem[]) =>
  list.filter((c) => isUpcoming(c) === (range.value === 'upcoming')).sort((a, b) => (range.value === 'upcoming' ? ms(a) - ms(b) : ms(b) - ms(a)))
const inRange = computed(() => byRange(located.value))
// The map shows them everywhere (where you look on it is the "where"),
// framed on the location picked for the list.
const inRangeEverywhere = computed(() => byRange(competitions.value))

interface Section {
  key: string
  label: string
  items: CompetitionListItem[]
}
const sections = computed<Section[]>(() => {
  const out = new Map<string, Section>()
  for (const c of inRange.value) {
    const d = dateOf(c)
    const today = isOn(c)
    const key = today ? 'today' : d ? `${d.getFullYear()}-${d.getMonth()}` : 'tba'
    const label = today
      ? 'Today'
      : d
        ? d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        : 'Date to be announced'
    const s = out.get(key) ?? { key, label, items: [] }
    s.items.push(c)
    out.set(key, s)
  }
  return [...out.values()]
})
</script>

<template>
  <div
    :class="['flex flex-1 flex-col', view === 'map' ? 'h-dvh overflow-hidden' : 'pb-[calc(var(--chrome-bottom)+1.5rem)]']"
  >
    <AppBar title="Competitions" :show-title="scrolledPast" :back="false" />

    <main
      :class="[
        'mx-auto w-full max-w-3xl space-y-3 px-4 pt-[calc(var(--chrome-top)+0.25rem)]',
        view === 'map' && 'relative flex-1',
      ]"
    >
      <!-- The same header in every view, in the same place. Over the map it's
           on the page's colour, fading into the map as the top bar does. -->
      <div data-page-head class="relative z-10 space-y-3">
        <div
          v-if="view === 'map'"
          class="from-background pointer-events-none absolute -inset-x-[100vw] -top-[calc(var(--chrome-top)+0.5rem)] -bottom-10 -z-10 bg-linear-to-b from-[calc(100%-2rem)] to-transparent"
          aria-hidden="true"
        />
        <header ref="titleEl" class="flex items-center gap-3">
          <h1 class="text-display min-w-0 flex-1">Competitions</h1>
          <Segmented :model-value="view" :options="VIEWS" label="Show competitions as" compact class="shrink-0" @update:model-value="setView" />
        </header>
        <div class="flex flex-wrap items-center gap-2">
          <LocationFilter v-if="view !== 'map'" :competitions="competitions" />
          <MenuPill v-if="view !== 'calendar'" v-model="range" :options="RANGES" label="Which competitions" />
        </div>
      </div>

      <CompetitionsMap
        v-if="view === 'map'"
        :competitions="inRangeEverywhere"
        :focus="inRange"
        :fit-key="`${locationMode}:${location.isActive}:${range}`"
        class="fixed top-(--chrome-top) right-0 bottom-0 left-(--sidebar)"
      />

      <CompetitionsCalendar
        v-else-if="view === 'calendar'"
        :competitions="located"
        :loading="loading"
        class="pt-2"
      />

      <template v-else>
        <div v-if="loading && !competitions.length" :class="['surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]', lateSkeleton]" aria-busy="true">
          <span class="sr-only">Loading competitions…</span>
          <div v-for="i in 5" :key="i" class="flex min-h-16 items-center gap-3 py-2.5 pr-3 pl-4">
            <Skeleton class="h-14 w-11 shrink-0 rounded-xl!" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-4 w-3/4" />
              <Skeleton class="h-3.5 w-1/3" />
            </div>
          </div>
        </div>
        <EmptyState
          v-else-if="error && !competitions.length"
          :icon="CloudOff"
          title="Competitions didn’t load"
          description="Check your connection, then try again."
        >
          <Button variant="primary" size="lg" @click="reload()">Try again</Button>
        </EmptyState>
        <EmptyState
          v-else-if="!inRange.length"
          :icon="CalendarDays"
          :title="range === 'upcoming' ? 'No upcoming competitions here' : 'No past competitions here'"
          :description="
            location.isActive
              ? 'Nothing matches where you’re looking. Try everywhere, or switch between Upcoming and Past results.'
              : range === 'upcoming'
                ? 'New competitions appear here as organisers add them.'
                : 'Nothing on record yet.'
          "
        >
          <Button v-if="location.isActive && locationMode !== 'worldwide'" variant="primary" size="lg" @click="setWorldwide()">
            Show everywhere
          </Button>
        </EmptyState>

        <section v-for="(s, i) in sections" :key="s.key" :class="settle" :style="settleDelay(i)">
          <h2
            :class="[
              'text-heading bg-background sticky top-(--chrome-top) z-10 flex items-center gap-1.5 py-2',
              s.key === 'today' && 'text-live',
            ]"
          >
            <span v-if="s.key === 'today'" class="bg-live size-2 rounded-full" aria-hidden="true" />
            {{ s.label }}
          </h2>
          <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
            <CompetitionDateRow
              v-for="c in s.items"
              :key="c.id"
              :competition="c"
              :to="{ name: 'competition.info', params: { competitionId: c.id } }"
              :dancers="byCompetition[c.id] ?? []"
              :followed="favorites.isFavorite('competitions', c.id)"
              :today="s.key === 'today'"
              :note="dayNote(c)"
            />
          </ul>
        </section>
      </template>

      <!-- For organisers, at the end of the list. -->
      <section v-if="view !== 'map'" class="surface mt-6 flex items-center gap-3 rounded-2xl p-4">
        <SquarePlus class="text-primary size-6 shrink-0" stroke-width="1.75" aria-hidden="true" />
        <p class="text-callout min-w-0 flex-1">
          <span class="font-semibold">Running a competition?</span> Add it to ScotDance.app. It’s free, and saves hours of
          work and paper.
        </p>
        <Button variant="tonal" :to="{ name: 'competitions.submit' }">Submit</Button>
      </section>
    </main>
  </div>
</template>
