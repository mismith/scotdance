<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import TopBackButton from '@/components/nav/TopBackButton.vue'

// The one top bar. Opaque, 3.5rem, under the status bar. Left: a labelled
// Back button (when there's somewhere to go back to). Middle: a small title
// that appears once the page's own big title has scrolled away. Right: text
// actions via the `actions` slot.
withDefaults(
  defineProps<{
    title?: string | null
    showTitle?: boolean
    back?: boolean
    fallback?: { to: RouteLocationRaw; label: string }
    exit?: { delta?: number; to?: RouteLocationRaw; label: string } | null
  }>(),
  { title: null, showTitle: false, back: true, fallback: undefined, exit: null },
)

const scrollTop = () => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'instant' : 'smooth' })
}
</script>

<template>
  <nav
    class="bg-background/100 fixed inset-x-0 top-0 z-30 border-b border-transparent pt-(--safe-top) transition-colors data-[scrolled=true]:border-border"
    :data-scrolled="showTitle"
  >
    <div class="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3">
      <TopBackButton v-if="back" :fallback="fallback" :exit="exit" />
      <button
        type="button"
        :class="[
          'min-w-0 flex-1 truncate text-left text-[1.0625rem] font-bold transition-opacity',
          showTitle && title ? 'opacity-100' : 'pointer-events-none opacity-0',
        ]"
        :tabindex="showTitle && title ? 0 : -1"
        @click="scrollTop"
      >
        {{ title }}
      </button>
      <div class="flex shrink-0 items-center gap-1.5">
        <slot name="actions" />
      </div>
    </div>
  </nav>
</template>
