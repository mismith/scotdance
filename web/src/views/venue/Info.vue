<script setup lang="ts">
import { computed } from 'vue'
import { School } from '@lucide/vue'
import { useVenueProfile, type VenueAppearance } from '@/composables/useVenueProfile'
import { formatMonthAbbrev } from '@/lib/format'
import StatGrid from '@/components/StatGrid.vue'

const profile = useVenueProfile()
const { name, locationLine, loading } = profile

function compRoute(a: VenueAppearance | null) {
  if (!a?.raw.competitionId) return undefined
  return {
    name: 'competition.info',
    params: { competitionId: a.raw.competitionId },
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
      to: { name: 'venue.competitions' },
    },
    {
      label: 'First seen',
      caption: firstDate ? formatMonthAbbrev(firstDate).toUpperCase() : undefined,
      value: firstDate ? firstDate.getFullYear() : null,
      to: compRoute(first),
    },
    {
      label: 'Last seen',
      caption: lastDate ? formatMonthAbbrev(lastDate).toUpperCase() : undefined,
      value: lastDate ? lastDate.getFullYear() : null,
      to: compRoute(last),
    },
  ]
})
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
  </article>
</template>
