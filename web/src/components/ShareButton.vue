<script setup lang="ts">
import { ref } from 'vue'
import { Check, Share } from '@lucide/vue'

// A quiet share icon in the app bar: shares the page you're on (a dancer, a
// competition, one of its pages). Falls back to copying the link.
const props = defineProps<{ title?: string }>()

const copied = ref(false)

async function share() {
  const data: ShareData = { url: window.location.href }
  if (props.title) data.title = props.title
  if (typeof navigator.share === 'function' && navigator.canShare?.(data)) {
    try {
      await navigator.share(data)
      return
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(data.url!)
    copied.value = true
    setTimeout(() => (copied.value = false), 1800)
  } catch {
    /* clipboard blocked: nothing useful to do */
  }
}
</script>

<template>
  <button
    type="button"
    class="text-muted-foreground hover:bg-accent flex size-9 items-center justify-center rounded-full"
    :aria-label="copied ? 'Link copied' : 'Share this page'"
    @click="share"
  >
    <Check v-if="copied" class="text-primary size-5" />
    <Share v-else class="size-5" />
    <span class="sr-only" aria-live="polite">{{ copied ? 'Link copied' : '' }}</span>
  </button>
</template>
