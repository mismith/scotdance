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
    enter-active-class="transition duration-(--dur-slow) ease-snappy motion-reduce:transition-none"
    enter-from-class="translate-y-4 opacity-0"
    leave-active-class="transition duration-(--dur-quick) ease-exit motion-reduce:transition-none"
    leave-to-class="translate-y-4 opacity-0"
  >
    <div
      v-if="savedWhen"
      data-offline-notice
      class="pointer-events-none fixed right-4 bottom-(--notice-bottom) left-[calc(var(--sidebar)+1rem)] z-40 flex justify-center"
      role="status"
      aria-live="polite"
    >
      <p class="hud flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium">
        <CloudOff class="size-4 shrink-0" />
        Offline · last updated {{ savedWhen }}
      </p>
    </div>
  </Transition>
</template>
