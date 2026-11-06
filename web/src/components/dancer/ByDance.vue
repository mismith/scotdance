<script setup lang="ts">
import { computed, ref } from 'vue'
import DanceBlock from '@/components/dancer/DanceBlock.vue'
import type { DanceRow } from '@/lib/danceResults'

// Everything a dancer has danced, one block per dance, most danced first.
// Five dances to start with, the rest a tap away. Overall always comes last,
// as the trophy. Counted from what's on ScotDance.app, so "danced" never
// claims more than that.
const props = defineProps<{ dances: DanceRow[]; overall: DanceRow | null }>()

const SHOWN = 5
const open = ref(false)
const shown = computed(() => (open.value ? props.dances : props.dances.slice(0, SHOWN)))
const more = computed(() => props.dances.length - SHOWN)
</script>

<template>
  <div class="rows-engraved -mx-4 [--inset:1rem] [--inset-end:1rem]">
    <DanceBlock v-for="d in shown" :key="d.key" :row="d" />
    <button
      v-if="more > 0"
      type="button"
      class="press-row focus-inset text-primary flex min-h-12 w-full items-center px-4 py-3 text-left font-semibold"
      :aria-expanded="open"
      @click="open = !open"
    >
      {{ open ? 'Show fewer dances' : `Show ${more} more dance${more === 1 ? '' : 's'}` }}
    </button>
    <DanceBlock v-if="overall" :row="overall" trophy />
  </div>
</template>
