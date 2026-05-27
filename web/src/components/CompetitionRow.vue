<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import CompChip from '@/components/CompChip.vue'
import FavoriteCompetitionButton from '@/components/FavoriteCompetitionButton.vue'
import { useFavoritesStore } from '@/stores/favorites'
import { formatShortDate, isSameDay } from '@/lib/format'
import { useVtScope } from '@/lib/viewTransitionFocus'

const props = withDefaults(
  defineProps<{
    competition: CompetitionListItem
    to: RouteLocationRaw
    showDate?: boolean
  }>(),
  { showDate: true },
)

const vt = useVtScope('comp')
const favorites = useFavoritesStore()
const isFavorite = computed(() => favorites.isFavorite('competitions', props.competition.id))
</script>

<template>
  <li class="flex items-start">
    <RouterLink v-slot="{ href, navigate }" :to="to" custom>
      <a
        :href="href"
        class="flex min-w-0 flex-1 items-start gap-3 py-3 pr-3 pl-1"
        @click="vt.onNavigate($event, navigate, competition.id)"
      >
        <CompChip
          :name="competition.name"
          :image="competition.image"
          :favorite="isFavorite"
          class="size-12 rounded-xl [view-transition-class:nav-avatar]"
          :style="{ viewTransitionName: vt.name(competition.id, 'avatar') }"
        />
        <div class="min-w-0 flex-1 pt-0.5">
          <div
            class="text-item-title line-clamp-2 [view-transition-class:fit_nav-title]"
            :style="{ viewTransitionName: vt.name(competition.id, 'name') }"
          >
            {{ competition.name ?? '?' }}
          </div>
          <slot name="meta" />
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
      </a>
    </RouterLink>
    <FavoriteCompetitionButton :competition-id="competition.id" class="mt-2 mr-2" />
  </li>
</template>
