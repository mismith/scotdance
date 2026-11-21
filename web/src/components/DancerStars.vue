<script setup lang="ts">
import { Star } from '@lucide/vue'
import { solidOf } from '@/lib/tartan'

// The app's one mark for "yours": a filled star in each of your dancers'
// colours, overlapping when there are several (up to `max`, then a count).
// When they overlap, a hairline in the page's colour keeps them apart; one
// on its own has no edge. (A tartan's star
// is its first colour: cloth doesn't read this small.)
const props = withDefaults(defineProps<{ colors: Array<string | null>; max?: number }>(), { max: 3 })
const fill = (c: string | null) => solidOf(c) ?? 'var(--primary)'
</script>

<template>
  <span class="flex shrink-0 items-center" aria-hidden="true">
    <span class="flex -space-x-1.5">
      <Star
        v-for="(c, i) in props.colors.slice(0, max)"
        :key="i"
        class="size-4"
        :style="{ fill: fill(c), stroke: colors.length > 1 ? 'var(--background)' : fill(c) }"
        :stroke-width="colors.length > 1 ? 1.25 : 1"
        stroke-linejoin="round"
      />
    </span>
    <span v-if="colors.length > max" class="text-muted-foreground text-footnote ml-0.5 font-semibold tabular-nums">+{{ colors.length - max }}</span>
  </span>
</template>
