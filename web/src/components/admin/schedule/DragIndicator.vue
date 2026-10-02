<script setup lang="ts">
// Where a dragged item will land: a line with a dot at its start. Moved by
// a transform, it glides from gap to gap.
withDefaults(defineProps<{ orientation?: 'horizontal' | 'vertical' }>(), {
  orientation: 'horizontal',
})
</script>

<template>
  <div
    :class="[
      'bg-primary-fill outline-background pointer-events-none absolute top-0 z-10 outline-1 transition-transform duration-(--dur-quick) ease-snappy motion-reduce:transition-none',
      orientation === 'vertical' ? 'w-0.5' : 'h-0.5',
    ]"
    aria-hidden="true"
  >
    <div
      :class="[
        'border-primary bg-background outline-background absolute size-2 rounded-full border-2 outline-1',
        orientation === 'vertical'
          ? 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2'
          : 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2',
      ]"
    />
  </div>
</template>
