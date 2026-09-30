<script setup lang="ts">
import { computed } from 'vue'
import { getOrdinalSuffix } from '@/lib/results'

// A placing as an object: 1st–3rd are medals, 4th–6th ribbons, anything
// lower plain. Shape, colour and the word all carry the meaning.
const props = withDefaults(
  defineProps<{
    place: number | null
    tied?: boolean
    pointed?: boolean
    size?: 'sm' | 'md'
    /** Plays the arrival flip (a placing just came in). */
    fresh?: boolean
  }>(),
  { tied: false, pointed: false, size: 'md', fresh: false },
)

const tone = computed(() => {
  const p = props.place
  if (p === 1) return 'bg-gold text-medal-ink shadow-[inset_0_0_0_1.5px_rgb(0_0_0/0.18)]'
  if (p === 2) return 'bg-silver text-medal-ink shadow-[inset_0_0_0_1.5px_rgb(0_0_0/0.14)]'
  if (p === 3) return 'bg-bronze text-medal-ink shadow-[inset_0_0_0_1.5px_rgb(0_0_0/0.16)]'
  if (p != null && p <= 6) return 'bg-ribbon text-ribbon-foreground'
  return 'bg-muted text-foreground'
})

const label = computed(() => {
  if (props.place == null) return props.pointed ? 'Championship point' : 'Not placed'
  return `${props.place}${getOrdinalSuffix(props.place)} place${props.tied ? ', tied' : ''}`
})
</script>

<template>
  <span
    v-if="place != null"
    :class="[
      'inline-flex shrink-0 items-center justify-center rounded-lg font-extrabold tabular-nums',
      size === 'md' ? 'h-8 min-w-12 px-2 text-base' : 'h-6 min-w-9 px-1.5 text-[0.8125rem]',
      tone,
      fresh && 'animate-medal motion-reduce:animate-none',
    ]"
    :title="label"
    :aria-label="label"
  >
    {{ place }}<sup class="ml-px text-[0.62em]">{{ getOrdinalSuffix(place) }}</sup>
    <span v-if="tied" class="ml-1 text-[0.7em] font-bold opacity-80">tie</span>
  </span>
  <span
    v-else-if="pointed"
    :class="[
      'bg-next text-next-foreground inline-flex shrink-0 items-center justify-center rounded-lg font-bold',
      size === 'md' ? 'h-8 px-2 text-sm' : 'h-6 px-1.5 text-xs',
    ]"
    :aria-label="label"
  >
    Point
  </span>
</template>
