<script setup lang="ts">
import { ref } from 'vue'
import { Check, Share } from '@lucide/vue'

const props = defineProps<{
  title?: string
  text?: string
  url?: string
}>()

const justCopied = ref(false)

async function handleClick() {
  const url = props.url ?? window.location.href
  const data: ShareData = { url }
  if (props.title) data.title = props.title
  if (props.text) data.text = props.text

  if (typeof navigator.share === 'function' && navigator.canShare?.(data)) {
    try {
      await navigator.share(data)
      return
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
    }
  }

  try {
    await navigator.clipboard.writeText(url)
    justCopied.value = true
    setTimeout(() => (justCopied.value = false), 1500)
  } catch {
    /* clipboard blocked — silently no-op */
  }
}
</script>

<template>
  <button
    type="button"
    :title="justCopied ? 'Link copied' : 'Share'"
    aria-label="Share"
    class="hover:bg-accent rounded-md p-2 transition-colors"
    @click="handleClick"
  >
    <Check v-if="justCopied" class="size-4" />
    <Share v-else class="size-4" />
  </button>
</template>
