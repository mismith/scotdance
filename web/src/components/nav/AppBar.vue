<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { ChevronDown } from '@lucide/vue'
import AccountButton from '@/components/nav/AccountButton.vue'
import TopBackButton from '@/components/nav/TopBackButton.vue'

// The one top bar, 3.5rem, under the status bar. It's solid, so nothing
// shows through it; what scrolls under it fades and blurs into the page in a
// short band just below, so there's no hard line. Left: a labelled
// Back button (when there's somewhere to go back to), or whatever the page
// puts in the `leading` slot (Home: the ScotDance.app name). Middle: a small title
// (and optional subtitle) that appears once the page's own big title has
// scrolled away, or always when `showTitle` says so (or the page's own
// `middle`, instead). Right: the page's own
// actions (the `actions` slot), then your account, on every page.
// The small title comes and goes the same way everywhere: it slides out from
// behind the back button (where there is one) as it fades in. Through a page
// change it cross-fades with the rest of the bar, rather than travelling.
// Tapping it scrolls to the top, unless it opens a menu (`titleMenu`: a
// linked competition's switcher), when a chevron says so.
const props = withDefaults(
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
    /** Back as just a chevron, so the title has the room (a competition's pages). */
    compactBack?: boolean
    /** The title opens this menu (and says what it is to screen readers) instead of scrolling up. */
    titleMenu?: { open: (e: MouseEvent) => void; label: string } | null
  }>(),
  { title: null, subtitle: null, showTitle: false, scrolled: undefined, wide: false, back: true, fallback: undefined, exit: null, compactBack: false, titleMenu: null },
)

const onTitle = (e: MouseEvent) => (props.titleMenu ? props.titleMenu.open(e) : scrollTop())

const scrollTop = () => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'instant' : 'smooth' })
}
</script>

<template>
  <nav aria-label="Page" class="fixed inset-x-chrome-0 top-0 z-30 pt-(--safe-top) [view-transition-name:appbar]" :data-scrolled="scrolled ?? showTitle">
    <div
      class="paper absolute inset-x-0 top-0 -z-10 h-[calc(100%+1.25rem)] backdrop-blur-sm [mask-image:linear-gradient(to_bottom,black_calc(100%-1.25rem),transparent)]"
      aria-hidden="true"
    />
    <div :class="['@container mx-auto flex h-14 items-center gap-2 px-3', wide ? 'max-w-none' : 'appbar-row']">
      <TopBackButton v-if="back" :fallback="fallback" :exit="exit" :compact="compactBack" />
      <slot name="leading" />
      <!-- Or the page's own middle, instead of the small title (Add a competition's progress). -->
      <slot name="middle">
      <div class="flex min-w-0 flex-1">
        <button
          type="button"
          :class="[
            'min-w-0 text-left transition-[opacity,translate] duration-(--dur-base) ease-standard',
            titleMenu ? 'press hover:bg-accent -my-1 -ml-2 rounded-xl py-1 pr-1.5 pl-2' : 'flex-1',
            showTitle && title ? 'opacity-100' : 'pointer-events-none -translate-x-3 opacity-0',
          ]"
          :tabindex="showTitle && title ? 0 : -1"
          :aria-hidden="showTitle && title ? undefined : 'true'"
          :aria-haspopup="titleMenu ? 'dialog' : undefined"
          :aria-label="titleMenu ? titleMenu.label : undefined"
          @click="onTitle"
        >
          <span :class="['flex min-w-0 items-center gap-1 font-semibold', subtitle ? 'text-callout leading-tight' : 'text-[1.0625rem]']">
            <span class="truncate">{{ title }}</span>
            <ChevronDown v-if="titleMenu" class="text-muted-foreground size-4 shrink-0" stroke-width="2.4" aria-hidden="true" />
          </span>
          <span v-if="subtitle" class="text-muted-foreground block truncate text-xs font-medium">{{ subtitle }}</span>
        </button>
      </div>
      </slot>
      <!-- Blue, like Back: an action in grey or ink reads as switched off. -->
      <div class="text-primary flex shrink-0 items-center gap-1.5">
        <slot name="actions" />
        <!-- On wide screens your account is at the foot of the sidebar. -->
        <div class="flex lg:hidden"><AccountButton /></div>
      </div>
    </div>
  </nav>
</template>
