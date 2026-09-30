<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { ChevronRight, Star } from '@lucide/vue'
import { useFollowing } from '@/composables/useFollowing'
import DateTile from '@/components/DateTile.vue'
import { isSameDay } from '@/lib/format'
import type { Competition } from '@/types/competition'

// A competition as a row: a calendar date block (what people scan for),
// the name, the town, then Today, and your dancers as coloured dots.
const props = withDefaults(
  defineProps<{
    competition: Competition & { id?: string }
    to: RouteLocationRaw
    followed?: boolean
    /** Followed dancers entered here (aggregate id, first name). */
    dancers?: Array<{ id: string; name: string }>
  }>(),
  { followed: false, dancers: () => [] },
)

const following = useFollowing()
const today = computed(() => isSameDay(props.competition.date))
</script>

<template>
  <li>
    <RouterLink
      :to="to"
      class="bg-card flex min-h-16 items-center gap-3 px-3 py-2.5 hover:bg-accent"
    >
      <DateTile :date="competition.date" />
      <span class="min-w-0 flex-1">
        <span class="line-clamp-2 text-base leading-snug font-bold">
          {{ competition.name ?? 'Competition' }}
        </span>
        <span v-if="competition.location" class="text-muted-foreground block truncate text-sm">
          {{ competition.location }}
        </span>
        <span v-if="today || followed || dancers.length" class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            v-if="today"
            class="bg-live-paper text-live inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-bold"
          >
            <span class="bg-live size-2 animate-[live-pulse_2s_infinite] rounded-full" />
            Today
          </span>
          <span v-if="dancers.length" class="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
            <span class="flex shrink-0 gap-0.5" aria-hidden="true">
              <span
                v-for="x in dancers.slice(0, 4)"
                :key="x.id"
                class="size-2.5 rounded-full"
                :style="{ background: following.colorFor(x.id) ?? 'var(--primary)' }"
              />
            </span>
            <span class="truncate">{{ dancers.map((x) => x.name).join(', ') }}</span>
          </span>
          <span v-else-if="followed" class="text-muted-foreground inline-flex items-center gap-1 text-sm font-semibold">
            <Star class="size-3.5 fill-current" /> Following
          </span>
        </span>
      </span>
      <ChevronRight class="text-muted-foreground size-5 shrink-0" />
    </RouterLink>
  </li>
</template>
