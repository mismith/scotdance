<script setup lang="ts">
import { ref } from 'vue'
import { Check, Share } from '@lucide/vue'
import { isNative } from '@/lib/native'

// A quiet share icon in the app bar: shares the page you're on (a dancer, a
// competition, one of its pages). Where there's no share sheet it copies the
// link, and the button grows into a "Link copied" capsule for a moment. In
// the apps the page's own address only works inside the app, so share the
// website's.
const props = defineProps<{ title?: string }>()

const copied = ref(false)

async function share() {
  const { pathname, search, hash } = window.location
  const data: ShareData = { url: isNative ? `https://scotdance.app${pathname}${search}${hash}` : window.location.href }
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
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    /* clipboard blocked: nothing useful to do */
  }
}
</script>

<template>
  <button
    type="button"
    class="press text-muted-foreground hover:bg-accent relative flex size-9 items-center justify-center rounded-full"
    :aria-label="copied ? 'Link copied' : 'Share this page'"
    @click="share"
  >
    <Share class="size-5" />
    <!-- Grows leftwards out of the button, so nothing beside it moves. -->
    <span
      :class="[
        'glass text-foreground pointer-events-none absolute top-0 right-0 z-10 flex h-9 items-center justify-end overflow-hidden rounded-full whitespace-nowrap',
        'transition-[max-width,opacity] motion-reduce:transition-opacity',
        copied
          ? 'max-w-48 opacity-100 duration-(--dur-slow) ease-snappy'
          : 'max-w-9 opacity-0 duration-(--dur-base) ease-exit',
      ]"
      aria-hidden="true"
    >
      <span class="text-callout pl-3.5 font-semibold">Link copied</span>
      <span class="flex size-9 shrink-0 items-center justify-center">
        <Check class="text-done-foreground size-5" stroke-width="2.75" />
      </span>
    </span>
    <span class="sr-only" aria-live="polite">{{ copied ? 'Link copied' : '' }}</span>
  </button>
</template>
