<script setup lang="ts">
import { computed } from 'vue'
import { CalendarOff } from '@lucide/vue'
import CompetitionDateRow from '@/components/CompetitionDateRow.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import { daysFromToday, parseDate } from '@/lib/format'
import type { Competition } from '@/types/competition'

// A profile's competitions as plain lists: coming up (soonest first), then
// the past a year at a time (most recent first). No filters: a person or
// venue has tens, not thousands, and scrolling is easier than a control.
const props = defineProps<{
  items: Array<{ competitionId: string; competition: Competition }>
  loading?: boolean
  emptyText?: string
  /** On this organisation's page: names without it (CompetitionDateRow). */
  within?: string | null
}>()

const ms = (c: Competition) => (c.date ? parseDate(c.date).getTime() : 0)
const upcoming = computed(() =>
  props.items
    .filter((i) => (daysFromToday(i.competition.date) ?? 1) >= 0)
    .sort((a, b) => ms(a.competition) - ms(b.competition)),
)
const years = computed(() => {
  const out = new Map<number, typeof props.items>()
  props.items
    .filter((i) => (daysFromToday(i.competition.date) ?? 1) < 0)
    .sort((a, b) => ms(b.competition) - ms(a.competition))
    .forEach((i) => {
      const y = parseDate(i.competition.date!).getFullYear()
      out.set(y, [...(out.get(y) ?? []), i])
    })
  return [...out.entries()]
})
</script>

<template>
  <div v-if="loading && !items.length" class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]" aria-busy="true">
    <span class="sr-only">Loading competitions…</span>
    <div v-for="i in 3" :key="i" class="flex min-h-16 items-center gap-3 py-2.5 pr-3 pl-4">
      <Skeleton class="h-14 w-11 shrink-0 rounded-xl!" />
      <div class="flex-1 space-y-2">
        <Skeleton class="h-4 w-3/4" />
        <Skeleton class="h-3.5 w-1/3" />
      </div>
    </div>
  </div>
  <EmptyState v-else-if="!items.length" size="inline" :icon="CalendarOff" :title="emptyText ?? 'No competitions on record yet.'" />
  <template v-else>
    <section v-if="upcoming.length" class="space-y-2">
      <h2 class="text-heading">Coming up</h2>
      <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
        <CompetitionDateRow
          v-for="i in upcoming"
          :key="i.competitionId"
          :competition="i.competition"
          :competition-id="i.competitionId"
          :within="within"
          :to="{ name: 'competition.info', params: { competitionId: i.competitionId } }"
        />
      </ul>
    </section>
    <section v-for="[year, list] in years" :key="year" class="space-y-2">
      <h2 class="text-heading flex items-baseline justify-between">
        {{ year }} <span class="text-muted-foreground text-sm font-normal tabular-nums">{{ list.length }}</span>
      </h2>
      <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
        <CompetitionDateRow
          v-for="i in list"
          :key="i.competitionId"
          :competition="i.competition"
          :competition-id="i.competitionId"
          :within="within"
          :to="{ name: 'competition.info', params: { competitionId: i.competitionId } }"
        />
      </ul>
    </section>
  </template>
</template>
