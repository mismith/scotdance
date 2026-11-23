<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { ChevronRight } from '@lucide/vue'
import DancerStars from '@/components/DancerStars.vue'
import { dancersLabel } from '@/lib/dancersLabel'
import { solidOf } from '@/lib/tartan'

// Your dancers in something (a competition, an event, an age group), as a
// pill tucked under its name: a star each, their names while there are one
// or two ("Isla and Skye"), otherwise "Your 5 dancers", on a soft rainbow of
// their colours. Small and attached, so it reads as part of what's above it
// rather than one more row. With `to` it's a link of its own; without, it
// sits inside a row that is one.
const props = defineProps<{ colors: Array<string | null>; names: string[]; to?: RouteLocationRaw }>()
const label = computed(() => dancersLabel(props.names))
const tint = computed(() => {
  const solids = props.colors.map((c) => solidOf(c) ?? 'var(--primary)')
  const stops = (solids.length > 1 ? solids : [solids[0], solids[0]]).map((c) => `color-mix(in oklab, ${c} 26%, transparent)`)
  return `linear-gradient(90deg, ${stops.join(', ')})`
})
</script>

<template>
  <component
    :is="to ? RouterLink : 'span'"
    :to="to"
    :class="[
      'inline-flex max-w-full items-center gap-2 rounded-full py-1.5 pr-2.5 pl-3 align-top',
      to && 'press focus-inset',
    ]"
    :style="{ backgroundImage: tint }"
  >
    <!-- Five stars at most, and no "+5": the words already say how many. -->
    <DancerStars :colors="colors.slice(0, 5)" :max="5" />
    <span class="text-callout truncate font-semibold">{{ label }}</span>
    <ChevronRight v-if="to" class="text-muted-foreground size-4 shrink-0" stroke-width="2.5" />
  </component>
</template>
