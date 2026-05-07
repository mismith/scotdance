<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { onClickOutside, useLocalStorage } from '@vueuse/core'
import { Check, ChevronDown, ListFilter, Star } from '@lucide/vue'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import { useFavoritesStore } from '@/stores/favorites'
import AccountMenu from '@/components/AccountMenu.vue'
import CompChip from '@/components/CompChip.vue'
import CompetitionsCalendar from '@/components/CompetitionsCalendar.vue'
import FavoriteCompetitionButton from '@/components/FavoriteCompetitionButton.vue'
import HeroCompCard from '@/components/HeroCompCard.vue'
import ViewModeTabs, { type ViewMode } from '@/components/ViewModeTabs.vue'
import { formatRelative, isPast, isSameDay } from '@/lib/format'

type Filter = 'upcoming' | 'past' | 'all'

const route = useRoute()

const today = computed(() =>
  new Date()
    .toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    .toUpperCase(),
)
const view = computed<ViewMode>(() => {
  const v = String(route.query.view ?? 'list')
  return v === 'map' || v === 'calendar' ? v : 'list'
})

const filter = computed<Filter>(() => {
  const f = String(route.query.f ?? 'upcoming')
  return f === 'past' || f === 'all' ? f : 'upcoming'
})

const filterOptions: Array<{ id: Filter; label: string }> = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'all', label: 'All' },
]

const filterLabel = computed(
  () => filterOptions.find((o) => o.id === filter.value)?.label ?? 'Upcoming',
)

const filterMenuRef = ref<HTMLElement | null>(null)
const filterOpen = ref(false)
onClickOutside(filterMenuRef, () => (filterOpen.value = false))

const includeArchived = useLocalStorage('competitions:includeArchived', false)

const { competitions, loading } = useCompetitions(includeArchived)

const favorites = useFavoritesStore()

const featuredComp = computed<CompetitionListItem | null>(() => {
  const list = competitions.value
  if (!list.length) return null
  const live = list.find((c) => c.date && isSameDay(c.date))
  if (live) return live
  const upcoming = list
    .filter((c) => c.date && !isPast(c.date))
    .sort((a, b) => Number(a.date ?? 0) - Number(b.date ?? 0))
  return upcoming[0] ?? null
})

const filteredCompetitions = computed<CompetitionListItem[]>(() => {
  const list = competitions.value.slice()
  if (filter.value === 'upcoming') {
    return list
      .filter((c) => c.date && !isPast(c.date))
      .sort((a, b) => Number(a.date ?? 0) - Number(b.date ?? 0))
  }
  if (filter.value === 'past') {
    return list
      .filter((c) => c.date && isPast(c.date) && !isSameDay(c.date))
      .sort((a, b) => Number(b.date ?? 0) - Number(a.date ?? 0))
  }
  return list.sort((a, b) => Number(a.date ?? 0) - Number(b.date ?? 0))
})

const featuredId = computed(() => featuredComp.value?.id ?? null)
const visibleCompetitions = computed(() =>
  filter.value === 'upcoming'
    ? filteredCompetitions.value.filter((c) => c.id !== featuredId.value)
    : filteredCompetitions.value,
)
</script>

<template>
  <div class="flex flex-1 flex-col">
    <header
      class="bg-background sticky top-0 z-20 mx-auto flex w-full max-w-3xl items-end justify-between gap-3 p-4 pt-safe pb-3"
    >
      <div class="min-w-0 flex-1">
        <div
          class="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase"
        >
          {{ today }}
        </div>
        <h1
          class="font-serif text-3xl font-medium tracking-tight leading-[1.04]"
        >
          Competitions
        </h1>
      </div>
      <AccountMenu />
    </header>
    <main class="mx-auto w-full max-w-3xl flex-1 space-y-5 p-4 pt-6">
      <div class="flex flex-wrap items-center gap-2">
        <ViewModeTabs :current="view" />
        <div ref="filterMenuRef" class="relative ml-auto">
          <button
            type="button"
            class="bg-chip text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-medium"
            @click="filterOpen = !filterOpen"
          >
            <ListFilter class="size-3.5" />
            {{ filterLabel }}
            <ChevronDown class="size-3 opacity-60" />
          </button>
          <div
            v-if="filterOpen"
            class="bg-card absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-lg border shadow-md"
          >
            <RouterLink
              v-for="opt in filterOptions"
              :key="opt.id"
              :to="{ query: { ...route.query, f: opt.id === 'upcoming' ? undefined : opt.id } }"
              replace
              :class="[
                'hover:bg-accent flex items-center gap-2 px-3 py-2 text-xs',
                filter === opt.id
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground',
              ]"
              @click="filterOpen = false"
            >
              <Check
                v-if="filter === opt.id"
                class="size-3"
              />
              <span v-else class="size-3" />
              {{ opt.label }}
            </RouterLink>
          </div>
        </div>
      </div>

      <div
        v-if="view === 'map'"
        class="text-muted-foreground font-serif rounded-2xl border border-dashed p-8 text-center text-sm italic"
      >
        Map view — stub.
      </div>
      <CompetitionsCalendar
        v-else-if="view === 'calendar'"
        :competitions="competitions"
      />

      <template v-else>
        <HeroCompCard v-if="featuredComp && filter === 'upcoming'" :competition="featuredComp" />

        <div
          v-if="loading && !competitions.length"
          class="text-muted-foreground font-serif text-sm italic"
        >
          Loading…
        </div>
        <div
          v-else-if="!competitions.length"
          class="text-muted-foreground space-y-2 font-serif text-sm italic"
        >
          <div>No competitions found.</div>
          <button
            v-if="!includeArchived"
            type="button"
            class="hover:text-foreground not-italic font-sans text-xs underline"
            @click="includeArchived = true"
          >
            Load archived competitions
          </button>
        </div>
        <div
          v-else-if="!visibleCompetitions.length"
          class="text-muted-foreground font-serif text-sm italic"
        >
          <span v-if="filter === 'upcoming'">No upcoming competitions.</span>
          <span v-else-if="filter === 'past'">No past competitions on record.</span>
          <span v-else>No competitions match.</span>
        </div>

        <ul v-else class="divide-y border-y">
          <li
            v-for="competition in visibleCompetitions"
            :key="competition.id"
            class="flex items-start"
          >
            <RouterLink
              :to="{
                name: 'competition.info',
                params: { competitionId: competition.id },
              }"
              class="hover:bg-accent flex min-w-0 flex-1 items-start gap-3 p-3"
            >
              <CompChip
                :name="competition.name"
                :image="competition.image"
                :size="48"
              />
              <div class="min-w-0 flex-1 pt-0.5">
                <div
                  class="font-serif text-[15px] font-medium tracking-tight leading-tight line-clamp-2"
                >
                  {{ competition.name ?? '?' }}
                </div>
                <div
                  v-if="competition.location"
                  class="text-muted-foreground mt-1 truncate text-[11.5px]"
                >
                  {{ competition.location }}
                </div>
                <div
                  class="text-muted-foreground/80 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] tabular-nums"
                >
                  <span v-if="competition.date">{{
                    formatRelative(competition.date)
                  }}</span>
                  <span
                    v-if="favorites.isFavoriteCompetition(competition.id)"
                    class="text-secondary inline-flex items-center gap-1 font-semibold tracking-[0.06em]"
                  >
                    <Star class="size-3 fill-current" />
                    Favourited
                  </span>
                </div>
              </div>
            </RouterLink>
            <FavoriteCompetitionButton :competition-id="competition.id" class="mr-2 mt-2" />
          </li>
        </ul>

        <div v-if="competitions.length && !includeArchived" class="pt-2 text-center">
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground text-xs underline"
            @click="includeArchived = true"
          >
            Load archived competitions
          </button>
        </div>
      </template>
    </main>
  </div>
</template>
