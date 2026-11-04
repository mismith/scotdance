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
    /** Overall: a trophy (what an age group's winner takes home), so it never
     *  passes for one more dance. Same box and number spot as the ribbon. */
    trophy?: boolean
  }>(),
  { tied: false, pointed: false, size: 'md', fresh: false, trophy: false },
)

// A little weight for the top placings without medal colours: the blue gets
// lighter down the order. Every tier has the same engraved edge; on 1st's
// solid blue it's a lit one. A trophy's handles, stem and base are a deeper
// blue than its cup, so the shape holds on the palest tiers.
const TIERS = {
  1: { fill: 'fill-primary-fill', edge: 'stroke-white/25', ink: 'text-primary-foreground', metal: 'fill-primary-fill stroke-primary-fill' },
  2: { fill: 'fill-[color-mix(in_oklab,var(--primary)_28%,var(--card))]', edge: 'stroke-primary/40', ink: 'text-primary', metal: 'fill-[color-mix(in_oklab,var(--primary)_50%,var(--card))] stroke-[color-mix(in_oklab,var(--primary)_50%,var(--card))]' },
  3: { fill: 'fill-[color-mix(in_oklab,var(--primary)_16%,var(--card))]', edge: 'stroke-primary/40', ink: 'text-primary', metal: 'fill-[color-mix(in_oklab,var(--primary)_45%,var(--card))] stroke-[color-mix(in_oklab,var(--primary)_45%,var(--card))]' },
  rest: { fill: 'fill-[color-mix(in_oklab,var(--primary)_6%,var(--card))]', edge: 'stroke-primary/40', ink: 'text-primary', metal: 'fill-[color-mix(in_oklab,var(--primary)_40%,var(--card))] stroke-[color-mix(in_oklab,var(--primary)_40%,var(--card))]' },
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
      'group/medal relative inline-flex shrink-0',
      size === 'lg' ? 'h-[3.25rem] w-12 text-[1.5rem]' : size === 'md' ? 'h-12 w-11 text-[1.25rem]' : 'h-10 w-9 text-[1.0625rem]',
      fresh && 'animate-medal motion-reduce:animate-none',
    ]"
  >
    <!-- A wide cup: the number sits where the ribbon's does, mid-bowl (a low
         rim and a deep bowl, so as much cup below the number as above). -->
    <svg v-if="trophy" viewBox="0 0 44 48" preserveAspectRatio="none" class="absolute inset-0 size-full" aria-hidden="true">
      <path d="M6 7H4a2.5 2.5 0 0 0-2.5 2.5V11a9 9 0 0 0 5.5 8.3M38 7h2a2.5 2.5 0 0 1 2.5 2.5V11a9 9 0 0 1-5.5 8.3" fill="none" stroke-width="3" stroke-linecap="round" :class="tier.metal" />
      <path d="M19.5 38h5v5h-5zM11 42h22a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z" stroke="none" :class="tier.metal" />
      <path d="M6 3h32v15c0 11.6-7.2 21-16 21S6 29.6 6 18z" :class="tier.fill" />
      <path d="M6.75 3.75h30.5V18c0 11.2-6.9 20.25-15.25 20.25S6.75 29.2 6.75 18z" fill="none" stroke-width="1.5" stroke-linejoin="round" :class="tier.edge" />
    </svg>
    <!-- Square shoulders would read as a bib; a V-cut foot reads as a ribbon. -->
    <svg v-else viewBox="0 0 44 48" preserveAspectRatio="none" class="absolute inset-0 size-full" aria-hidden="true">
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
    <!-- Where there's a pointer, hovering names the dance (on touch, a tap
         opens their day, which lists every dance). Below, clear of the Tie
         tag, with a tick pointing back up at it: the top half of a turned
         square, so it carries the bubble's hairline edge onto the dark page. -->
    <span
      v-if="dance"
      class="hud pointer-events-none invisible absolute top-full left-1/2 z-20 mt-3.5 -translate-x-1/2 rounded-xl px-3 py-2 text-sm leading-tight font-semibold tracking-normal whitespace-nowrap group-hover/medal:visible before:absolute before:-top-1.25 before:left-1/2 before:size-2.5 before:-translate-x-1/2 before:rotate-45 before:rounded-tl-[2px] before:border-t-[0.5px] before:border-l-[0.5px] before:border-white/20 before:bg-[rgb(27_33_40/0.92)] before:[clip-path:polygon(0_0,100%_0,0_100%)] before:content-['']"
      aria-hidden="true"
    >
      {{ label }}
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
