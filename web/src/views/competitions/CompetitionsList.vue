<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { CalendarDays, CloudOff, SquarePlus } from '@lucide/vue'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import AppBar from '@/components/nav/AppBar.vue'
import CompetitionDateRow from '@/components/CompetitionDateRow.vue'
import CompetitionsCalendar from '@/components/CompetitionsCalendar.vue'
import EmptyState from '@/components/EmptyState.vue'
import LocationFilter from '@/components/LocationFilter.vue'
import Skeleton from '@/components/Skeleton.vue'
import ViewModeButton, { type ViewMode } from '@/components/ViewModeButton.vue'
import { useScrolledPast } from '@/composables/useScrolledPast'
import { useLocationFilter } from '@/composables/useLocationFilter'
import { useFollowedCompetitions } from '@/composables/useFollowedCompetitions'
import { useCompetitionSpans } from '@/composables/useCompetitionSpans'
import { parseDate } from '@/lib/format'
import { useFavoritesStore } from '@/stores/favorites'

// The map (MapLibre, ~1 MB) loads only when someone opens it.
const CompetitionsMap = defineAsyncComponent(() => import('@/views/competitions/CompetitionsMap.vue'))

// Two plain choices, in words: Upcoming or Past results. Where (a region,
// nearby, or everywhere) and how (list, calendar, map) are labelled buttons.
type Range = 'upcoming' | 'past'
const view = useLocalStorage<ViewMode>('competitions:view', 'list')
const range = useLocalStorage<Range>('competitions:range', 'upcoming')

const titleEl = ref<HTMLElement | null>(null)
const scrolledPast = useScrolledPast(titleEl)

// The calendar has no Upcoming/Past choice and can go back any number of
// months, so it always has every competition.
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

const inRange = computed(() => {
  const list = located.value.filter((c) => isUpcoming(c) === (range.value === 'upcoming'))
  return list.sort((a, b) => (range.value === 'upcoming' ? ms(a) - ms(b) : ms(b) - ms(a)))
})

interface Section {
  key: string
  label: string
  items: CompetitionListItem[]
}
const sections = computed<Section[]>(() => {
  const out = new Map<string, Section>()
  for (const c of inRange.value) {
    const d = dateOf(c)
    const days = span(c)
    const today = !!days && days.first <= 0 && days.last >= 0
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

const mapCompetitions = computed(() =>
  competitions.value.filter((c) => isUpcoming(c) === (range.value === 'upcoming')),
)
</script>

<template>
  <div
    :class="['flex flex-1 flex-col', view === 'map' ? 'h-dvh' : 'pb-[calc(var(--chrome-bottom)+1.5rem)]']"
  >
    <AppBar title="Competitions" :show-title="scrolledPast || view === 'map'" :back="false" />

    <main
      :class="[
        'mx-auto w-full max-w-3xl space-y-3 px-4 pt-[calc(var(--chrome-top)+0.25rem)]',
        view === 'map' && 'relative flex flex-1 flex-col',
      ]"
    >
      <header v-if="view !== 'map'" ref="titleEl">
        <h1 class="text-display">Competitions</h1>
      </header>
      <h1 v-else class="sr-only">Competitions</h1>

      <div
        v-if="view !== 'calendar'"
        class="bg-muted grid grid-cols-2 rounded-xl border p-1"
        role="group"
        aria-label="Which competitions"
      >
        <button
          v-for="r in (['upcoming', 'past'] as const)"
          :key="r"
          type="button"
          :aria-pressed="range === r"
          :class="[
            'h-10 rounded-lg text-[0.9375rem] font-bold transition-colors',
            range === r ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
          ]"
          @click="range = r"
        >
          {{ r === 'upcoming' ? 'Upcoming' : 'Past results' }}
        </button>
      </div>

      <div class="flex flex-wrap gap-2">
        <LocationFilter v-if="view !== 'map'" :competitions="competitions" />
        <ViewModeButton v-model="view" />
      </div>

      <CompetitionsMap v-if="view === 'map'" :competitions="mapCompetitions" class="-mx-4 flex-1" />

      <CompetitionsCalendar
        v-else-if="view === 'calendar'"
        :competitions="located"
        :loading="loading"
      />

      <template v-else>
        <div v-if="loading && !competitions.length" class="space-y-2" aria-busy="true">
          <Skeleton v-for="i in 5" :key="i" class="h-16 w-full rounded-xl!" />
        </div>
        <div v-else-if="error && !competitions.length" class="space-y-3">
          <EmptyState :icon="CloudOff" title="Competitions didn’t load" description="Check your connection, then try again." />
          <button
            type="button"
            class="bg-primary-fill text-primary-foreground mx-auto flex h-12 items-center rounded-xl px-6 text-base font-bold"
            @click="reload()"
          >
            Try again
          </button>
        </div>
        <div v-else-if="!inRange.length" class="space-y-3">
          <EmptyState
            :icon="CalendarDays"
            :title="range === 'upcoming' ? 'No upcoming competitions here' : 'No past competitions here'"
            :description="
              location.isActive
                ? 'Nothing matches where you’re looking. Try everywhere, or switch between Upcoming and Past results.'
                : range === 'upcoming'
                  ? 'New competitions appear here as organisers add them.'
                  : 'Nothing on record yet.'
            "
          />
          <button
            v-if="location.isActive && locationMode !== 'worldwide'"
            type="button"
            class="bg-primary-fill text-primary-foreground mx-auto flex h-12 items-center rounded-xl px-6 text-base font-bold"
            @click="setWorldwide()"
          >
            Show everywhere
          </button>
        </div>

        <section v-for="s in sections" :key="s.key">
          <h2
            :class="[
              'bg-background sticky top-(--chrome-top) z-10 py-2 text-[1.0625rem] font-extrabold',
              s.key === 'today' && 'text-live',
            ]"
          >
            {{ s.label }}
          </h2>
          <ul class="divide-y overflow-hidden rounded-2xl border shadow-sm">
            <CompetitionDateRow
              v-for="c in s.items"
              :key="c.id"
              :competition="c"
              :to="{ name: 'competition.info', params: { competitionId: c.id } }"
              :dancers="byCompetition[c.id] ?? []"
              :followed="favorites.isFavorite('competitions', c.id)"
              :today="s.key === 'today'"
            />
          </ul>
        </section>
      </template>

      <!-- For organisers, at the end of the list. -->
      <section v-if="view !== 'map'" class="bg-card mt-6 flex items-center gap-3 rounded-2xl border p-4 shadow-sm">
        <span class="bg-blue-paper text-primary flex size-11 shrink-0 items-center justify-center rounded-full">
          <SquarePlus class="size-5" />
        </span>
        <p class="min-w-0 flex-1 text-[0.9375rem] leading-snug">
          <b>Running a competition?</b> Add it to ScotDance. It’s free, and saves hours of work and paper.
        </p>
        <RouterLink
          :to="{ name: 'competitions.submit' }"
          class="bg-primary-fill text-primary-foreground flex h-11 shrink-0 items-center rounded-full px-4 text-[0.9375rem] font-bold"
        >
          Submit
        </RouterLink>
      </section>
    </main>
  </div>
</template>
