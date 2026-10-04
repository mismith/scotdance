<script setup lang="ts">
import { computed } from 'vue'

// The competitor number card: white paper, bold number, a band in the
// dancer's colour, two safety pins. It shows the number for ONE competition
// entry. A dancer has a different number at every competition, so this is
// only ever shown in a competition's context, never as someone's identity.
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
    <!-- The safety pins, drawn flat: a coil, the two arms and the clasp. -->
    <span v-if="banded && size !== 'xs'" class="absolute inset-0 text-white/90" aria-hidden="true">
      <svg
        v-for="side in ['left', 'right']"
        :key="side"
        viewBox="0 0 44 12"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        :class="[
          'absolute',
          side === 'left' ? '-rotate-12' : 'rotate-12 -scale-x-100',
          size === 'xl' ? `top-2 w-12 ${side === 'left' ? 'left-3.5' : 'right-3.5'}`
          : size === 'lg' ? `top-1.5 w-9 ${side === 'left' ? 'left-2.5' : 'right-2.5'}`
          : size === 'md' ? `top-1 w-6 ${side === 'left' ? 'left-1.5' : 'right-1.5'}`
          : `top-0.5 w-4 ${side === 'left' ? 'left-1' : 'right-1'}`,
        ]"
      >
        <circle cx="5" cy="6" r="3" />
        <path d="M8 4.2H35M7.6 7.8H33" />
        <path d="M34 2.6h5.4a1.6 1.6 0 0 1 1.6 1.6v3.6a1.6 1.6 0 0 1-1.6 1.6H34z" />
      </svg>
    </span>
    <span class="relative leading-none">{{ number ?? '–' }}</span>
  </span>
</template>
