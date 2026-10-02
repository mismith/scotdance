<script setup lang="ts">
import { Circle, CircleCheck, CircleMinus } from '@lucide/vue'
import type { DanceState } from '@/lib/admin/results'

// Where one dance's results stand, at a glance: an empty ring before
// they're in, a check once they are, a dash for "none placed", and a "?"
// while a stand-in still needs fixing. `plain` takes the text colour (for
// a selected, filled pill). Callers say it in words too (stateLabel).
defineProps<{ state: DanceState; fix?: boolean; plain?: boolean }>()
</script>

<template>
  <span
    v-if="fix"
    :class="[
      'inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[0.75rem] leading-none font-extrabold',
      plain ? 'bg-current/20' : 'bg-next text-next-foreground',
    ]"
    aria-hidden="true"
    >?</span
  >
  <CircleCheck v-else-if="state === 'done'" :class="['size-5 shrink-0', !plain && 'text-primary']" aria-hidden="true" />
  <CircleMinus v-else-if="state === 'none'" :class="['size-5 shrink-0', !plain && 'text-muted-foreground']" aria-hidden="true" />
  <Circle v-else :class="['size-5 shrink-0', !plain && 'text-strong']" aria-hidden="true" />
</template>
