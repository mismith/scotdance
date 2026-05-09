<script setup lang="ts">
import { computed } from 'vue'
import { formatRelative, isSameDay } from '@/lib/format'
import type { CompetitionListItem } from '@/composables/useCompetitions'

const props = defineProps<{
  competition: CompetitionListItem
}>()

const live = computed(() => isSameDay(props.competition.date))
const mark = computed(
  () => (props.competition.name ?? '').trim().charAt(0).toUpperCase() || '?',
)
const kicker = computed(() => {
  if (live.value) return 'Happening now'
  if (props.competition.date) return `Next up · ${formatRelative(props.competition.date)}`
  return 'Upcoming'
})
const meta = computed(() => {
  const c = props.competition
  if (live.value) return c.location ?? null
  if (c.date) {
    const date = new Date(c.date)
    const formatted = date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    return [formatted, c.location].filter(Boolean).join(' · ')
  }
  return c.location ?? null
})
</script>

<template>
  <RouterLink
    :to="{ name: 'competition.info', params: { competitionId: competition.id } }"
    class="bg-card relative block overflow-hidden rounded-2xl shadow-sm hover:shadow-md transition-shadow"
  >
    <div
      class="from-primary relative h-32 overflow-hidden text-white"
      style="
        background-image: linear-gradient(
          135deg,
          color-mix(in oklch, var(--primary) 75%, black) 0%,
          var(--primary) 100%
        );
      "
    >
      <span
        aria-hidden="true"
        class="font-serif pointer-events-none absolute -right-6 -top-4 select-none font-medium leading-none text-white/10"
        style="font-size: 12rem; letter-spacing: -0.5rem"
      >
        {{ mark }}
      </span>
      <div
        class="absolute inset-0"
        style="
          background-image: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.1) 0%,
            transparent 30%,
            rgba(0, 0, 0, 0.5) 100%
          );
        "
      />
      <div
        v-if="live"
        class="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2 py-1 backdrop-blur-md"
      >
        <span class="size-1.5 rounded-full bg-white animate-pulse" />
        <span class="font-bold tracking-widest">RESULTS UPDATING</span>
      </div>
      <div class="absolute bottom-3 left-4 right-4">
        <div class="text-xs font-medium tracking-[0.18em] uppercase opacity-90">
          {{ kicker }}
        </div>
        <div
          class="font-serif mt-1 text-2xl font-medium leading-tight tracking-tight line-clamp-2"
        >
          {{ competition.name ?? 'Competition' }}
        </div>
        <div v-if="meta" class="mt-1 opacity-80">{{ meta }}</div>
      </div>
    </div>
  </RouterLink>
</template>
