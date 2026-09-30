<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { X } from '@lucide/vue'
import { useLiveAlertState } from '@/composables/useLiveAlerts'

// In-app alert, dropping from the top like a notification. Tap to open the
// results; it also leaves by itself after a few seconds.
const { current, dismiss } = useLiveAlertState()
const router = useRouter()

let timer: ReturnType<typeof setTimeout> | undefined
watch(current, (a) => {
  clearTimeout(timer)
  if (a) timer = setTimeout(dismiss, 9000)
})

function open() {
  const a = current.value
  if (!a) return
  dismiss()
  router.push(a.to)
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-500 ease-rubber-band motion-reduce:transition-none"
    enter-from-class="-translate-y-[140%]"
    leave-active-class="transition duration-300 ease-in motion-reduce:transition-none"
    leave-to-class="-translate-y-[140%]"
  >
    <div
      v-if="current"
      class="fixed inset-x-2 top-[calc(var(--safe-top)+0.5rem)] z-50 mx-auto max-w-lg"
      role="status"
      aria-live="polite"
    >
      <div class="bg-card flex items-stretch gap-1 rounded-2xl border shadow-xl">
        <button type="button" class="flex min-w-0 flex-1 items-center gap-3 p-3 text-left" @click="open">
          <span class="bg-primary flex size-10 shrink-0 items-center justify-center rounded-[10px]" aria-hidden="true">
            <svg viewBox="0 0 40 40" class="size-10"><path d="M9 9 31 31M31 9 9 31" stroke="#fff" stroke-width="5.5" /></svg>
          </span>
          <span class="min-w-0">
            <b class="block text-[0.9375rem] leading-snug">{{ current.title }}</b>
            <span class="text-muted-foreground block truncate text-sm">{{ current.subtitle }}</span>
          </span>
        </button>
        <button
          type="button"
          class="text-muted-foreground flex w-11 shrink-0 items-center justify-center"
          aria-label="Dismiss"
          @click="dismiss"
        >
          <X class="size-5" />
        </button>
      </div>
    </div>
  </Transition>
</template>
