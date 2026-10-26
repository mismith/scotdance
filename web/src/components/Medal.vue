<script setup lang="ts">
import { computed } from 'vue'
import { getOrdinalSuffix } from '@/lib/results'

// A placing as a ribbon: one colour for every place (Highland dancing has no
// gold/silver/bronze), the number big inside it, and a "Tie" tag pinned across
// its foot. Its own shape, so it never reads as a bib number or an avatar.
const props = withDefaults(
  defineProps<{
    place: number | null
    tied?: boolean
    pointed?: boolean
    size?: 'sm' | 'md' | 'lg'
    /** Plays the arrival flip (a placing just came in). */
    fresh?: boolean
    /** The dance it's for, so the label says "Highland Fling: 1st place". */
    dance?: string | null
  }>(),
  { tied: false, pointed: false, size: 'md', fresh: false },
)

// A little weight for the top placings without medal colours: the blue gets
// lighter down the order. Every tier has the same engraved edge; on 1st's
// solid blue it's a lit one.
const TIERS = {
  1: { fill: 'fill-primary-fill', edge: 'stroke-white/25', ink: 'text-primary-foreground' },
  2: { fill: 'fill-[color-mix(in_oklab,var(--primary)_28%,var(--card))]', edge: 'stroke-primary/40', ink: 'text-primary' },
  3: { fill: 'fill-[color-mix(in_oklab,var(--primary)_16%,var(--card))]', edge: 'stroke-primary/40', ink: 'text-primary' },
  rest: { fill: 'fill-[color-mix(in_oklab,var(--primary)_6%,var(--card))]', edge: 'stroke-primary/40', ink: 'text-primary' },
}
const tier = computed(() => TIERS[props.place === 1 || props.place === 2 || props.place === 3 ? props.place : 'rest'])

const label = computed(() => {
  const what = props.place == null
    ? props.pointed ? 'Championship point' : 'Not placed'
    : `${props.place}${getOrdinalSuffix(props.place)} place${props.tied ? ', tied' : ''}`
  return props.dance ? `${props.dance}: ${what}` : what
})
</script>

<template>
  <span
    v-if="place != null"
    role="img"
    :aria-label="label"
    :class="[
      'relative inline-flex shrink-0',
      size === 'lg' ? 'h-[3.25rem] w-12 text-[1.5rem]' : size === 'md' ? 'h-12 w-11 text-[1.25rem]' : 'h-10 w-9 text-[1.0625rem]',
      fresh && 'animate-medal motion-reduce:animate-none',
    ]"
  >
    <!-- Square shoulders would read as a bib; a V-cut foot reads as a ribbon. -->
    <svg viewBox="0 0 44 48" preserveAspectRatio="none" class="absolute inset-0 size-full" aria-hidden="true">
      <path d="M0 9a9 9 0 0 1 9-9h26a9 9 0 0 1 9 9v39l-22-8-22 8z" :class="tier.fill" />
      <path
        d="M.75 9a8.25 8.25 0 0 1 8.25-8.25h26a8.25 8.25 0 0 1 8.25 8.25v37.9l-21.25-7.7-21.25 7.7z"
        fill="none"
        stroke-width="1.5"
        stroke-linejoin="round"
        :class="tier.edge"
      />
    </svg>
    <!-- Centred above the V, where the ribbon's body is. -->
    <span
      :class="['relative flex h-[83%] w-full items-center justify-center leading-none font-extrabold tracking-[-0.02em] tabular-nums', tier.ink]"
      aria-hidden="true"
    >
      <span>{{ place }}<span class="ml-[0.04em] align-[0.75em] text-[0.5em] font-bold">{{ getOrdinalSuffix(place) }}</span></span>
    </span>
    <span
      v-if="tied"
      class="bg-primary-fill text-primary-foreground absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[0.6875rem] leading-[1.15rem] font-extrabold tracking-[0.06em] uppercase shadow-[0_0_0_2px_var(--background),0_2px_4px_rgb(16_24_40/0.2)]"
      aria-hidden="true"
    >
      Tie
    </span>
  </span>
  <!-- Blue like the placings: amber is reserved for up next. -->
  <span
    v-else-if="pointed"
    :class="[
      'bg-blue-paper text-primary inline-flex shrink-0 items-center justify-center rounded-lg font-semibold',
      size === 'sm' ? 'h-6 px-1.5 text-xs' : 'h-8 px-2 text-sm',
    ]"
    :aria-label="label"
  >
    Point
  </span>
</template>
