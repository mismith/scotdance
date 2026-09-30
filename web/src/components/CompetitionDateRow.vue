<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { ChevronRight, Star } from '@lucide/vue'
import { formatMonthAbbrev, isSameDay, parseDate } from '@/lib/format'
import type { Competition } from '@/types/competition'

// A competition as a row: a calendar date block (what people scan for),
// the name, the town, then optional chips (Today, your dancers, results).
const props = withDefaults(
  defineProps<{
    competition: Competition & { id?: string }
    to: RouteLocationRaw
    followed?: boolean
    /** First names of followed dancers entered here. */
    dancers?: string[]
  }>(),
  { followed: false, dancers: () => [] },
)

const d = computed(() => (props.competition.date ? parseDate(props.competition.date) : null))
const today = computed(() => isSameDay(props.competition.date))
const weekday = computed(() =>
  d.value ? d.value.toLocaleDateString(undefined, { weekday: 'short' }) : '',
)
</script>

<template>
  <li>
    <RouterLink
      :to="to"
      class="bg-card flex min-h-16 items-center gap-3 px-3 py-2.5 hover:bg-accent"
    >
      <span
        :class="[
          'flex w-12 shrink-0 flex-col items-center rounded-xl py-1 leading-none',
          today ? 'bg-live-paper' : 'bg-muted',
        ]"
      >
        <template v-if="d">
          <span class="text-live text-[0.6875rem] font-extrabold uppercase">{{
            formatMonthAbbrev(d)
          }}</span>
          <span class="text-xl font-extrabold tabular-nums">{{ d.getDate() }}</span>
          <span class="text-muted-foreground text-[0.6875rem] font-bold">{{ weekday }}</span>
        </template>
        <span v-else class="text-muted-foreground py-2 text-xs font-bold">TBA</span>
      </span>
      <span class="min-w-0 flex-1">
        <span class="line-clamp-2 text-base leading-snug font-bold">
          {{ competition.name ?? 'Competition' }}
        </span>
        <span v-if="competition.location" class="text-muted-foreground block truncate text-sm">
          {{ competition.location }}
        </span>
        <span v-if="today || followed || dancers.length" class="mt-1 flex flex-wrap gap-1.5">
          <span
            v-if="today"
            class="bg-live-paper text-live inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-bold"
          >
            <span class="bg-live size-2 animate-[live-pulse_2s_infinite] rounded-full" />
            Today
          </span>
          <span
            v-if="dancers.length"
            class="bg-done text-done-foreground inline-flex min-h-6 items-center gap-1 rounded-lg px-2 py-0.5 text-xs leading-tight font-bold"
          >
            <Star class="size-3 shrink-0 fill-current" />
            {{ dancers.join(', ') }}
          </span>
          <span
            v-else-if="followed"
            class="bg-blue-paper text-ribbon-foreground inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-bold"
          >
            <Star class="size-3 fill-current" />
            Following
          </span>
        </span>
      </span>
      <ChevronRight class="text-muted-foreground size-5 shrink-0" />
    </RouterLink>
  </li>
</template>
