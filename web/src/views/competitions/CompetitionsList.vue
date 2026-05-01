<script setup lang="ts">
import { computed, ref } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import Fuse from 'fuse.js';
import { Filter, Pin } from 'lucide-vue-next';
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions';
import { useFavoritesStore } from '@/stores/favorites';
import AccountButton from '@/components/AccountButton.vue';
import FavoriteCompetitionButton from '@/components/FavoriteCompetitionButton.vue';
import { formatShortDate } from '@/lib/format';

const includeArchived = useLocalStorage('competitions:includeArchived', false);
const filter = useLocalStorage('competitions:filter', '');
const locationFilter = useLocalStorage<string[]>('competitions:locationFilter', []);
const onlyPinned = ref(false);
const locationFilterOpen = ref(false);

const { competitions, loading } = useCompetitions(includeArchived);

const favorites = useFavoritesStore();

const fuse = computed(
  () =>
    new Fuse(competitions.value, {
      keys: ['name', 'venue', 'location', 'address', 'description', 'sobhd'],
      threshold: 0.33,
      ignoreLocation: true,
    }),
);

const locations = computed(() => {
  const set = new Set<string>();
  for (const c of competitions.value) {
    if (c.location) set.add(c.location);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
});

const filteredCompetitions = computed<CompetitionListItem[]>(() => {
  let list = competitions.value;
  if (locationFilter.value.length) {
    list = list.filter((c) => c.location && locationFilter.value.includes(c.location));
  }
  const q = filter.value.trim();
  if (q) {
    const matched = new Set(fuse.value.search(q).map((r) => r.item.id));
    list = list.filter((c) => matched.has(c.id));
  }
  if (onlyPinned.value) {
    list = list.filter((c) => favorites.isFavoriteCompetition(c.id));
  }
  return list;
});

function toggleLocation(location: string) {
  const set = new Set(locationFilter.value);
  if (set.has(location)) set.delete(location);
  else set.add(location);
  locationFilter.value = [...set];
}

function clearLocations() {
  locationFilter.value = [];
}
</script>

<template>
  <div class="min-h-svh flex flex-col">
    <header class="border-b">
      <div class="max-w-3xl mx-auto p-4 flex items-center gap-4">
        <h1 class="text-lg font-semibold flex-1">Competitions</h1>
        <AccountButton />
      </div>

      <div class="max-w-3xl mx-auto px-4 pb-3 flex flex-wrap items-center gap-2">
        <input
          v-model="filter"
          type="search"
          placeholder="Search competitions…"
          class="flex-1 min-w-0 px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div class="relative">
          <button
            type="button"
            :class="[
              'p-2 rounded-md border hover:bg-accent transition-colors flex items-center gap-1',
              locationFilter.length ? 'text-foreground border-primary' : 'text-muted-foreground',
            ]"
            :title="locationFilter.length ? `Filtered to ${locationFilter.length} location(s)` : 'Filter by location'"
            @click="locationFilterOpen = !locationFilterOpen"
          >
            <Filter class="size-4" />
            <span v-if="locationFilter.length" class="text-xs font-mono">{{ locationFilter.length }}</span>
          </button>
          <div
            v-if="locationFilterOpen"
            class="absolute right-0 top-full mt-1 z-10 w-72 max-h-[60vh] overflow-y-auto rounded-md border bg-background shadow-lg p-2 space-y-1"
          >
            <div class="flex items-center justify-between px-2 pt-1 pb-2">
              <span class="text-xs font-semibold text-muted-foreground uppercase">Locations</span>
              <button
                v-if="locationFilter.length"
                type="button"
                class="text-xs underline text-muted-foreground hover:text-foreground"
                @click="clearLocations"
              >
                Clear
              </button>
            </div>
            <div v-if="!locations.length" class="px-2 py-1 text-xs text-muted-foreground">
              No locations.
            </div>
            <label
              v-for="location in locations"
              :key="location"
              class="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer text-sm"
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
            'p-2 rounded-md border hover:bg-accent transition-colors',
            onlyPinned ? 'text-yellow-500 border-yellow-500' : 'text-muted-foreground',
          ]"
          @click="onlyPinned = !onlyPinned"
        >
          <Pin :class="['size-4', onlyPinned && 'fill-current']" />
        </button>
      </div>
    </header>

    <main class="flex-1 max-w-3xl w-full mx-auto p-4">
      <div v-if="loading && !competitions.length" class="text-muted-foreground text-sm">
        Loading…
      </div>
      <div v-else-if="!competitions.length" class="text-muted-foreground text-sm space-y-2">
        <div>No competitions found.</div>
        <button
          v-if="!includeArchived"
          type="button"
          class="underline hover:text-foreground"
          @click="includeArchived = true"
        >
          Load archived competitions
        </button>
      </div>
      <div v-else-if="!filteredCompetitions.length" class="text-muted-foreground text-sm space-y-2">
        <div>No competitions match.</div>
        <div class="space-x-3">
          <button
            v-if="locationFilter.length"
            type="button"
            class="underline hover:text-foreground"
            @click="clearLocations"
          >
            All locations
          </button>
          <button
            v-if="!includeArchived"
            type="button"
            class="underline hover:text-foreground"
            @click="includeArchived = true"
          >
            Include archived
          </button>
        </div>
      </div>

      <ul v-else class="divide-y border rounded-md">
        <li v-for="competition in filteredCompetitions" :key="competition.id">
          <div class="flex items-center">
            <RouterLink
              :to="{ name: 'competition.info', params: { competitionId: competition.id } }"
              class="flex-1 min-w-0 flex items-center gap-3 p-3 hover:bg-accent"
            >
              <img
                v-if="competition.image"
                :src="competition.image"
                :alt="competition.name ?? ''"
                class="size-12 rounded-md object-cover bg-muted shrink-0"
              />
              <div v-else class="size-12 rounded-md bg-muted shrink-0" />
              <div class="min-w-0 flex-1">
                <div class="font-medium truncate">{{ competition.name ?? '?' }}</div>
                <div class="text-xs text-muted-foreground truncate">
                  <span v-if="competition.date">{{ formatShortDate(competition.date) }}</span>
                  <span v-if="competition.date && competition.location"> · </span>
                  <span v-if="competition.location">{{ competition.location }}</span>
                </div>
              </div>
            </RouterLink>
            <FavoriteCompetitionButton :competition-id="competition.id" class="mr-2" />
          </div>
        </li>
      </ul>

      <div v-if="filteredCompetitions.length && !includeArchived" class="mt-4 text-center">
        <button
          type="button"
          class="text-xs underline text-muted-foreground hover:text-foreground"
          @click="includeArchived = true"
        >
          Load archived competitions
        </button>
      </div>
    </main>
  </div>
</template>
