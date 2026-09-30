<script setup lang="ts">
import { Check } from '@lucide/vue'

// How much of something has results, said quietly: a check when it's all
// in, "2 of 6" part way, nothing before. Status only speaks when it's news.
defineProps<{ posted: number; total: number }>()
</script>

<template>
  <span v-if="total && posted >= total" class="text-done-foreground flex size-6 shrink-0 items-center justify-center">
    <Check class="size-5" stroke-width="3" aria-hidden="true" />
    <span class="sr-only">Results in</span>
  </span>
  <span v-else-if="posted > 0" class="text-muted-foreground shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums">
    {{ posted }} of {{ total }}
  </span>
</template>
