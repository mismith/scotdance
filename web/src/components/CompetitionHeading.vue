<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import DateTile from '@/components/DateTile.vue'

// A competition heading over your dancers on Home: its date tile (pink on the
// day, as in the Competitions list), its name at title size, and a line under
// it (the `kicker` slot). The whole row opens the competition. Big and
// marked enough that it reads as the competition, not one more dancer.
defineProps<{ competitionId: string; name?: string | null; date?: number | string | null; today?: boolean }>()
</script>

<template>
  <RouterLink
    :to="{ name: 'competition.info', params: { competitionId } }"
    class="press-row -mx-4 flex items-center gap-3 py-1.5 pr-3 pl-4"
  >
    <DateTile :date="date" :today="today" />
    <span class="min-w-0 flex-1">
      <span class="text-title block break-words">{{ name }}</span>
      <slot name="kicker" />
    </span>
    <ChevronRight class="text-muted-foreground size-5 shrink-0" />
  </RouterLink>
</template>
