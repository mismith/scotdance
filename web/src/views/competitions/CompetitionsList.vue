<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { CalendarDays } from '@lucide/vue'
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
import { daysFromToday, parseDate } from '@/lib/format'
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

const includeArchived = computed(() => range.value === 'past')
const { competitions, loading } = useCompetitions(includeArchived)
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

const ms = (c: { date?: number | string }) => (c.date ? parseDate(c.date).getTime() : 0)

const inRange = computed(() => {
  const list = located.value.filter((c) => {
    const d = daysFromToday(c.date)
    if (d == null) return range.value === 'upcoming'
    return range.value === 'upcoming' ? d >= 0 : d < 0
  })
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
    const d = c.date ? parseDate(c.date) : null
    const today = daysFromToday(c.date) === 0
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
  competitions.value.filter((c) => {
    const d = daysFromToday(c.date)
    return range.value === 'upcoming' ? d == null || d >= 0 : d != null && d < 0
  }),
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

      <div class="flex gap-2">
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
            class="bg-primary text-primary-foreground mx-auto flex h-12 items-center rounded-xl px-6 text-base font-bold"
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
            />
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>
