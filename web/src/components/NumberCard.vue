<script setup lang="ts">
import { computed } from 'vue'
import { clothInk, isCloth } from '@/lib/tartan'
import { inkOnLook } from '@/stores/dancerColors'

// The competitor number card: white paper, bold number, a band in the
// dancer's look (a colour or their tartan), two safety pins. It shows the
// number for ONE competition entry. A dancer has a different number at every
// competition, so this is only ever shown in a competition's context, never
// as someone's identity.
const props = withDefaults(
  defineProps<{
    number: number | string | null | undefined
    color?: string | null
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  { color: null, size: 'sm' },
)

// In long lists a plain tile reads calmer; the coloured band marks your
// dancers, and the big sizes keep the full competitor-card look.
const banded = computed(() => !!props.color || props.size === 'md' || props.size === 'lg' || props.size === 'xl')

// The pins take the band's ink, softened: white on dark colours and cloth,
// dark on light ones (a white-ground tartan, a pale colour of your own).
const pinInk = computed(() => {
  const c = props.color
  const ink = !c ? '#ffffff' : isCloth(c) ? clothInk(c).ink : (inkOnLook(c) ?? '#ffffff')
  return `color-mix(in oklab, ${ink} 60%, transparent)`
})
</script>

<template>
  <span
    :class="[
      'bg-paper text-paper-ink relative inline-flex shrink-0 justify-center overflow-hidden border border-[var(--paper-edge)] font-extrabold tracking-[-0.02em] tabular-nums',
      banded ? 'items-end' : 'items-center',
      // A column of plain tiles in the dark theme would glow: a dimmer paper.
      !banded && 'dark:bg-[color-mix(in_oklab,var(--paper)_80%,var(--background))]',
      size !== 'xs' && 'shadow-[0_1px_0_rgb(0_0_0/0.05),0_2px_6px_rgb(0_0_0/0.1)]',
      size === 'xs' && ['h-8 w-11 rounded-md text-[0.9375rem]', banded && 'pb-0.5'],
      size === 'sm' && ['h-11 w-[3.75rem] rounded-md text-xl', banded && 'pb-1'],
      size === 'md' && 'h-16 w-[5.5rem] rounded-lg pb-1.5 text-[1.875rem]',
      size === 'lg' && 'h-24 w-32 rounded-xl pb-2 text-5xl',
      size === 'xl' && 'h-32 w-44 rounded-2xl pb-3 text-[4rem]',
    ]"
    :style="{ '--dc': color ?? 'var(--strong)' }"
    role="img"
    :aria-label="number != null ? `Number ${number}` : 'No number'"
  >
    <span v-if="banded" :class="['sash absolute inset-x-0 top-0', size === 'xs' ? 'h-1.5' : 'h-[24%]']" aria-hidden="true" />
    <!-- The safety pins, kept quiet so the dancer's look is the star: one soft
         stroke for the coil, the bar and an open clasp, and the point dipping
         under the card for a moment. -->
    <span v-if="banded && size !== 'xs'" class="absolute inset-0" :style="{ color: pinInk }" aria-hidden="true">
      <svg
        v-for="side in ['left', 'right']"
        :key="side"
        viewBox="0 0 44 12"
        fill="none"
        stroke="currentColor"
        stroke-width="1.15"
        stroke-linecap="round"
        stroke-linejoin="round"
        :class="[
          'absolute',
          side === 'left' ? '-rotate-10' : 'rotate-10 -scale-x-100',
          size === 'xl' ? `top-2 w-9 ${side === 'left' ? 'left-3' : 'right-3'}`
          : size === 'lg' ? `top-1.5 w-7 ${side === 'left' ? 'left-2.5' : 'right-2.5'}`
          : size === 'md' ? `top-1 w-5 ${side === 'left' ? 'left-1.5' : 'right-1.5'}`
          : `top-0.5 w-3.5 ${side === 'left' ? 'left-1' : 'right-1'}`,
        ]"
      >
        <circle cx="4.8" cy="6" r="2.4" />
        <path d="M4.8 3.6 34.5 3.7M4.8 8.4 13 8.3M26 8.1 34.5 7.8" />
        <rect x="34.5" y="2.6" width="6" height="6.6" rx="1.8" />
      </svg>
    </span>
    <!-- The number, or a caller's own rendering of it (search shows the typed digits bolder). -->
    <span class="relative leading-none"><slot>{{ number ?? '–' }}</slot></span>
  </span>
</template>
