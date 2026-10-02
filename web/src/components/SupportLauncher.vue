<script setup lang="ts">
import { LifeBuoy, X } from '@lucide/vue'
import { useCrisp } from '@/composables/useCrisp'

const crisp = useCrisp()

// Confirm before tearing down the launcher — the X is small and easy to
// misfire on. Conversation history isn't lost (Crisp keeps the session
// server-side); reopening from the More menu picks up the thread.
function confirmDismiss() {
  const ok = window.confirm(
    'Hide the support button?\n\nYour conversation will still be saved. You can reopen it any time from the More menu.',
  )
  if (ok) crisp.dismiss()
}
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 bottom-(--chrome-bottom) z-30 px-4">
      <div class="m-auto flex max-w-3xl justify-end">
        <Transition
          enter-active-class="transition-[scale,opacity] duration-(--dur-slow) ease-elastic motion-reduce:transition-opacity"
          enter-from-class="scale-50 opacity-0 motion-reduce:scale-100"
          leave-active-class="transition-[scale,opacity] duration-(--dur-quick) ease-exit motion-reduce:transition-opacity"
          leave-to-class="scale-50 opacity-0 motion-reduce:scale-100"
        >
          <div v-if="crisp.ongoing && !crisp.dismissed" class="relative mb-2">
            <button
              v-tap-feedback
              type="button"
              class="press pointer-events-auto relative flex size-11 items-center justify-center rounded-full bg-[#28a52d] text-white shadow-(--shadow-raised)"
              title="Resume support chat"
              aria-label="Resume support chat"
              @click="crisp.open()"
            >
              <!-- Expanding ring on unread, anchored under the button so it
               radiates outward without affecting hit-testing. -->
              <span
                v-if="crisp.unread > 0"
                class="pointer-events-none absolute inset-0 -z-10 animate-ping rounded-full bg-inherit"
                aria-hidden="true"
              />
              <LifeBuoy class="size-5" />
            </button>

            <button
              v-tap-feedback
              type="button"
              class="glass press pointer-events-auto absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full after:absolute after:-inset-2.5"
              title="Dismiss"
              aria-label="Dismiss support launcher"
              @click="confirmDismiss"
            >
              <X class="size-3" />
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </Teleport>
</template>
