<script setup lang="ts">
import Medal from '@/components/Medal.vue'
import type { DanceRow } from '@/lib/danceResults'
import { seasonLabel } from '@/lib/dancerProgress'

// One dance in By dance: its name and how often it was danced, then a line
// per season, newest first, with the placings in the order they happened
// (a quiet dot where they danced and weren't placed). `trophy`: Overall,
// drawn as the cup.
defineProps<{ row: DanceRow; trophy?: boolean }>()

const tip = (m: { rawName: string; competitionName: string }) => `${m.rawName.trim()} · ${m.competitionName}`
</script>

<template>
  <section class="px-4 py-3">
    <div class="flex items-baseline justify-between gap-3">
      <h3 class="text-heading min-w-0">{{ row.name }}</h3>
      <span v-if="!trophy" class="text-muted-foreground shrink-0 text-sm tabular-nums">
        Danced {{ row.count }} time{{ row.count === 1 ? '' : 's' }}
      </span>
    </div>
    <p v-if="row.aka.length" class="text-muted-foreground mt-0.5 text-sm [overflow-wrap:anywhere]">Also listed as {{ row.aka.join(', ') }}</p>
    <!-- More room between seasons than between wrapped rows; the season sits level
         with the first row of marks, so a wrapped row never leaves it ambiguous. -->
    <div class="mt-2 space-y-3">
      <div v-for="y in [...row.years].reverse()" :key="y.year" class="grid grid-cols-[4.75rem_1fr] items-start gap-2">
        <span class="text-muted-foreground h-12 text-sm leading-[3rem] font-bold whitespace-nowrap tabular-nums">{{ seasonLabel(y.year) }}</span>
        <div class="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1.5">
          <template v-for="(m, i) in y.marks" :key="`${m.competitionId}:${m.entryId}:${i}`">
            <Medal v-if="m.place != null" :place="m.place" :tied="m.tied" :dance="tip(m)" :trophy="trophy" />
            <Medal v-else :place="null" missed :dance="tip(m)" />
          </template>
        </div>
      </div>
    </div>
  </section>
</template>
