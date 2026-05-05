<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import Fuse from 'fuse.js';
import { ChevronDown, Star, X } from '@lucide/vue';
import { useCompetition } from '@/composables/useCompetition';
import { useAuthStore } from '@/stores/auth';
import { useFavoritesStore } from '@/stores/favorites';
import type { EnrichedDancer } from '@/types/competition';
import FavoriteDancerButton from '@/components/FavoriteDancerButton.vue';

const SUGGESTIONS_NAME = 'Suggested Favourites';

const { competitionId, dancers, loadDancers } = useCompetition();
const auth = useAuthStore();
const favorites = useFavoritesStore();

onMounted(loadDancers);

type SortKey = 'group' | 'number' | 'location' | 'firstName' | 'lastName';

const sortableBys: Array<{ key: SortKey; label: string }> = [
  { key: 'group', label: 'Age Group' },
  { key: 'number', label: 'Number' },
  { key: 'location', label: 'Location' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
];

const filter = useLocalStorage('dancers:filter', '');
const sortBy = useLocalStorage<SortKey>('dancers:sortBy', 'group');
const onlyFavorites = ref(false);
const expandedByGroup = useLocalStorage<Record<string, Record<string, boolean>>>(
  'dancers:expandedByGroup',
  {},
);
const dismissedSuggestions = useLocalStorage<Record<string, boolean>>(
  'dancers:dismissedSuggestions',
  {},
);

const fuse = computed(
  () =>
    new Fuse(dancers.value, {
      keys: ['fullName', 'firstName', 'lastName', 'number', 'location', 'group.fullName'],
      threshold: 0.33,
      ignoreLocation: true,
    }),
);

const dancerNumber = (d: EnrichedDancer) =>
  d.number != null && Number.isFinite(d.number) ? d.number : Number.POSITIVE_INFINITY;

const groupSortValue = (d: EnrichedDancer) =>
  d.group?._order ?? Number.POSITIVE_INFINITY;

const sortedDancers = computed(() => {
  const list = [...dancers.value];
  switch (sortBy.value) {
    case 'group':
      return list.sort((a, b) => groupSortValue(a) - groupSortValue(b) || dancerNumber(a) - dancerNumber(b));
    case 'number':
      return list.sort((a, b) => dancerNumber(a) - dancerNumber(b));
    case 'location':
      return list.sort((a, b) => (a.location ?? '').localeCompare(b.location ?? ''));
    case 'firstName':
      return list.sort((a, b) => (a.firstName ?? '').localeCompare(b.firstName ?? ''));
    case 'lastName':
      return list.sort((a, b) => (a.lastName ?? '').localeCompare(b.lastName ?? ''));
    default:
      return list;
  }
});

const filteredDancers = computed(() => {
  let list = sortedDancers.value;
  const q = filter.value.trim();
  if (q) {
    const matched = new Set(fuse.value.search(q).map((r) => r.item.id));
    list = list.filter((d) => matched.has(d.id));
  }
  if (onlyFavorites.value) {
    list = list.filter((d) => favorites.isFavoriteDancer(d.id));
  }
  return list;
});

const suggestions = computed<EnrichedDancer[]>(() => {
  const favoriteNames = new Set(
    Object.values(favorites.dancers)
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0),
  );
  if (!favoriteNames.size) return [];
  return dancers.value.filter(
    (d) => !favorites.isFavoriteDancer(d.id) && favoriteNames.has(d.fullName),
  );
});

const showSuggestionsBanner = computed(
  () => suggestions.value.length > 0 && !dismissedSuggestions.value[competitionId.value],
);

interface DancerGroupRow {
  groupName: string;
  groupOrder: number;
  members: EnrichedDancer[];
  isSuggestions?: boolean;
}

const getGroupBucket = (d: EnrichedDancer): { name: string; order: number } => {
  switch (sortBy.value) {
    case 'group':
      return { name: d.group?.fullName || 'Unassigned', order: d.group?._order ?? Number.POSITIVE_INFINITY };
    case 'number':
      return { name: 'Number', order: 0 };
    case 'location':
      return { name: d.location || '?', order: 0 };
    case 'firstName': {
      const ch = (d.firstName ?? '?')[0]?.toUpperCase() || '?';
      return { name: ch, order: ch.charCodeAt(0) };
    }
    case 'lastName': {
      const ch = (d.lastName ?? '?')[0]?.toUpperCase() || '?';
      return { name: ch, order: ch.charCodeAt(0) };
    }
    default:
      return { name: 'All', order: 0 };
  }
};

const grouped = computed<DancerGroupRow[]>(() => {
  const map = new Map<string, DancerGroupRow>();
  for (const dancer of filteredDancers.value) {
    const bucket = getGroupBucket(dancer);
    let row = map.get(bucket.name);
    if (!row) {
      row = { groupName: bucket.name, groupOrder: bucket.order, members: [] };
      map.set(bucket.name, row);
    }
    row.members.push(dancer);
  }
  const rows = [...map.values()].sort(
    (a, b) => a.groupOrder - b.groupOrder || a.groupName.localeCompare(b.groupName),
  );
  if (onlyFavorites.value && suggestions.value.length) {
    rows.unshift({
      groupName: SUGGESTIONS_NAME,
      groupOrder: -Infinity,
      members: suggestions.value,
      isSuggestions: true,
    });
  }
  return rows;
});

function isExpanded(group: DancerGroupRow) {
  if (filter.value.trim()) return true;
  if (onlyFavorites.value && !group.isSuggestions) return true;
  const map = expandedByGroup.value[sortBy.value] ?? {};
  if (group.groupName in map) return map[group.groupName];
  return grouped.value.length <= 1 || group.isSuggestions === true;
}

function toggleExpanded(group: DancerGroupRow) {
  const current = expandedByGroup.value[sortBy.value] ?? {};
  expandedByGroup.value = {
    ...expandedByGroup.value,
    [sortBy.value]: { ...current, [group.groupName]: !isExpanded(group) },
  };
}

function groupHasFavorite(group: DancerGroupRow) {
  return group.members.some((d) => favorites.isFavoriteDancer(d.id));
}

async function favoriteAll(dancersToFavorite: EnrichedDancer[]) {
  const apply = () =>
    Promise.all(
      dancersToFavorite.map((d) => favorites.setDancer(d.id, true, d.fullName)),
    );
  if (!auth.isSignedIn) {
    auth.enqueueAfterLogin(apply);
    auth.openLogin();
    return;
  }
  await apply();
}

function activateSuggestions() {
  onlyFavorites.value = true;
  dismissedSuggestions.value = {
    ...dismissedSuggestions.value,
    [competitionId.value]: true,
  };
}

function dismissSuggestions() {
  dismissedSuggestions.value = {
    ...dismissedSuggestions.value,
    [competitionId.value]: true,
  };
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <input
        v-model="filter"
        type="search"
        placeholder="Search dancers…"
        class="flex-1 min-w-0 px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <label class="text-xs text-muted-foreground">
        <span class="sr-only">Sort by</span>
        <select
          v-model="sortBy"
          class="px-2 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option v-for="by in sortableBys" :key="by.key" :value="by.key">
            {{ by.label }}
          </option>
        </select>
      </label>
      <button
        type="button"
        :title="onlyFavorites ? 'Show all dancers' : 'Show only favorites'"
        :aria-pressed="onlyFavorites"
        :class="[
          'p-2 rounded-md border hover:bg-accent transition-colors',
          onlyFavorites ? 'text-secondary border-secondary' : 'text-muted-foreground',
        ]"
        @click="onlyFavorites = !onlyFavorites"
      >
        <Star :class="['size-4', onlyFavorites && 'fill-current']" />
      </button>
    </div>

    <div
      v-if="showSuggestionsBanner"
      class="flex items-center gap-3 px-4 py-3 rounded-md border border-secondary/40 bg-secondary/10 cursor-pointer hover:bg-secondary/15"
      @click="activateSuggestions"
    >
      <Star class="size-5 text-secondary fill-current shrink-0" />
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-sm">
          {{ suggestions.length }} favourite dancer {{ suggestions.length === 1 ? 'suggestion' : 'suggestions' }}
        </div>
        <div class="text-xs text-muted-foreground">based on your previous selections</div>
      </div>
      <button
        type="button"
        class="p-1 rounded-md hover:bg-secondary/20"
        title="Dismiss"
        @click.stop="dismissSuggestions"
      >
        <X class="size-4" />
      </button>
    </div>

    <div v-if="!dancers.length" class="text-muted-foreground text-sm">
      No dancers loaded yet.
    </div>
    <div v-else-if="!grouped.length" class="text-muted-foreground text-sm">
      <template v-if="onlyFavorites && !auth.isSignedIn">
        Sign in to see your favorite dancers.
      </template>
      <template v-else-if="onlyFavorites">No favorite dancers.</template>
      <template v-else>No matches.</template>
    </div>

    <section v-for="group in grouped" :key="group.groupName" class="space-y-2">
      <button
        type="button"
        class="w-full flex items-center gap-2 px-1 py-1 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground"
        @click="toggleExpanded(group)"
      >
        <ChevronDown
          :class="[
            'size-4 transition-transform',
            isExpanded(group) ? '' : '-rotate-90',
          ]"
        />
        <span class="flex-1 text-left">{{ group.groupName }}</span>
        <button
          v-if="group.isSuggestions && isExpanded(group)"
          type="button"
          class="px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:opacity-90"
          @click.stop="favoriteAll(group.members)"
        >
          Favourite All
        </button>
        <Star
          v-else-if="!onlyFavorites && groupHasFavorite(group)"
          class="size-4 text-secondary fill-current"
        />
        <span class="text-xs font-normal normal-case tracking-normal">
          {{ group.members.length }}
        </span>
      </button>
      <ul v-if="isExpanded(group)" class="divide-y border rounded-md">
        <li v-for="dancer in group.members" :key="dancer.id">
          <div class="flex items-center">
            <RouterLink
              :to="{ name: 'competition.dancer', params: { competitionId, dancerId: dancer.id } }"
              class="flex items-center gap-3 p-3 flex-1 min-w-0 hover:bg-accent"
            >
              <div
                class="size-8 rounded-full bg-muted text-xs font-mono flex items-center justify-center text-muted-foreground shrink-0"
              >
                {{ dancer.number ?? '–' }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-medium truncate">{{ dancer.fullName || '?' }}</div>
                <div v-if="dancer.location" class="text-xs text-muted-foreground truncate">
                  {{ dancer.location }}
                </div>
              </div>
            </RouterLink>
            <FavoriteDancerButton :dancer="dancer" class="mr-2" />
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
