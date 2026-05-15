<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import AccountAvatarButton from '@/components/AccountAvatarButton.vue'
import { useAnyPillOpen } from '@/composables/useExpandedPill'
import CompetitionRow from '@/components/CompetitionRow.vue'
import CompetitionsCalendar from '@/components/CompetitionsCalendar.vue'
import CompetitionsMap from '@/views/competitions/CompetitionsMap.vue'
import DatePill, { type DateFilter } from '@/components/DatePill.vue'
import HeroCompCard from '@/components/HeroCompCard.vue'
import LocationPill from '@/components/LocationPill.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import Skeleton from '@/components/Skeleton.vue'
import ViewModePill, { type ViewMode } from '@/components/ViewModePill.vue'
import { useLocationFilter } from '@/composables/useLocationFilter'
import { daysFromToday, isBeforeToday, isSameDay, parseDate } from '@/lib/format'
import { useFavoritesStore } from '@/stores/favorites'

const view = useLocalStorage<ViewMode>('competitions:view', 'list')
const filter = useLocalStorage<DateFilter>('competitions:filter', 'current')

const anyPillOpen = useAnyPillOpen()

// Only "Archived" and "All" need archived data; "Current" doesn't look further
// back than a week, so the un-archived feed is enough.
const includeArchived = computed(
  () => filter.value === 'archived' || filter.value === 'all',
)

// "Current" window: past week through next month.
const CURRENT_PAST_DAYS = -7
const CURRENT_FUTURE_DAYS = 30

const { competitions, loading } = useCompetitions(includeArchived)

const { filterFor: locationFilterFor } = useLocationFilter()

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
      <div
        data-pill-overlay-host
        class="pointer-events-auto relative mx-auto flex h-12 max-w-3xl items-center gap-2"
      >
        <div
          class="floating-nav flex items-center gap-1 rounded-full p-1"
        >
          <ViewModePill v-model="view" />
          <LocationPill v-if="view !== 'map'" :competitions="competitions" />
          <DatePill v-if="view !== 'calendar'" v-model="filter" />
        </div>
        <div
          :class="[
            'ml-auto transition-opacity',
            anyPillOpen ? 'pointer-events-none opacity-0' : '',
          ]"
        >
          <AccountAvatarButton />
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
      <CompetitionsMap v-if="view === 'map'" />
      <CompetitionsCalendar
        v-else-if="view === 'calendar'"
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
          <div v-else-if="filter === 'archived'">No archived competitions on record.</div>
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
