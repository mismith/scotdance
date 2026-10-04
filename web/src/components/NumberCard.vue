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
    size?: 'xs' | 'sm' | 'md' | 'lg'
  }>(),
  { color: null, size: 'sm' },
)

// In long lists a plain tile reads calmer; the coloured band marks your
// dancers, and the big sizes keep the full competitor-card look.
const banded = computed(() => !!props.color || props.size === 'md' || props.size === 'lg')
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
    ]"
    :style="{ '--dc': color ?? 'var(--strong)' }"
    :aria-label="number != null ? `Number ${number}` : 'No number'"
  >
    <span v-if="banded" :class="['sash absolute inset-x-0 top-0', size === 'xs' ? 'h-1.5' : 'h-[24%]']" aria-hidden="true" />
    <!-- The safety pins. -->
    <span
      v-if="banded && size !== 'xs'"
      class="absolute inset-0"
      aria-hidden="true"
    >
      <span
        :class="[
          'absolute rotate-[-24deg] rounded-full bg-linear-to-b from-[#f4f6f8] to-[#9aa3ad] shadow-[0_0_0_0.5px_rgb(0_0_0/0.35)]',
          size === 'lg' ? 'top-2 left-3 h-1.5 w-6' : 'top-1 left-1.5 h-[3px] w-3',
        ]"
      />
      <span
        :class="[
          'absolute rotate-[24deg] rounded-full bg-linear-to-b from-[#f4f6f8] to-[#9aa3ad] shadow-[0_0_0_0.5px_rgb(0_0_0/0.35)]',
          size === 'lg' ? 'top-2 right-3 h-1.5 w-6' : 'top-1 right-1.5 h-[3px] w-3',
        ]"
      />
    </span>
    <span class="relative leading-none">{{ number ?? '–' }}</span>
  </span>
</template>
