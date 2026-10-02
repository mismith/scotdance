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
    enter-active-class="transition-[translate,opacity] duration-(--dur-spring) ease-snappy motion-reduce:transition-opacity"
    enter-from-class="-translate-y-[140%] motion-reduce:translate-y-0 motion-reduce:opacity-0"
    leave-active-class="transition-[translate,opacity] duration-(--dur-base) ease-exit motion-reduce:transition-opacity"
    leave-to-class="-translate-y-[140%] motion-reduce:translate-y-0 motion-reduce:opacity-0"
  >
    <div
      v-if="current"
      class="fixed inset-x-2 top-[calc(var(--safe-top)+0.5rem)] z-50 mx-auto max-w-lg"
      role="status"
      aria-live="polite"
    >
      <!-- The same dark glass as the toasts: it's news from the app, not part of the page. -->
      <div class="hud press flex items-stretch gap-1 rounded-[1.375rem]">
        <button type="button" class="focus-inset flex min-w-0 flex-1 items-center gap-3 rounded-[1.375rem] p-3 text-left" @click="open">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-[0.625rem] bg-[#0065bd]" aria-hidden="true">
            <svg viewBox="0 0 40 40" class="size-10"><path d="M9 9 31 31M31 9 9 31" stroke="#fff" stroke-width="5.5" /></svg>
          </span>
          <span class="min-w-0">
            <span class="text-callout block leading-snug font-semibold">{{ current.title }}</span>
            <span class="block truncate text-sm text-white/70">{{ current.subtitle }}</span>
          </span>
        </button>
        <button
          type="button"
          class="focus-inset flex w-11 shrink-0 items-center justify-center rounded-full text-white/60"
          aria-label="Dismiss"
          @click="dismiss"
        >
          <X class="size-5" />
        </button>
      </div>
    </div>
  </Transition>
</template>
