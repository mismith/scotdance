<script setup lang="ts">
import { RefreshCw } from '@lucide/vue'

// Marks a part of a linked competition that's copied from its primary
// (ADR 0007): it changes there, not here.
defineProps<{ from?: string | null }>()
</script>

<template>
  <span
    class="bg-blue-paper text-primary inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-bold"
    :title="from ? `Synced from ${from}` : undefined"
  >
    <RefreshCw class="size-3" stroke-width="2.6" aria-hidden="true" />
    Synced<span v-if="from" class="sr-only"> from {{ from }}</span>
  </span>
</template>
