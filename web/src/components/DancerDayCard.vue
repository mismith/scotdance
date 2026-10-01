<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight } from '@lucide/vue'
import NumberCard from '@/components/NumberCard.vue'
import DanceStatusChip from '@/components/DanceStatusChip.vue'
import { getOrdinalSuffix } from '@/lib/results'
import { platformLabel } from '@/lib/schedule'
import type { DancerDay, DanceStatus } from '@/lib/dancerDay'

// One followed dancer at one competition: their number card for that
// competition, and every dance with its state. A dancer can be entered in
// more than one age group (e.g. Premier plus a Broadsword event); those are
// grouped in one card under the same number. The header opens the dancer's
// page; each dance row opens that age group's results.
const props = withDefaults(
  defineProps<{
    days: DancerDay[]
    competitionId: string
    color?: string | null
    /** Shown under the name on Home, where several competitions mix. */
    competitionName?: string | null
    /** `${dancerId}:${danceId}` of a placing that just arrived. */
    fresh?: string | null
  }>(),
  { color: null, competitionName: null, fresh: null },
)

// Entries with nothing scheduled are dropped when another entry has dances.
const shown = computed(() => {
  const withDances = props.days.filter((d) => d.dances.length)
  return withDances.length ? withDances : props.days.slice(0, 1)
})
const day = computed(() => shown.value[0])
const multi = computed(() => shown.value.length > 1)

const sub = computed(() => {
  const d = day.value
  const parts = [multi.value ? `${shown.value.length} age groups` : d.group?.fullName]
  const plat = d.next?.slot?.platformName ?? d.dances[0]?.slot?.platformName
  if (plat && d.phase !== 'after') parts.push(platformLabel(plat))
  return parts.filter(Boolean).join(' · ')
})

function detail(s: DanceStatus): string | null {
  const bits: string[] = []
  if (s.state === 'next' || s.state === 'upcoming') {
    if (s.drawPos) bits.push(`${s.drawPos}${getOrdinalSuffix(s.drawPos)} to dance`)
    if (s.slot?.blockTime && s.state === 'upcoming') bits.push(s.slot.blockTime)
    else if (s.slot && s.slot.groupCount > 1)
      bits.push(`group ${s.slot.groupPos} of ${s.slot.groupCount}`)
  }
  if (s.state === 'waiting') bits.push('Danced')
  return bits.join(' · ') || null
}

const groupRoute = (d: DancerDay, danceId?: string) => ({
  name: 'competition.group',
  params: { competitionId: props.competitionId, groupId: d.group?.id ?? '' },
  hash: danceId ? `#dance-${danceId}` : undefined,
})
</script>

<template>
  <article
    class="bg-card overflow-hidden rounded-2xl border shadow-sm"
    :style="{ '--dc': color ?? 'var(--strong)' }"
  >
    <div class="sash h-1.5" aria-hidden="true" />
    <RouterLink
      :to="{
        name: 'competition.dancer',
        params: { competitionId, dancerId: day.dancer.id },
      }"
      class="flex items-center gap-3 px-3 pt-3 pb-2 hover:bg-accent/50"
    >
      <NumberCard :number="day.dancer.number" :color="color" />
      <span class="min-w-0 flex-1">
        <span class="block truncate text-[1.0625rem] leading-tight font-extrabold">
          {{ day.dancer.fullName }}
        </span>
        <span class="text-muted-foreground block truncate text-sm">{{ sub }}</span>
        <span v-if="competitionName" class="text-muted-foreground block truncate text-sm">
          {{ competitionName }}
        </span>
      </span>
      <ChevronRight class="text-muted-foreground size-5 shrink-0" />
    </RouterLink>

    <template v-for="d in shown" :key="d.dancer.id">
      <p v-if="multi" class="text-muted-foreground border-t px-4 pt-2 text-[0.8125rem] font-bold">
        {{ d.group?.fullName }}
      </p>
      <ul v-if="d.dances.length" class="px-1.5 pb-1.5">
        <li
          v-if="d.calledBack != null"
          class="flex min-h-11 items-center justify-between gap-2 border-t px-2 py-1.5"
        >
          <span class="text-[0.9375rem] font-semibold">Callbacks</span>
          <span
            :class="['text-sm font-bold', d.calledBack ? 'text-done-foreground' : 'text-muted-foreground']"
          >
            {{ d.calledBack ? 'Called back' : 'Not called back' }}
          </span>
        </li>
        <li
          v-for="s in d.dances"
          :key="s.dance.id"
          :class="['border-t', multi && 'first:border-t-0']"
        >
          <RouterLink
            :to="groupRoute(d, s.dance.id)"
            class="flex min-h-11 items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-accent"
          >
            <span class="min-w-0">
              <span class="block truncate text-[0.9375rem] font-semibold">{{ s.dance.fullName || s.dance.name }}</span>
              <span v-if="detail(s)" class="text-muted-foreground block text-[0.8125rem]">{{ detail(s) }}</span>
            </span>
            <DanceStatusChip :status="s" :fresh="fresh === `${d.dancer.id}:${s.dance.id}`" />
          </RouterLink>
        </li>
        <li v-if="d.overall" class="border-t">
          <RouterLink
            :to="groupRoute(d, 'overall')"
            class="flex min-h-11 items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-accent"
          >
            <span class="text-[0.9375rem] font-bold">Overall</span>
            <DanceStatusChip
              v-if="d.overall.state !== 'later'"
              :status="d.overall"
              :fresh="fresh === `${d.dancer.id}:overall`"
            />
            <span v-else class="text-muted-foreground text-sm font-semibold">After all dances</span>
          </RouterLink>
        </li>
      </ul>
      <p v-else class="text-muted-foreground border-t px-4 py-3 text-sm">
        No dances listed for this age group yet.
      </p>
    </template>
  </article>
</template>
