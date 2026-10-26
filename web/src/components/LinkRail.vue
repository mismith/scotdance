<script setup lang="ts">
import type { RailPosition } from '@/lib/linked'

// The blue line through a linked group's date tiles in a list (ADR 0007
// §8), stopping 3px clear of each tile. Its row is `relative`, and the tile
// sits centred in it, 4.5rem + 2px tall (DateTile), so each piece ends half
// that plus the gap from the middle. The rows after the first drop their
// hairline (`bg-none!`).
defineProps<{ rail: RailPosition }>()
</script>

<template>
  <span
    v-if="rail === 'middle' || rail === 'last'"
    aria-hidden="true"
    class="bg-primary absolute top-0 left-9 h-[calc(50%-2.25rem-4px)] w-1"
  />
  <span
    v-if="rail === 'first' || rail === 'middle'"
    aria-hidden="true"
    class="bg-primary absolute top-[calc(50%+2.25rem+4px)] bottom-0 left-9 w-1"
  />
</template>
