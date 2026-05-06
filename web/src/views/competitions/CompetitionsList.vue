<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { CalendarDays, ChevronDown, List, Map as MapIcon, Star } from '@lucide/vue'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import { useFavoritesStore } from '@/stores/favorites'
import AccountMenu from '@/components/AccountMenu.vue'
import CompChip from '@/components/CompChip.vue'
import FavoriteCompetitionButton from '@/components/FavoriteCompetitionButton.vue'
import HeroCompCard from '@/components/HeroCompCard.vue'
import { formatRelative, formatShortDate, isPast, isSameDay } from '@/lib/format'

type ViewMode = 'list' | 'map' | 'calendar'

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

const viewModes: Array<{ id: ViewMode; label: string; icon: typeof List }> = [
  { id: 'list', label: 'List', icon: List },
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
]

const includeArchived = useLocalStorage('competitions:includeArchived', false)
const expandedByGroup = useLocalStorage<Record<string, boolean>>(
  'competitions:expandedByGroup',
  {},
)

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

interface CompetitionGroupRow {
  groupName: string
  groupOrder: number
  hasFuture: boolean
  members: CompetitionListItem[]
}

function monthKey(d?: number | string) {
  if (d == null) return { name: 'Undated', order: Number.POSITIVE_INFINITY }
  const date = new Date(d)
  return {
    name: `${date.toLocaleString('en-US', { month: 'long' })} ${date.getFullYear()}`,
    order: date.getFullYear() * 100 + date.getMonth(),
  }
}

const grouped = computed<CompetitionGroupRow[]>(() => {
  const map = new Map<string, CompetitionGroupRow>()
  for (const c of competitions.value) {
    const { name, order } = monthKey(c.date)
    let row = map.get(name)
    if (!row) {
      row = { groupName: name, groupOrder: order, hasFuture: false, members: [] }
      map.set(name, row)
    }
    row.members.push(c)
    if (c.date && !isPast(c.date)) row.hasFuture = true
  }
  return [...map.values()].sort((a, b) => a.groupOrder - b.groupOrder)
})

function isExpanded(group: CompetitionGroupRow) {
  if (group.groupName in expandedByGroup.value)
    return expandedByGroup.value[group.groupName]
  return group.hasFuture || grouped.value.length <= 1
}

function toggleExpanded(group: CompetitionGroupRow) {
  expandedByGroup.value = {
    ...expandedByGroup.value,
    [group.groupName]: !isExpanded(group),
  }
}

function groupHasPin(group: CompetitionGroupRow) {
  return group.members.some((c) => favorites.isFavoriteCompetition(c.id))
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <header
      class="bg-background/85 top-safe sticky backdrop-blur-xl z-20 mx-auto flex w-full max-w-3xl items-end justify-between gap-3 p-4 pb-3"
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
    <main class="mx-auto w-full max-w-3xl flex-1 space-y-4 p-4 pt-0">
      <div class="bg-chip text-muted-foreground inline-flex rounded-lg p-1">
        <RouterLink
          v-for="mode in viewModes"
          :key="mode.id"
          :to="{ query: { ...route.query, view: mode.id === 'list' ? undefined : mode.id } }"
          replace
          :class="[
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            view === mode.id
              ? 'bg-card text-foreground shadow-sm'
              : 'hover:text-foreground',
          ]"
        >
          <component :is="mode.icon" class="size-3.5" />
          {{ mode.label }}
        </RouterLink>
      </div>

      <div
        v-if="view === 'map'"
        class="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm"
      >
        Map view — stub.
      </div>
      <div
        v-else-if="view === 'calendar'"
        class="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm"
      >
        Calendar view — stub.
      </div>

      <template v-else>
        <HeroCompCard v-if="featuredComp" :competition="featuredComp" />

        <div v-if="loading && !competitions.length" class="text-muted-foreground text-sm">
          Loading…
        </div>
        <div
          v-else-if="!competitions.length"
          class="text-muted-foreground space-y-2 text-sm"
        >
          <div>No competitions found.</div>
          <button
            v-if="!includeArchived"
            type="button"
            class="hover:text-foreground underline"
            @click="includeArchived = true"
          >
            Load archived competitions
          </button>
        </div>

        <section v-for="group in grouped" :key="group.groupName" class="space-y-2">
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 px-1 py-1 text-sm font-semibold tracking-wide uppercase"
            @click="toggleExpanded(group)"
          >
            <ChevronDown
              :class="[
                'size-4 transition-transform',
                isExpanded(group) ? '' : '-rotate-90',
              ]"
            />
            <span class="flex-1 text-left">{{ group.groupName }}</span>
            <Star
              v-if="groupHasPin(group)"
              class="text-secondary size-4 fill-current"
            />
            <span class="text-xs font-normal tracking-normal normal-case">
              {{ group.members.length }}
            </span>
          </button>
          <ul v-if="isExpanded(group)" class="divide-y rounded-md border">
            <li v-for="competition in group.members" :key="competition.id">
              <div class="flex items-center">
                <RouterLink
                  :to="{
                    name: 'competition.info',
                    params: { competitionId: competition.id },
                  }"
                  class="hover:bg-accent flex min-w-0 flex-1 items-center gap-3 p-3"
                >
                  <CompChip
                    :name="competition.name"
                    :image="competition.image"
                    :size="48"
                  />
                  <div class="min-w-0 flex-1">
                    <div
                      class="font-serif truncate text-base font-medium tracking-tight"
                    >
                      {{ competition.name ?? '?' }}
                    </div>
                    <div class="text-muted-foreground truncate text-xs tabular-nums">
                      <span v-if="competition.date">{{
                        formatShortDate(competition.date)
                      }}</span>
                      <span v-if="competition.date && competition.location"> · </span>
                      <span v-if="competition.location">{{ competition.location }}</span>
                    </div>
                    <div
                      v-if="competition.date && !isPast(competition.date)"
                      class="text-muted-foreground/80 mt-0.5 truncate text-[11px]"
                    >
                      {{ formatRelative(competition.date) }}
                    </div>
                  </div>
                </RouterLink>
                <FavoriteCompetitionButton :competition-id="competition.id" class="mr-2" />
              </div>
            </li>
          </ul>
        </section>

        <div v-if="grouped.length && !includeArchived" class="pt-2 text-center">
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
