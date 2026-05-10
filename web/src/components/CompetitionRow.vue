<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import CompChip from '@/components/CompChip.vue'
import FavoriteCompetitionButton from '@/components/FavoriteCompetitionButton.vue'
import { formatShortDate, isSameDay } from '@/lib/format'

withDefaults(
  defineProps<{
    competition: CompetitionListItem
    to: RouteLocationRaw
    showDate?: boolean
  }>(),
  { showDate: true },
)
</script>

<template>
  <li class="flex items-start">
    <RouterLink
      :to="to"
      class="flex min-w-0 flex-1 items-start gap-3 py-3 pr-3 pl-1"
    >
      <CompChip :name="competition.name" :image="competition.image" :size="48" />
      <div class="min-w-0 flex-1 pt-0.5">
        <div class="text-item-title line-clamp-2">
          {{ competition.name ?? '?' }}
        </div>
        <div
          v-if="competition.location"
          class="text-item-subtitle text-muted-foreground truncate"
        >
          {{ competition.location }}
        </div>
        <template v-if="showDate && competition.date">
          <div
            v-if="isSameDay(competition.date)"
            class="text-item-meta text-secondary font-medium"
          >
            Today
          </div>
          <div v-else class="text-item-meta text-muted-foreground/80">
            {{ formatShortDate(competition.date) }}
          </div>
        </template>
      </div>
    </RouterLink>
    <FavoriteCompetitionButton :competition-id="competition.id" class="mt-2 mr-2" />
  </li>
</template>
