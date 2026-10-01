<script setup lang="ts">
import { computed } from 'vue'
import { CircleAlert, CircleCheck, CloudOff, LoaderCircle } from '@lucide/vue'
import { saveState } from '@/lib/admin/write'
import { connected } from '@/lib/offline'

// One calm word for "are my changes safe?": Saving, Saved, Offline or Not saved.
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
      'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2 text-sm font-bold whitespace-nowrap sm:px-3',
      state === 'offline' || state === 'error' ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground',
    ]"
    role="status"
    aria-live="polite"
    :title="state === 'error' ? (saveState.error ?? undefined) : undefined"
  >
    <template v-if="state === 'offline'"><CloudOff class="size-4" /> Offline</template>
    <template v-else-if="state === 'saving'"><LoaderCircle class="size-4 animate-spin" /> <span class="max-sm:sr-only">Saving…</span></template>
    <template v-else-if="state === 'error'"><CircleAlert class="size-4" /> Not saved</template>
    <template v-else><CircleCheck class="text-done-foreground size-4" /> <span class="max-sm:sr-only">Saved</span></template>
  </span>
</template>
