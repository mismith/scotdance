<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import AccountButton from '@/components/nav/AccountButton.vue'
import TopBackButton from '@/components/nav/TopBackButton.vue'

// The one top bar, 3.5rem, under the status bar. It's solid, so nothing
// shows through it; what scrolls under it fades and blurs into the page in a
// short band just below, so there's no hard line. Left: a labelled
// Back button (when there's somewhere to go back to), or whatever the page
// puts in the `leading` slot (Home: the ScotDance.app name). Middle: a small title
// (and optional subtitle) that appears once the page's own big title has
// scrolled away, or always when `showTitle` says so. Right: the page's own
// actions (the `actions` slot), then your account, on every page.
// The small title comes and goes the same way everywhere: it slides out from
// behind the back button (where there is one) as it fades in. Through a page
// change it cross-fades with the rest of the bar, rather than travelling.
withDefaults(
  defineProps<{
    title?: string | null
    subtitle?: string | null
    showTitle?: boolean
    /** Border under the bar; defaults to `showTitle` (i.e. once scrolled). */
    scrolled?: boolean
    /** Span the full window (Manage screens on wide displays). */
    wide?: boolean
    back?: boolean
    fallback?: { to: RouteLocationRaw; label: string }
    exit?: { delta?: number; to?: RouteLocationRaw; label: string } | null
  }>(),
  { title: null, subtitle: null, showTitle: false, scrolled: undefined, wide: false, back: true, fallback: undefined, exit: null },
)

const scrollTop = () => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'instant' : 'smooth' })
}
</script>

<template>
  <nav aria-label="Page" class="fixed top-0 right-0 left-(--sidebar) z-30 pt-(--safe-top) [view-transition-name:appbar]" :data-scrolled="scrolled ?? showTitle">
    <div
      class="from-background absolute inset-x-0 top-0 -z-10 h-[calc(100%+1.25rem)] bg-linear-to-b from-[calc(100%-1.25rem)] to-transparent backdrop-blur-sm [mask-image:linear-gradient(to_bottom,black_calc(100%-1.25rem),transparent)]"
      aria-hidden="true"
    />
    <div :class="['@container mx-auto flex h-14 items-center gap-2 px-3', wide ? 'max-w-none' : 'appbar-row']">
      <TopBackButton v-if="back" :fallback="fallback" :exit="exit" />
      <slot name="leading" />
      <button
        type="button"
        :class="[
          'min-w-0 flex-1 text-left transition-[opacity,translate] duration-(--dur-base) ease-standard',
          showTitle && title ? 'opacity-100' : 'pointer-events-none -translate-x-3 opacity-0',
        ]"
        :tabindex="showTitle && title ? 0 : -1"
        :aria-hidden="showTitle && title ? undefined : 'true'"
        @click="scrollTop"
      >
        <span
          :class="['block truncate font-semibold', subtitle ? 'text-callout leading-tight' : 'text-[1.0625rem]']"
        >
          {{ title }}
        </span>
        <span v-if="subtitle" class="text-muted-foreground block truncate text-xs font-medium">{{ subtitle }}</span>
      </button>
      <div class="flex shrink-0 items-center gap-1.5">
        <slot name="actions" />
        <!-- On wide screens your account is at the foot of the sidebar. -->
        <div class="flex lg:hidden"><AccountButton /></div>
      </div>
    </div>
  </nav>
</template>
