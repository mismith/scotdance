<script setup lang="ts">
// The competitor number card: white paper, bold number, a tartan band in the
// dancer's colour, two safety pins. It shows the number for ONE competition
// entry. A dancer has a different number at every competition, so this is
// only ever shown in a competition's context, never as someone's identity.
withDefaults(
  defineProps<{
    number: number | string | null | undefined
    color?: string | null
    /** The dancer's tartan layer; inherited from the row when omitted. */
    sash?: string | null
    size?: 'xs' | 'sm' | 'md' | 'lg'
  }>(),
  { color: null, sash: undefined, size: 'sm' },
)
</script>

<template>
  <span
    :class="[
      'bg-paper text-paper-ink relative inline-flex shrink-0 items-end justify-center overflow-hidden border border-[var(--paper-edge)] font-extrabold tracking-[-0.02em] tabular-nums shadow-[0_1px_0_rgb(0_0_0/0.05),0_2px_6px_rgb(0_0_0/0.1)]',
      size === 'xs' && 'h-8 w-11 rounded-[5px] pb-0.5 text-[0.9375rem]',
      size === 'sm' && 'h-11 w-[3.75rem] rounded-md pb-1 text-xl',
      size === 'md' && 'h-16 w-[5.5rem] rounded-lg pb-1.5 text-[1.875rem]',
      size === 'lg' && 'h-24 w-32 rounded-xl pb-2 text-5xl',
    ]"
    :style="color ? { '--dc': color, ...(sash !== undefined && { '--sash': sash ?? 'var(--tartan)' }) } : { '--dc': 'var(--strong)', '--sash': 'var(--tartan)' }"
    :aria-label="number != null ? `Number ${number}` : 'No number'"
  >
    <span class="sash absolute inset-x-0 top-0 h-[24%]" aria-hidden="true" />
    <span
      v-if="size !== 'xs'"
      :class="[
        'absolute rotate-[-24deg] rounded-full bg-linear-to-b from-[#f4f6f8] to-[#9aa3ad] shadow-[0_0_0_0.5px_rgb(0_0_0/0.35)]',
        size === 'lg' ? 'top-2 left-3 h-1.5 w-6' : 'top-1 left-1.5 h-[3px] w-3',
      ]"
      aria-hidden="true"
    />
    <span
      v-if="size !== 'xs'"
      :class="[
        'absolute rotate-[24deg] rounded-full bg-linear-to-b from-[#f4f6f8] to-[#9aa3ad] shadow-[0_0_0_0.5px_rgb(0_0_0/0.35)]',
        size === 'lg' ? 'top-2 right-3 h-1.5 w-6' : 'top-1 right-1.5 h-[3px] w-3',
      ]"
      aria-hidden="true"
    />
    <span class="relative leading-none">{{ number ?? '–' }}</span>
  </span>
</template>
