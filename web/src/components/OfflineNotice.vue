<script setup lang="ts">
import { computed } from 'vue'
import { CloudOff } from '@lucide/vue'
import { showingSavedFrom } from '@/lib/offline'

// Shown while the page is using copies saved on the device (no signal), so
// nobody mistakes an old schedule or results for the latest.
const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const day = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

const savedWhen = computed(() => {
  const at = showingSavedFrom.value
  if (at == null) return null
  const d = new Date(at)
  return d.toDateString() === new Date().toDateString() ? time.format(d) : day.format(d)
})
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-rubber-band motion-reduce:transition-none"
    enter-from-class="translate-y-4 opacity-0"
    leave-active-class="transition duration-200 ease-in motion-reduce:transition-none"
    leave-to-class="translate-y-4 opacity-0"
  >
    <div
      v-if="savedWhen"
      class="pointer-events-none fixed inset-x-4 bottom-[calc(var(--chrome-bottom)+0.75rem)] z-40 flex justify-center"
      role="status"
      aria-live="polite"
    >
      <p class="glass text-foreground flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-lg">
        <CloudOff class="size-4 shrink-0" />
        Offline · last updated {{ savedWhen }}
      </p>
    </div>
  </Transition>
</template>
