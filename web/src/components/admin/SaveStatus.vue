<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { CircleAlert, CloudOff, LoaderCircle } from '@lucide/vue'
import { saveState } from '@/lib/admin/write'
import { connected } from '@/lib/offline'

// "Are my changes safe?": shown only when there's something to know (Saving,
// Offline, Not saved), opening out and folding away. Saved is the usual
// state, so it stays quiet (screen readers still hear it).

// A save that's over in a blink doesn't flash Saving… (only one that's slow).
const slow = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => saveState.pending > 0,
  (busy) => {
    clearTimeout(timer)
    if (busy) timer = setTimeout(() => (slow.value = true), 400)
    else slow.value = false
  },
  { immediate: true },
)
onBeforeUnmount(() => clearTimeout(timer))
const state = computed(() => {
  if (!connected.value) return 'offline'
  if (saveState.pending > 0 && slow.value) return 'saving'
  if (saveState.error) return 'error'
  return 'saved'
})
</script>

<template>
  <span class="inline-flex shrink-0" role="status" aria-live="polite" :title="state === 'error' ? (saveState.error ?? undefined) : undefined">
    <Transition
      enter-active-class="transition-[max-width,opacity] duration-(--dur-base) ease-snappy motion-reduce:transition-opacity"
      enter-from-class="max-w-0 opacity-0"
      enter-to-class="max-w-40"
      leave-active-class="transition-[max-width,opacity] duration-(--dur-quick) ease-exit motion-reduce:transition-opacity"
      leave-from-class="max-w-40"
      leave-to-class="max-w-0 opacity-0"
    >
      <span
        v-if="state !== 'saved'"
        :class="[
          'inline-flex h-9 items-center gap-1.5 overflow-hidden rounded-full px-2 text-sm font-semibold whitespace-nowrap sm:px-3',
          state === 'saving' ? 'text-muted-foreground' : 'bg-destructive/10 text-destructive',
        ]"
      >
        <template v-if="state === 'offline'"><CloudOff class="size-4 shrink-0" /> Offline</template>
        <template v-else-if="state === 'saving'"><LoaderCircle class="size-4 shrink-0 animate-spin" /> <span class="max-sm:sr-only">Saving…</span></template>
        <template v-else><CircleAlert class="size-4 shrink-0" /> Not saved</template>
      </span>
    </Transition>
    <span v-if="state === 'saved'" class="sr-only">Saved</span>
  </span>
</template>
