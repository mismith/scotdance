<script setup lang="ts">
import { computed } from 'vue'
import { CircleAlert, CloudOff, LoaderCircle } from '@lucide/vue'
import { saveState } from '@/lib/admin/write'
import { connected } from '@/lib/offline'

// "Are my changes safe?": shown only when there's something to know (Saving,
// Offline, Not saved). Saved is the usual state, so it stays quiet (screen
// readers still hear it).
const state = computed(() => {
  if (!connected.value) return 'offline'
  if (saveState.pending > 0) return 'saving'
  if (saveState.error) return 'error'
  return 'saved'
})
</script>

<template>
  <span
    :class="[
      'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full text-sm font-bold whitespace-nowrap',
      state === 'saved' ? 'w-0' : 'px-2 sm:px-3',
      state === 'offline' || state === 'error' ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground',
    ]"
    role="status"
    aria-live="polite"
    :title="state === 'error' ? (saveState.error ?? undefined) : undefined"
  >
    <template v-if="state === 'offline'"><CloudOff class="size-4" /> Offline</template>
    <template v-else-if="state === 'saving'"><LoaderCircle class="size-4 animate-spin" /> <span class="max-sm:sr-only">Saving…</span></template>
    <template v-else-if="state === 'error'"><CircleAlert class="size-4" /> Not saved</template>
    <span v-else class="sr-only">Saved</span>
  </span>
</template>
