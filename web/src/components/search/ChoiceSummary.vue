<script setup lang="ts">
import { Star } from '@lucide/vue'
import { useFollowing } from '@/composables/useFollowing'
import type { CompetitionChoice } from './choices'

// A competition's name and town, then Today, and your dancers as coloured
// dots (or a star for one you follow), as in the Competitions list.
defineProps<{ choice: CompetitionChoice }>()

const following = useFollowing()
</script>

<template>
  <span class="min-w-0 flex-1">
    <span class="line-clamp-2 text-base leading-snug font-bold">
      {{ choice.competition.name ?? 'Competition' }}
    </span>
    <span v-if="choice.competition.location" class="text-muted-foreground block truncate text-sm">
      {{ choice.competition.location }}
    </span>
    <span
      v-if="choice.today || choice.followed || choice.dancers.length"
      class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1"
    >
      <span v-if="choice.today" class="bg-live-paper text-live inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-bold">
        <span class="bg-live size-2 rounded-full motion-safe:animate-[live-pulse_2s_infinite]" />
        Today
      </span>
      <span v-if="choice.dancers.length" class="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
        <span class="flex shrink-0 gap-0.5" aria-hidden="true">
          <span
            v-for="x in choice.dancers.slice(0, 4)"
            :key="x.id"
            class="size-2.5 rounded-full"
            :style="{ background: following.colorFor(x.id) ?? 'var(--primary)' }"
          />
        </span>
        <span class="truncate">{{ choice.dancers.map((x) => x.name).join(', ') }}</span>
      </span>
      <span v-else-if="choice.followed" class="text-muted-foreground inline-flex items-center gap-1 text-sm font-semibold">
        <Star class="size-3.5 fill-current" /> Following
      </span>
    </span>
  </span>
</template>
