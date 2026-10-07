<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { X } from '@lucide/vue'
import { useLiveAlertState } from '@/composables/useLiveAlerts'

// In-app alert, dropping from the top like a notification. Tap to open the
// results, flick it up to put it away; it also leaves by itself after a few
// seconds (not while you're holding it).
const { current, dismiss } = useLiveAlertState()
const router = useRouter()

// Flick up to dismiss: it follows the finger up, resists going down, and
// leaves from wherever it was let go. A drag never counts as a tap.
const drag = ref<{ y0: number; t0: number; dy: number; moved: boolean } | null>(null)
const held = ref(0)
let timer: ReturnType<typeof setTimeout> | undefined
function wait() {
  clearTimeout(timer)
  if (current.value) timer = setTimeout(dismiss, 9000)
}
watch(current, (a) => {
  if (a) held.value = 0
  wait()
})

function onDown(e: PointerEvent) {
  if (e.button !== 0) return
  drag.value = { y0: e.clientY, t0: performance.now(), dy: 0, moved: false }
  clearTimeout(timer)
}
function onMove(e: PointerEvent) {
  const d = drag.value
  if (!d) return
  const dy = e.clientY - d.y0
  if (!d.moved && Math.abs(dy) < 6) return
  if (!d.moved) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  d.moved = true
  d.dy = dy < 0 ? dy : Math.sqrt(dy) * 2
}
// The system taking the touch away (a call coming in) puts it back, never dismisses.
function onCancel() {
  drag.value = null
  wait()
}
function onUp() {
  const d = drag.value
  drag.value = null
  if (!d?.moved) return wait()
  const velocity = d.dy / Math.max(1, performance.now() - d.t0)
  if (d.dy < -32 || velocity < -0.5) {
    held.value = d.dy
    dismiss()
  } else wait()
}
const dragStyle = computed(() =>
  drag.value?.moved
    ? { translate: `0 ${drag.value.dy}px`, transition: 'none' }
    : held.value
      ? { translate: `0 ${held.value}px`, transition: 'none' }
      : undefined,
)

function open() {
  const a = current.value
  if (!a) return
  dismiss()
  router.push(a.to)
}
</script>

<template>
  <!-- Always in the page, so a screen reader hears each alert as it arrives. -->
  <div role="status" aria-live="polite">
    <Transition
      enter-active-class="transition-[translate,opacity] duration-(--dur-spring) ease-snappy motion-reduce:transition-opacity"
      enter-from-class="-translate-y-[140%] motion-reduce:translate-y-0 motion-reduce:opacity-0"
      leave-active-class="transition-[translate,opacity] duration-(--dur-base) ease-exit motion-reduce:transition-opacity"
      leave-to-class="-translate-y-[140%] motion-reduce:translate-y-0 motion-reduce:opacity-0"
    >
      <div
        v-if="current"
        class="fixed inset-x-chrome-2 top-[calc(var(--safe-top)+0.5rem)] z-50 mx-auto max-w-lg"
      >
        <div
          class="touch-none transition-[translate] duration-(--dur-slow) ease-snappy"
          :style="dragStyle"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onCancel"
          @click.capture="held && $event.stopPropagation()"
        >
          <!-- The same dark glass as the toasts: it's news from the app, not part of the page. -->
          <div class="hud press flex items-stretch gap-1 rounded-[1.375rem]">
            <button type="button" class="focus-inset flex min-w-0 flex-1 items-center gap-3 rounded-[1.375rem] p-3 text-left" @click="open">
              <img src="/img/touchicon.png" alt="" class="size-10 shrink-0 rounded-[0.625rem]" />
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
      </div>
    </Transition>
  </div>
</template>
