<script setup lang="ts">
import { watchEffect } from 'vue'
import { useResizeObserver, useScroll } from '@vueuse/core'
import { RouterView, useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import AppShell from '@/components/AppShell.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import UpdateDialog from '@/components/UpdateDialog.vue'
import { buildTitle } from '@/composables/usePageTitle'

// Default page title from route meta. Component-level usePageTitle calls
// (e.g. entity layouts) stack on top and override; when they unmount Unhead
// falls back here. Keep this in Unhead — not document.title — so writes are
// reconciled together.
const route = useRoute()
useHead({ title: () => buildTitle([route.meta.title]) })

// Reflect window scroll-edge state on <html> for the chrome-fade overlays
// below. arrivedState only recomputes when y changes, so on async content
// (route morphs, lazy lists) we'd see stale values — nudge it via a
// synthetic scroll event whenever the body resizes.
const { arrivedState } = useScroll(window)
useResizeObserver(document.body, () => {
  window.dispatchEvent(new Event('scroll'))
})

watchEffect(() => {
  const root = document.documentElement
  root.dataset.scrollAtTop = String(arrivedState.top)
  root.dataset.scrollAtBottom = String(arrivedState.bottom)
})
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
  <LoginDialog />
  <UpdateDialog />
</template>

<style>
@reference './style.css';

/* Content fade-out under floating top/bottom nav — gradient overlays
   that ease page content into the background color before it reaches
   the nav edge. Sits below the nav (z-20 < nav z-30) and above page
   content. Heights track --chrome-{top,bottom}; home route zeros out
   --chrome-top so the top fade collapses to nothing there.
   Co-located with the scroll-edge JS above so the data-attr contract
   between them lives in one file. */
body::before {
  content: '';
  @apply from-background via-background/75 pointer-events-none fixed inset-x-0 top-0 z-20 h-[calc(var(--chrome-top)+1rem)] bg-linear-to-b to-transparent transition-opacity;
}
body::after {
  content: '';
  @apply from-background via-background/75 pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[calc(var(--chrome-bottom)+1rem)] bg-linear-to-t to-transparent transition-opacity;
}
/* Fade the overlay out when there's nothing scrolled past that edge.
   Keeps short pages and end-of-list crisp. */
html[data-scroll-at-top='true'] body::before,
html[data-scroll-at-bottom='true'] body::after {
  @apply opacity-0;
}
</style>
