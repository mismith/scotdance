<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { Check, ChevronDown, ChevronRight, CircleDashed, Loader2, Star } from '@lucide/vue';
import { useCompetition } from '@/composables/useCompetition';
import { useFavoritesStore } from '@/stores/favorites';
import {
  findGroupDancers,
  hasGroupAnyResults,
  isGroupInProgress,
} from '@/lib/results';
import type { Category, EnrichedGroup } from '@/types/competition';

const { competitionId, categories, groups, dancers, dances, results, loadDancers, loadResults } =
  useCompetition();
const favorites = useFavoritesStore();

onMounted(async () => {
  await Promise.all([loadDancers(), loadResults()]);
});

interface CategoryRow {
  category: Category;
  groups: EnrichedGroup[];
}

const groupedCategories = computed<CategoryRow[]>(() =>
  categories.value.map((category) => ({
    category,
    groups: groups.value.filter((g) => g.categoryId === category.id),
  })),
);

const expanded = useLocalStorage<Record<string, Record<string, boolean>>>(
  'results:expandedCategories',
  {},
);

function isExpanded(category: Category): boolean {
  const map = expanded.value[competitionId.value] ?? {};
  if (category.id in map) return map[category.id];
  return groupedCategories.value.length <= 1;
}

function toggle(category: Category) {
  const current = expanded.value[competitionId.value] ?? {};
  expanded.value = {
    ...expanded.value,
    [competitionId.value]: { ...current, [category.id]: !isExpanded(category) },
  };
}

function categoryHasFavorite(category: Category): boolean {
  return dancers.value.some(
    (d) => d.group?.categoryId === category.id && favorites.isFavoriteDancer(d.id),
  );
}

function groupHasFavorite(group: EnrichedGroup): boolean {
  return findGroupDancers(group.id, dancers.value).some((d) =>
    favorites.isFavoriteDancer(d.id),
  );
}

interface GroupStatus {
  state: 'tbd' | 'in-progress' | 'done';
  label: string;
}

function groupStatus(group: EnrichedGroup): GroupStatus {
  if (isGroupInProgress(group, dances.value, results.value)) {
    return { state: 'in-progress', label: 'In progress' };
  }
  if (hasGroupAnyResults(group, dances.value, results.value)) {
    return { state: 'done', label: 'Results posted' };
  }
  return { state: 'tbd', label: 'TBD' };
}

const hasAnyResults = computed(() =>
  groups.value.some((g) => hasGroupAnyResults(g, dances.value, results.value)),
);

const loaded = computed(() => groups.value.length > 0);
</script>

<template>
  <div class="space-y-4">
    <div v-if="!loaded" class="text-muted-foreground text-sm">Loading…</div>

    <div
      v-else-if="!hasAnyResults"
      class="text-muted-foreground text-sm"
    >
      No results posted yet. Check back later.
    </div>

    <section v-for="row in groupedCategories" :key="row.category.id" class="space-y-2">
      <button
        type="button"
        class="w-full flex items-center gap-2 px-1 py-1 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground"
        @click="toggle(row.category)"
      >
        <ChevronDown
          :class="['size-4 transition-transform', isExpanded(row.category) ? '' : '-rotate-90']"
        />
        <span class="flex-1 text-left">{{ row.category.name || '?' }}</span>
        <Star
          v-if="categoryHasFavorite(row.category)"
          class="size-4 text-secondary fill-current"
        />
        <span class="text-xs font-normal normal-case tracking-normal">
          {{ row.groups.length }}
        </span>
      </button>

      <ul v-if="isExpanded(row.category)" class="divide-y border rounded-md">
        <li v-if="!row.groups.length" class="p-3 text-sm text-muted-foreground">
          No groups.
        </li>
        <li v-for="group in row.groups" :key="group.id">
          <RouterLink
            :to="{ name: 'competition.group', params: { competitionId, groupId: group.id } }"
            class="flex items-center gap-3 p-3 hover:bg-accent"
          >
            <span
              :class="[
                'size-9 rounded-full flex items-center justify-center shrink-0 text-xs font-medium',
                groupStatus(group).state === 'done'
                  ? (groupHasFavorite(group)
                    ? 'bg-secondary text-secondary-foreground'
                    : 'bg-primary text-primary-foreground')
                  : groupStatus(group).state === 'in-progress'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-muted text-muted-foreground',
              ]"
              :title="groupStatus(group).label"
            >
              <Check v-if="groupStatus(group).state === 'done'" class="size-4" />
              <Loader2
                v-else-if="groupStatus(group).state === 'in-progress'"
                class="size-4 animate-spin"
              />
              <CircleDashed v-else class="size-4 opacity-60" />
            </span>
            <span class="font-medium flex-1 min-w-0 truncate">
              {{ group.name || group.fullName }}
            </span>
            <Star
              v-if="groupHasFavorite(group)"
              class="size-4 text-secondary fill-current"
            />
            <ChevronRight class="size-4 text-muted-foreground" />
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>
