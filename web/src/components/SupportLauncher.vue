<script setup lang="ts">
import { LifeBuoy, X } from '@lucide/vue'
import { useCrisp } from '@/composables/useCrisp'

const crisp = useCrisp()

// Confirm before tearing down the launcher — the X is small and easy to
// misfire on. Conversation history isn't lost (Crisp keeps the session
// server-side); reopening from the More menu picks up the thread.
function confirmDismiss() {
  const ok = window.confirm(
    'Hide the support button?\n\nYour conversation will still be saved — you can reopen it any time from the More menu.',
  )
  if (ok) crisp.dismiss()
}
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 bottom-(--chrome-bottom) z-30 px-4">
      <div class="m-auto flex max-w-3xl justify-end">
        <Transition
          enter-active-class="transition ease-rubber-band"
          enter-from-class="scale-50 opacity-0"
          enter-to-class="scale-100 opacity-100"
          leave-active-class="transition ease-out"
          leave-from-class="scale-100 opacity-100"
          leave-to-class="scale-50 opacity-0"
        >
          <div v-if="crisp.ongoing && !crisp.dismissed" class="relative mb-2">
            <button
              type="button"
              class="pointer-events-auto relative flex size-10 items-center justify-center rounded-full bg-[#28a52d] text-white shadow-lg transition-transform hover:scale-105"
              title="Resume support chat"
              aria-label="Resume support chat"
              @click="crisp.open()"
            >
              <!-- Expanding ring on unread, anchored under the button so it
               radiates outward without affecting hit-testing. -->
              <span
                v-if="crisp.unread > 0"
                class="pointer-events-noneabsolute inset-0 -z-10 animate-ping rounded-full bg-inherit"
                aria-hidden="true"
              />
              <LifeBuoy class="size-4" />
            </button>

            <button
              type="button"
              class="floating-nav pointer-events-auto absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full hover:opacity-90"
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
