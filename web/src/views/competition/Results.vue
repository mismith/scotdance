<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Loader2,
} from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useFavoritesStore } from '@/stores/favorites'
import { findGroupDancers, hasGroupAnyResults, isGroupInProgress } from '@/lib/results'
import type { Category, EnrichedGroup } from '@/types/competition'
import SmoothCollapse from '@/components/SmoothCollapse.vue'

const {
  competitionId,
  categories,
  groups,
  dancers,
  dances,
  results,
  loadDancers,
  loadResults,
} = useCompetition()
const favorites = useFavoritesStore()

onMounted(async () => {
  await Promise.all([loadDancers(), loadResults()])
})

interface CategoryRow {
  category: Category
  groups: EnrichedGroup[]
}

const groupedCategories = computed<CategoryRow[]>(() =>
  categories.value.map((category) => ({
    category,
    groups: groups.value.filter((g) => g.categoryId === category.id),
  })),
)

const expanded = useLocalStorage<Record<string, Record<string, boolean>>>(
  'results:expandedCategories',
  {},
)

function isExpanded(category: Category): boolean {
  const map = expanded.value[competitionId.value] ?? {}
  if (category.id in map) return map[category.id]
  return groupedCategories.value.length <= 1
}

function toggle(category: Category) {
  const current = expanded.value[competitionId.value] ?? {}
  expanded.value = {
    ...expanded.value,
    [competitionId.value]: { ...current, [category.id]: !isExpanded(category) },
  }
}

function categoryFavoriteCount(category: Category): number {
  return groups.value.filter(
    (g) =>
      g.categoryId === category.id &&
      findGroupDancers(g.id, dancers.value).some((d) =>
        favorites.isFavoriteDancer(d.id),
      ),
  ).length
}

function groupHasFavorite(group: EnrichedGroup): boolean {
  return findGroupDancers(group.id, dancers.value).some((d) =>
    favorites.isFavoriteDancer(d.id),
  )
}

interface GroupStatus {
  state: 'tbd' | 'in-progress' | 'done'
  label: string
}

function groupStatus(group: EnrichedGroup): GroupStatus {
  if (isGroupInProgress(group, dances.value, results.value)) {
    return { state: 'in-progress', label: 'In progress' }
  }
  if (hasGroupAnyResults(group, dances.value, results.value)) {
    return { state: 'done', label: 'Results posted' }
  }
  return { state: 'tbd', label: 'TBD' }
}

const hasAnyResults = computed(() =>
  groups.value.some((g) => hasGroupAnyResults(g, dances.value, results.value)),
)

const loaded = computed(() => groups.value.length > 0)
</script>

<template>
  <div class="space-y-4">
    <div v-if="!loaded" class="text-muted-foreground font-serif italic text-lg">Loading…</div>

    <div
      v-else-if="!hasAnyResults"
      class="text-muted-foreground font-serif text-lg italic"
    >
      No results posted yet. Check back later.
    </div>

    <section v-for="row in groupedCategories" :key="row.category.id" class="space-y-1">
      <button
        type="button"
        class="flex w-full items-baseline gap-2 px-1 py-2 text-left"
        @click="toggle(row.category)"
      >
        <ChevronDown
          :class="[
            'text-muted-foreground size-4 shrink-0 self-center transition-transform',
            isExpanded(row.category) ? '' : '-rotate-90',
          ]"
        />
        <span
          class="font-serif min-w-0 flex-1 truncate text-2xl font-medium tracking-tight leading-tight"
        >
          {{ row.category.name || '?' }}
        </span>
        <span
          class="text-muted-foreground self-center font-semibold tabular-nums"
        >
          <template v-if="categoryFavoriteCount(row.category) > 0">
            <span class="text-secondary">{{
              categoryFavoriteCount(row.category)
            }}</span
            >/<span>{{ row.groups.length }}</span>
          </template>
          <template v-else>{{ row.groups.length }}</template>
        </span>
      </button>

      <SmoothCollapse :open="isExpanded(row.category)">
        <ul class="border-b">
        <li
          v-if="!row.groups.length"
          class="text-muted-foreground font-serif px-1 py-3 text-lg italic"
        >
          No groups.
        </li>
        <li v-for="group in row.groups" :key="group.id">
          <RouterLink
            :to="{
              name: 'competition.group',
              params: { competitionId, groupId: group.id },
            }"
            class="flex items-center gap-3 px-1 py-3"
          >
            <span
              :class="[
                'flex size-9 shrink-0 items-center justify-center rounded-full font-medium',
                groupStatus(group).state === 'done'
                  ? groupHasFavorite(group)
                    ? 'bg-secondary text-secondary-foreground'
                    : 'bg-muted text-muted-foreground'
                  : groupStatus(group).state === 'in-progress'
                    ? 'border border-amber-300 bg-amber-100 text-amber-900'
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
            <div class="min-w-0 flex-1">
              <div
                class="font-serif truncate leading-tight font-medium tracking-tight"
              >
                {{ group.name || group.fullName }}
              </div>
              <div
                v-if="groupStatus(group).state !== 'done'"
                :class="[
                  'mt-0.5 text-xs font-medium tracking-[0.18em] uppercase',
                  groupStatus(group).state === 'in-progress'
                    ? 'text-primary'
                    : 'text-muted-foreground/70',
                ]"
              >
                {{
                  groupStatus(group).state === 'in-progress' ? 'In progress' : 'TBD'
                }}
              </div>
            </div>
            <ChevronRight class="text-muted-foreground size-4" />
          </RouterLink>
        </li>
      </ul>
      </SmoothCollapse>
    </section>
  </div>
</template>
