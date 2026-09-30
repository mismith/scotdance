<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight } from '@lucide/vue'
import Medal from '@/components/Medal.vue'
import NumberCard from '@/components/NumberCard.vue'
import { bestPlacing } from '@/lib/dancerDay'
import { formatShortDate } from '@/lib/format'
import type { DancerCard } from '@/composables/useDancerCards'

// One line per followed dancer, for people following many (a teacher's
// class): number at the relevant competition, name, and one status line.
const props = defineProps<{ card: DancerCard; color: string | null }>()

const f = computed(() => props.card.focus)
const day = computed(() => f.value?.days.find((d) => d.dances.length) ?? f.value?.days[0] ?? null)
const best = computed(() => {
  const all = (f.value?.days ?? []).map(bestPlacing).filter((b): b is NonNullable<typeof b> => !!b)
  return all.sort((a, b) => (a.place ?? 99) - (b.place ?? 99))[0] ?? null
})

const line = computed(() => {
  const focus = f.value
  const d = day.value
  if (!focus) return 'Not entered in any listed competitions'
  if (focus.phase === 'before')
    return `${focus.competition.name}${focus.competition.date ? ` · ${formatShortDate(focus.competition.date)}` : ''}`
  if (focus.phase === 'today' && d?.next) {
    const plat = d.next.slot?.platformName
    return `Next: ${d.next.dance.fullName || d.next.dance.name}${plat ? ` · Platform ${plat}` : ''}`
  }
  if (focus.phase === 'today' && d?.dances.some((s) => s.state === 'waiting')) return 'Waiting for results'
  if (focus.phase === 'today') return d?.group?.fullName ?? 'Today'
  return `Last: ${focus.competition.name}`
})

const to = computed(() =>
  f.value && day.value
    ? { name: 'competition.dancer', params: { competitionId: f.value.competitionId, dancerId: day.value.dancer.id } }
    : { name: 'dancer.info', params: { dancerId: props.card.id } },
)
</script>

<template>
  <li>
    <RouterLink :to="to" class="relative flex min-h-14 items-center gap-3 py-2 pr-2 pl-4 hover:bg-accent" :style="{ '--dc': color ?? 'var(--strong)' }">
      <span class="sash absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
      <NumberCard v-if="day" :number="day.dancer.number" size="xs" :color="color" />
      <span class="min-w-0 flex-1">
        <span class="block truncate text-base font-bold">{{ card.name }}</span>
        <span :class="['block truncate text-sm', f?.phase === 'today' && day?.next ? 'text-next-foreground font-bold' : 'text-muted-foreground']">
          {{ line }}
        </span>
      </span>
      <Medal v-if="best && f?.phase !== 'before'" :place="best.place" size="sm" />
      <ChevronRight class="text-muted-foreground size-5 shrink-0" />
    </RouterLink>
  </li>
</template>
