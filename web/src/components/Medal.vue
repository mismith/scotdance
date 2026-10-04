<script setup lang="ts">
import { computed } from 'vue'
import { getOrdinalSuffix } from '@/lib/results'

// A placing as a rosette: one colour for every place (Highland dancing has no
// gold/silver/bronze), "4th" inside and a "Tie" band across the ribbons for
// a tie. Its own shape so it never reads as a bib number.
const props = withDefaults(
  defineProps<{
    place: number | null
    tied?: boolean
    pointed?: boolean
    size?: 'sm' | 'md'
    /** Plays the arrival flip (a placing just came in). */
    fresh?: boolean
    /** The dance it's for, so the label says "Highland Fling: 1st place". */
    dance?: string | null
  }>(),
  { tied: false, pointed: false, size: 'md', fresh: false },
)

const suffix = computed(() => getOrdinalSuffix(props.place ?? 0))
// Shrink longer labels ("12th") so they stay inside the rosette.
const fontSize = computed(() => {
  const len = String(props.place).length + suffix.value.length * 0.6
  return len <= 2.2 ? 14 : len <= 3.2 ? 12 : 10
})

// A little weight for the top placings without medal colours. Every tier is
// blue ink on a blue tint (readable in light and dark); higher places get a
// stronger tint, a heavier outline and bolder ribbons, and 1st a halo.
const TIERS = {
  1: { body: 'fill-[color-mix(in_oklab,var(--color-primary)_18%,var(--color-card))]', ring: 2.5, tails: 1, halo: true },
  2: { body: 'fill-[color-mix(in_oklab,var(--color-primary)_14%,var(--color-card))]', ring: 2, tails: 1, halo: false },
  3: { body: 'fill-[color-mix(in_oklab,var(--color-primary)_10%,var(--color-card))]', ring: 1.25, tails: 0.6, halo: false },
  rest: { body: 'fill-[color-mix(in_oklab,var(--color-primary)_6%,var(--color-card))]', ring: 0.75, tails: 0.3, halo: false },
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
  <svg
    v-if="place != null"
    viewBox="0 0 34 40"
    role="img"
    :aria-label="label"
    :class="[
      'text-primary shrink-0 overflow-visible',
      size === 'md' ? 'h-10 w-[2.125rem]' : 'h-8 w-[1.7rem]',
      fresh && 'animate-medal motion-reduce:animate-none',
    ]"
  >
    <title>{{ label }}</title>
    <path d="M11 22 L7 39 L13 35 L16 39 L17 24 Z M23 22 L27 39 L21 35 L18 39 L17 24 Z" fill="currentColor" :opacity="tier.tails" />
    <circle v-if="tier.halo" cx="17" cy="15" r="17" fill="currentColor" opacity=".2" />
    <circle cx="17" cy="15" :r="14 - tier.ring / 2" :class="tier.body" stroke="currentColor" :stroke-width="tier.ring" />
    <circle cx="17" cy="15" r="10" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-dasharray="2 2" />
    <text
      x="17"
      y="15"
      text-anchor="middle"
      dominant-baseline="central"
      :font-size="fontSize"
      class="fill-primary font-extrabold tabular-nums"
    >
      {{ place }}<tspan font-size=".6em" dy="-.45em">{{ suffix }}</tspan>
    </text>
    <g v-if="tied">
      <rect x="1" y="26.5" width="32" height="13" rx="3" class="fill-card stroke-primary" stroke-width="1.5" />
      <text x="17" y="33.25" text-anchor="middle" dominant-baseline="central" font-size="10" class="fill-primary font-extrabold uppercase">
        Tie
      </text>
    </g>
  </svg>
  <!-- Blue like the rosettes: amber is reserved for up next. -->
  <span
    v-else-if="pointed"
    :class="[
      'bg-blue-paper text-primary inline-flex shrink-0 items-center justify-center rounded-lg font-semibold',
      size === 'md' ? 'h-8 px-2 text-sm' : 'h-6 px-1.5 text-xs',
    ]"
    :aria-label="label"
  >
    Point
  </span>
</template>
