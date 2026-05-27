<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ChevronLeft } from '@lucide/vue'
import { useCanGoBack } from '@/lib/back'

const router = useRouter()
const canGoBack = useCanGoBack()

function onClick(event: MouseEvent) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  router.back()
}
</script>

<template>
  <button
    v-if="canGoBack"
    v-tap-feedback
    type="button"
    class="floating-nav pointer-events-auto flex size-12 shrink-0 items-center justify-center rounded-full [view-transition-name:nav-back] hover:opacity-90"
    title="Back"
    aria-label="Back"
    @click="onClick"
  >
    <ChevronLeft class="size-5" />
  </button>
</template>
