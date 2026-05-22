<script setup lang="ts">
import { computed } from 'vue'
import { School, ChevronRight } from '@lucide/vue'
import { useVenueProfile } from '@/composables/useVenueProfile'
import { useFavoritesStore } from '@/stores/favorites'
import CompChip from '@/components/CompChip.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import Skeleton from '@/components/Skeleton.vue'
import StatGrid from '@/components/StatGrid.vue'

const profile = useVenueProfile()
const { name, locationLine, loading } = profile

const favorites = useFavoritesStore()

const tiles = computed(() => [
  { label: 'Total comps', value: profile.totalComps.value },
  { label: 'This year', value: profile.compsThisYear.value },
  { label: 'Upcoming', value: profile.upcoming.value.length },
  { label: 'Past', value: profile.past.value.length },
])

const recentComp = computed(() => profile.appearances.value[0] ?? null)
</script>

<template>
  <article class="space-y-6">
    <header class="space-y-3 pr-16">
      <div
        class="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 flex size-20 items-center justify-center rounded-full [view-transition-class:nav-avatar] [view-transition-name:venue-avatar]"
      >
        <School class="size-10" />
      </div>
      <div class="space-y-1">
        <h1
          class="text-title [view-transition-class:fit_nav-title] [view-transition-name:venue-name]"
        >
          {{ name }}
        </h1>
        <p
          v-if="locationLine"
          class="text-muted-foreground text-lg italic"
        >
          {{ locationLine }}
        </p>
      </div>
    </header>

    <StatGrid :stats="tiles" :loading="loading" />

    <section v-if="loading" class="space-y-2">
      <Skeleton class="h-3 w-24" />
      <Skeleton class="h-14 w-full" />
    </section>
    <section v-else-if="recentComp" class="space-y-2">
      <SectionHeader label="Most recent" />
      <RouterLink
        :to="{
          name: 'competition.info',
          params: { competitionId: recentComp.raw.competitionId },
        }"
        class="flex items-center gap-3 px-2 py-3"
      >
        <CompChip
          :name="recentComp.competition?.name"
          :image="recentComp.competition?.image"
          :favorite="favorites.isFavorite('competitions', recentComp.raw.competitionId ?? '')"
          class="size-10 rounded-xl"
        />
        <div class="min-w-0 flex-1">
          <div class="text-item-title truncate">
            {{ recentComp.competition?.name ?? 'Loading…' }}
          </div>
        </div>
        <ChevronRight class="text-muted-foreground size-4 shrink-0" />
      </RouterLink>
    </section>
  </article>
</template>
