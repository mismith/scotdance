<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleDashed,
  Loader2,
  Trophy,
} from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useFavoritesStore } from '@/stores/favorites'
import {
  findGroupDancers,
  groupHasPlaceholderDancers,
  hasGroupAnyResults,
  isGroupInProgress,
} from '@/lib/results'
import type { Category, EnrichedGroup } from '@/types/competition'
import DisclosureHeader from '@/components/DisclosureHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import SmoothCollapse from '@/components/SmoothCollapse.vue'
import { useVtScope } from '@/lib/viewTransitionFocus'

const {
  competitionId,
  categories,
  groups,
  dancers,
  dances,
  results,
  points,
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

function groupHasFavorite(group: EnrichedGroup): boolean {
  return findGroupDancers(group.id, dancers.value).some((d) =>
    favorites.isFavoriteDancer(d.id),
  )
}

function groupHasUnknownDancers(group: EnrichedGroup): boolean {
  return groupHasPlaceholderDancers(group, results.value, points.value)
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

const vt = useVtScope('group')
</script>

<template>
  <div class="space-y-4">
    <div v-if="!loaded" class="space-y-6" aria-busy="true" aria-live="polite">
      <span class="sr-only">Loading results…</span>
      <div v-for="i in 2" :key="i" class="space-y-3">
        <Skeleton class="h-7 w-1/3" />
        <Skeleton v-for="j in 3" :key="j" class="h-12 w-full" />
      </div>
    </div>

    <EmptyState
      v-else-if="!hasAnyResults"
      :icon="Trophy"
      title="No results posted yet"
      description="Live updates will appear here as they’re announced. Check back during the competition."
    />

    <section v-for="row in groupedCategories" :key="row.category.id" class="space-y-1">
      <DisclosureHeader
        :label="row.category.name || '?'"
        :expanded="isExpanded(row.category)"
        @toggle="toggle(row.category)"
      />

      <SmoothCollapse :open="isExpanded(row.category)">
        <ul>
        <li
          v-if="!row.groups.length"
          class="text-muted-foreground px-1 py-3 text-lg italic"
        >
          No groups.
        </li>
        <li v-for="group in row.groups" :key="group.id">
          <RouterLink
            :to="{
              name: 'competition.group',
              params: { competitionId, groupId: group.id },
            }"
            v-slot="{ href, navigate }"
            custom
          >
            <a
              :href="href"
              class="flex items-center gap-3 px-1 py-3"
              @click="vt.onNavigate($event, navigate, group.id)"
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
                  class="text-item-title flex items-center gap-1.5 truncate [view-transition-class:fit_nav-title]"
                  :style="{ viewTransitionName: vt.name(group.id, 'name') }"
                >
                  <span class="truncate">{{ group.name || group.fullName }}</span>
                  <AlertTriangle
                    v-if="groupHasUnknownDancers(group)"
                    class="size-3.5 shrink-0 text-amber-500"
                    title="Contains unknown dancers — some placements couldn't be matched to a registered dancer."
                  />
                </div>
                <div
                  v-if="groupStatus(group).state !== 'done'"
                  :class="[
                    'mt-0.5 text-xs text-eyebrow',
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
            </a>
          </RouterLink>
        </li>
      </ul>
      </SmoothCollapse>
    </section>
  </div>
</template>
