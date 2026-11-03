<script setup lang="ts">
import { useWhatsNew } from '@/composables/useWhatsNew'
import { useSidebar } from '@/composables/admin/useWide'

// After Home's banner closes, a few seconds' note on where What's new lives
// now, while More keeps a dot (GlobalBottomNav).
const whatsNew = useWhatsNew()
const sidebar = useSidebar()
</script>

<template>
  <div role="status" aria-live="polite">
    <Transition
      enter-active-class="transition duration-(--dur-slow) ease-snappy motion-reduce:transition-none"
      enter-from-class="translate-y-4 opacity-0"
      leave-active-class="transition duration-(--dur-quick) ease-exit motion-reduce:transition-none"
      leave-to-class="translate-y-4 opacity-0"
    >
      <div v-if="whatsNew.note" class="pointer-events-none fixed inset-x-chrome-4 bottom-(--notice-bottom) z-40 flex justify-center">
        <p class="hud rounded-full px-4 py-2 text-sm font-medium">
          What’s new is in <b>{{ sidebar ? 'About' : 'More › About' }}</b> any time.
        </p>
      </div>
    </Transition>
  </div>
</template>
