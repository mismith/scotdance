<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import Fuse from 'fuse.js'
import { ChevronDown, Filter, Pin } from '@lucide/vue'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import { useFavoritesStore } from '@/stores/favorites'
import FavoriteCompetitionButton from '@/components/FavoriteCompetitionButton.vue'
import { formatShortDate, isPast } from '@/lib/format'

const includeArchived = useLocalStorage('competitions:includeArchived', false)
const filter = useLocalStorage('competitions:filter', '')
const locationFilter = useLocalStorage<string[]>('competitions:locationFilter', [])
const onlyPinned = ref(false)
const locationFilterOpen = ref(false)
const expandedByGroup = useLocalStorage<Record<string, boolean>>(
  'competitions:expandedByGroup',
  {},
)

const { competitions, loading } = useCompetitions(includeArchived)

const favorites = useFavoritesStore()

const fuse = computed(
  () =>
    new Fuse(competitions.value, {
      keys: ['name', 'venue', 'location', 'address', 'description', 'sobhd'],
      threshold: 0.33,
      ignoreLocation: true,
    }),
)

const locations = computed(() => {
  const set = new Set<string>()
  for (const c of competitions.value) {
    if (c.location) set.add(c.location)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
})

const filteredCompetitions = computed<CompetitionListItem[]>(() => {
  let list = competitions.value
  if (locationFilter.value.length) {
    list = list.filter((c) => c.location && locationFilter.value.includes(c.location))
  }
  const q = filter.value.trim()
  if (q) {
    const matched = new Set(fuse.value.search(q).map((r) => r.item.id))
    list = list.filter((c) => matched.has(c.id))
  }
  if (onlyPinned.value) {
    list = list.filter((c) => favorites.isFavoriteCompetition(c.id))
  }
  return list
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
  for (const c of filteredCompetitions.value) {
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
  if (filter.value.trim()) return true
  if (onlyPinned.value) return true
  if (group.groupName in expandedByGroup.value)
    return expandedByGroup.value[group.groupName]
  // default: expand groups with at least one future-or-today competition,
  // collapse fully-past groups (archives)
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

function toggleLocation(location: string) {
  const set = new Set(locationFilter.value)
  if (set.has(location)) set.delete(location)
  else set.add(location)
  locationFilter.value = [...set]
}

function clearLocations() {
  locationFilter.value = []
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <header class="bg-background border-b">
      <div class="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-3">
        <input
          v-model="filter"
          type="search"
          placeholder="Search competitions…"
          class="bg-background focus:ring-ring min-w-0 flex-1 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        />
        <div class="relative">
          <button
            type="button"
            :class="[
              'hover:bg-accent flex items-center gap-1 rounded-md border p-2 transition-colors',
              locationFilter.length
                ? 'text-foreground border-primary'
                : 'text-muted-foreground',
            ]"
            :title="
              locationFilter.length
                ? `Filtered to ${locationFilter.length} location(s)`
                : 'Filter by location'
            "
            @click="locationFilterOpen = !locationFilterOpen"
          >
            <Filter class="size-4" />
            <span v-if="locationFilter.length" class="font-mono text-xs">{{
              locationFilter.length
            }}</span>
          </button>
          <div
            v-if="locationFilterOpen"
            class="bg-background absolute top-full right-0 z-10 mt-1 max-h-[60vh] w-72 space-y-1 overflow-y-auto rounded-md border p-2 shadow-lg"
          >
            <div class="flex items-center justify-between px-2 pt-1 pb-2">
              <span class="text-muted-foreground text-xs font-semibold uppercase"
                >Locations</span
              >
              <button
                v-if="locationFilter.length"
                type="button"
                class="text-muted-foreground hover:text-foreground text-xs underline"
                @click="clearLocations"
              >
                Clear
              </button>
            </div>
            <div v-if="!locations.length" class="text-muted-foreground px-2 py-1 text-xs">
              No locations.
            </div>
            <label
              v-for="location in locations"
              :key="location"
              class="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm"
            >
              <input
                type="checkbox"
                :checked="locationFilter.includes(location)"
                @change="toggleLocation(location)"
              />
              <span class="truncate">{{ location }}</span>
            </label>
          </div>
        </div>
        <button
          type="button"
          :title="onlyPinned ? 'Show all competitions' : 'Show only pinned'"
          :aria-pressed="onlyPinned"
          :class="[
            'hover:bg-accent rounded-md border p-2 transition-colors',
            onlyPinned ? 'text-secondary border-secondary' : 'text-muted-foreground',
          ]"
          @click="onlyPinned = !onlyPinned"
        >
          <Pin :class="['size-4', onlyPinned && 'fill-current']" />
        </button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-3xl flex-1 space-y-4 p-4">
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
      <div v-else-if="!grouped.length" class="text-muted-foreground space-y-2 text-sm">
        <div>No competitions match.</div>
        <div class="space-x-3">
          <button
            v-if="locationFilter.length"
            type="button"
            class="hover:text-foreground underline"
            @click="clearLocations"
          >
            All locations
          </button>
          <button
            v-if="!includeArchived"
            type="button"
            class="hover:text-foreground underline"
            @click="includeArchived = true"
          >
            Include archived
          </button>
        </div>
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
          <Pin
            v-if="!onlyPinned && groupHasPin(group)"
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
                <img
                  v-if="competition.image"
                  :src="competition.image"
                  :alt="competition.name ?? ''"
                  class="bg-muted size-12 shrink-0 rounded-md object-cover"
                />
                <div v-else class="bg-muted size-12 shrink-0 rounded-md" />
                <div class="min-w-0 flex-1">
                  <div class="truncate font-medium">{{ competition.name ?? '?' }}</div>
                  <div class="text-muted-foreground truncate text-xs">
                    <span v-if="competition.date">{{
                      formatShortDate(competition.date)
                    }}</span>
                    <span v-if="competition.date && competition.location"> · </span>
                    <span v-if="competition.location">{{ competition.location }}</span>
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
    </main>
  </div>
</template>
