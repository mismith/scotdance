<script setup lang="ts">
import { computed } from 'vue'
import { CalendarOff } from '@lucide/vue'
import CompetitionDateRow from '@/components/CompetitionDateRow.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import { useCompetitionLinks } from '@/composables/useCompetitionLinks'
import { daysFromToday, parseDate } from '@/lib/format'
import { orderLinked, railRows, type RailPosition } from '@/lib/linked'
import type { Competition } from '@/types/competition'

// A profile's competitions as plain lists: coming up (soonest first), then
// the past a year at a time (most recent first). No filters: a person or
// venue has tens, not thousands, and scrolling is easier than a control.
// Linked competitions stay together on a rail (ADR 0007 §8).
const props = defineProps<{
  items: Array<{ competitionId: string; competition: Competition }>
  loading?: boolean
  emptyText?: string
  /** On this organisation's page: names without it (CompetitionDateRow). */
  within?: string | null
}>()

type Item = (typeof props.items)[number]
type Row = Item & { rail: RailPosition; note: string | null }

const ms = (c: Competition) => (c.date ? parseDate(c.date).getTime() : 0)
const { linkOf, othersLine } = useCompetitionLinks()
function rows(list: Item[], descending: boolean): Row[] {
  const keyed = list.map((i) => ({ ...i, id: i.competitionId, date: i.competition.date, name: i.competition.name }))
  return railRows(orderLinked(keyed, linkOf, { descending, at: (k) => ms(k.competition) })).map(({ item, rail, alone }) => ({
    competitionId: item.competitionId,
    competition: item.competition,
    rail,
    note: alone ? othersLine({ id: item.id, date: item.date, name: item.name }) : null,
  }))
}
const upcoming = computed(() => rows(props.items.filter((i) => (daysFromToday(i.competition.date) ?? 1) >= 0), false))
const years = computed(() => {
  const out = new Map<number, Item[]>()
  props.items
    .filter((i) => (daysFromToday(i.competition.date) ?? 1) < 0)
    .forEach((i) => {
      const y = parseDate(i.competition.date!).getFullYear()
      out.set(y, [...(out.get(y) ?? []), i])
    })
  return [...out.entries()].sort((a, b) => b[0] - a[0]).map(([y, list]) => [y, rows(list, true)] as const)
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
      <h2 class="text-section">Coming up</h2>
      <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
        <CompetitionDateRow
          v-for="i in upcoming"
          :key="i.competitionId"
          :competition="i.competition"
          :competition-id="i.competitionId"
          :within="within"
          :to="{ name: 'competition.info', params: { competitionId: i.competitionId } }"
          :rail="i.rail"
          :note="i.note"
        />
      </ul>
    </section>
    <section v-for="[year, list] in years" :key="year" class="space-y-2">
      <h2 class="text-section flex items-baseline justify-between">
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
          :rail="i.rail"
          :note="i.note"
        />
      </ul>
    </section>
  </template>
</template>
