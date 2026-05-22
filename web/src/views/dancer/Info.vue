<script setup lang="ts">
import { computed } from 'vue'
import { useDancerProfile, type DancerAppearance } from '@/composables/useDancerProfile'
import { useFavoritesStore } from '@/stores/favorites'
import { formatMonthAbbrev, initialsOf } from '@/lib/format'
import StatGrid from '@/components/StatGrid.vue'

const profile = useDancerProfile()
const { displayName, location, image, appearances, loading } = profile
const favorites = useFavoritesStore()

const initials = computed(() => initialsOf(displayName.value))

const isFavorite = computed(() =>
  appearances.value.some(
    (a) => a.raw.dancerId && favorites.isFavoriteDancer(a.raw.dancerId),
  ),
)

function compDancerRoute(a: DancerAppearance | null) {
  if (!a?.raw.competitionId || !a.raw.dancerId) return undefined
  return {
    name: 'competition.dancer',
    params: {
      competitionId: a.raw.competitionId,
      dancerId: a.raw.dancerId,
    },
  }
}

const tiles = computed(() => {
  const first = profile.firstSeen.value
  const last = profile.lastSeen.value
  const firstDate = profile.firstSeenDate.value
  const lastDate = profile.lastSeenDate.value
  return [
    {
      label: 'Competitions',
      value: profile.totalComps.value,
      to: { name: 'dancer.results' },
    },
    { label: 'Venues', value: profile.venueCount.value },
    {
      label: 'First seen',
      caption: firstDate ? formatMonthAbbrev(firstDate).toUpperCase() : undefined,
      value: firstDate ? firstDate.getFullYear() : null,
      to: compDancerRoute(first),
    },
    {
      label: 'Last seen',
      caption: lastDate ? formatMonthAbbrev(lastDate).toUpperCase() : undefined,
      value: lastDate ? lastDate.getFullYear() : null,
      to: compDancerRoute(last),
    },
  ]
})
</script>

<template>
  <article class="space-y-6">
    <header class="space-y-3 pr-16">
      <div
        :class="[
          'flex size-20 items-center justify-center overflow-hidden rounded-full text-4xl font-medium [view-transition-class:nav-avatar] [view-transition-name:dancer-avatar]',
          isFavorite
            ? 'bg-secondary text-secondary-foreground'
            : 'bg-muted text-muted-foreground',
        ]"
      >
        <img
          v-if="image"
          :src="image"
          :alt="displayName"
          class="size-full object-cover"
        />
        <template v-else>{{ initials || '?' }}</template>
      </div>
      <div class="space-y-1">
        <h1
          class="text-title [view-transition-class:fit_nav-title] [view-transition-name:dancer-name]"
        >
          {{ displayName }}
        </h1>
        <p
          v-if="location"
          class="text-muted-foreground text-lg italic"
        >
          {{ location }}
        </p>
      </div>
    </header>

    <StatGrid :stats="tiles" :loading="loading" />

    <p class="text-muted-foreground">
      Cross-comp profile is matched by name. Identity may be approximate when names
      are shared.
    </p>
  </article>
</template>
