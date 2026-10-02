<script setup lang="ts">
// A competitor's number in results entry: a plain paper tile, as the number
// card is in long lists. A "?" stands in for a number that was missed.
defineProps<{ num?: string | null; unknown?: boolean }>()
</script>

<template>
  <span
    :class="[
      'inline-flex h-9 min-w-12 shrink-0 items-center justify-center rounded-md px-1.5 text-base font-extrabold tracking-[-0.02em] tabular-nums',
      unknown
        ? 'bg-next text-next-foreground border-[1.5px] border-dashed border-[color-mix(in_oklab,var(--next-foreground)_55%,transparent)]'
        : 'bg-paper text-paper-ink border border-(--paper-edge)',
    ]"
  >
    {{ unknown ? '?' : num || '–' }}
  </span>
</template>
