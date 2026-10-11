<script setup lang="ts">
import type { RailPosition } from '@/lib/linked'

// The blue line through a linked group's date tiles in a list (ADR 0007
// §8). Its row is `relative`, its tile carries `ring-card ring-3` to sit
// clear of it, and the rows after the first drop their separator.
defineProps<{ rail: RailPosition }>()
</script>

<template>
  <span
    v-if="rail"
    aria-hidden="true"
    :class="['bg-primary absolute left-9 w-1', rail === 'first' ? 'top-1/2 bottom-0' : rail === 'last' ? 'top-0 h-1/2' : 'inset-y-0']"
  />
</template>
