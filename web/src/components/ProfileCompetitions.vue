<script setup lang="ts">
import { computed } from 'vue'
import CompetitionDateRow from '@/components/CompetitionDateRow.vue'
import { daysFromToday, parseDate } from '@/lib/format'
import type { Competition } from '@/types/competition'

// A profile's competitions as two plain lists: coming up (soonest first) and
// past (most recent first). No filters: a person or venue has tens, not
// thousands, and scrolling is easier than a control.
const props = defineProps<{
  items: Array<{ competitionId: string; competition: Competition }>
  loading?: boolean
  emptyText?: string
}>()

const ms = (c: Competition) => (c.date ? parseDate(c.date).getTime() : 0)
const upcoming = computed(() =>
  props.items
    .filter((i) => (daysFromToday(i.competition.date) ?? 1) >= 0)
    .sort((a, b) => ms(a.competition) - ms(b.competition)),
)
const past = computed(() =>
  props.items
    .filter((i) => (daysFromToday(i.competition.date) ?? 1) < 0)
    .sort((a, b) => ms(b.competition) - ms(a.competition)),
)
</script>

<template>
  <p v-if="loading && !items.length" class="text-muted-foreground text-base">Loading…</p>
  <p v-else-if="!items.length" class="text-muted-foreground text-base">{{ emptyText ?? 'No competitions on record yet.' }}</p>
  <template v-else>
    <section v-if="upcoming.length" class="space-y-2">
      <h2 class="text-heading pt-1">Coming up</h2>
      <ul class="divide-y overflow-hidden rounded-2xl border shadow-sm">
        <CompetitionDateRow
          v-for="i in upcoming"
          :key="i.competitionId"
          :competition="i.competition"
          :competition-id="i.competitionId"
          :to="{ name: 'competition.info', params: { competitionId: i.competitionId } }"
        />
      </ul>
    </section>
    <section v-if="past.length" class="space-y-2">
      <h2 class="text-heading flex items-baseline justify-between pt-1">
        Past competitions <span class="text-muted-foreground text-sm font-semibold">{{ past.length }}</span>
      </h2>
      <ul class="divide-y overflow-hidden rounded-2xl border shadow-sm">
        <CompetitionDateRow
          v-for="i in past"
          :key="i.competitionId"
          :competition="i.competition"
          :competition-id="i.competitionId"
          :to="{ name: 'competition.info', params: { competitionId: i.competitionId } }"
        />
      </ul>
    </section>
  </template>
</template>
