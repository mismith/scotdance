<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { ChevronDown } from '@lucide/vue'
import AccountButton from '@/components/nav/AccountButton.vue'
import TopBackButton from '@/components/nav/TopBackButton.vue'
import { useTopBarFrost } from '@/lib/topBar'
import { usePageShowing } from '@/composables/usePageShowing'

// The one top bar, 3.5rem, under the status bar. It's frosted glass (paper):
// what scrolls under it blurs, and it fades into the page in a short band
// just below, so there's no hard line. Left: a labelled
// Back button (when there's somewhere to go back to), or whatever the page
// puts in the `leading` slot (Home: the ScotDance.app name). Middle: a small title
// (and optional subtitle) that appears once the page's own big title has
// scrolled away, or always when `showTitle` says so (or the page's own
// `middle`, instead). Right: the page's own
// actions (the `actions` slot), then your account, on every page.
// The small title comes and goes the same way everywhere: it fades in place,
// with the bar's glass, as on iOS. Through a page change it cross-fades with
// the rest of the bar, rather than travelling.
// Tapping it scrolls to the top, unless it opens a menu (`titleMenu`: a
// linked competition's switcher), when a chevron says so.
const props = withDefaults(
  defineProps<{
    title?: string | null
    subtitle?: string | null
    showTitle?: boolean
    /** Frosted, rather than clear; defaults to `showTitle` (i.e. once scrolled). */
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
// Kept alive out of sight (PageStack), a page's bar leaves with it.
const showing = usePageShowing()

const frosted = computed(() => props.scrolled ?? props.showTitle)
useTopBarFrost(frosted)

// The last subtitle, so it can fold away with its words still in it.
const lastSubtitle = ref(props.subtitle)
watch(() => props.subtitle, (s) => s && (lastSubtitle.value = s))

const onTitle = (e: MouseEvent) => (props.titleMenu ? props.titleMenu.open(e) : scrollTop())

const scrollTop = () => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'instant' : 'smooth' })
}
</script>

<template>
  <!-- In the bars' own layer, outside the pages, so it holds still while they
       slide (lib/pageTransition); its parts cross-fade when they differ.
       Its frosted glass is one sheet behind it (App, lib/topBar). -->
  <Teleport v-if="showing" to="#chrome-top">
  <nav
    data-appbar
    aria-label="Page"
    class="fixed inset-x-chrome-0 top-0 z-30 pt-(--safe-top)"
  >
    <div :class="['@container mx-auto flex h-14 items-center gap-2 px-3', wide ? 'max-w-none' : 'appbar-row']">
      <TopBackButton v-if="back" data-bar-part="back" :fallback="fallback" :exit="exit" :compact="compactBack" />
      <div v-if="$slots.leading" data-bar-part="leading" class="flex min-w-0 items-center"><slot name="leading" /></div>
      <!-- Or the page's own middle, instead of the small title (Add a competition's progress). -->
      <div v-if="$slots.middle" data-bar-part="middle" class="flex min-w-0 flex-1 items-center"><slot name="middle" /></div>
      <!-- First in the row (no Back, nothing leading), the title lines up
           with the page's text, 1rem in; the row's own 0.75rem suits its
           buttons, whose icons carry their own padding. -->
      <div v-else data-bar-part="title" class="flex min-w-0 flex-1 first:pl-1">
        <button
          type="button"
          :class="[
            'min-w-0 text-left transition-opacity duration-(--dur-base) ease-standard',
            titleMenu ? 'press hover:bg-accent -my-1 -ml-2 rounded-xl py-1 pr-1.5 pl-2' : 'flex-1',
            showTitle && title ? 'opacity-100' : 'pointer-events-none opacity-0',
          ]"
          :tabindex="showTitle && title ? 0 : -1"
          :aria-hidden="showTitle && title ? undefined : 'true'"
          :aria-haspopup="titleMenu ? 'dialog' : undefined"
          :aria-label="titleMenu ? titleMenu.label : undefined"
          @click="onTitle"
        >
          <span
            :class="[
              'flex min-w-0 items-center gap-1 font-semibold transition-[font-size,line-height] duration-(--dur-base) ease-standard',
              subtitle ? 'text-callout leading-tight' : 'text-[1.0625rem]',
            ]"
          >
            <span class="truncate">{{ title }}</span>
            <ChevronDown v-if="titleMenu" class="text-muted-foreground size-4 shrink-0" stroke-width="2.4" aria-hidden="true" />
          </span>
          <!-- A subtitle that comes and goes (the month you've scrolled to)
               grows in under the title as the title shrinks and rises to
               make room, and keeps its words while it folds away. -->
          <span
            :class="[
              'grid transition-[grid-template-rows,opacity] duration-(--dur-base) ease-standard',
              subtitle ? 'grid-rows-[1fr]' : 'grid-rows-[0fr] opacity-0',
            ]"
            :aria-hidden="subtitle ? undefined : 'true'"
          >
            <span class="text-muted-foreground block min-h-0 truncate text-xs font-medium">{{ subtitle ?? lastSubtitle }}</span>
          </span>
        </button>
      </div>
      <!-- Blue, like Back: an action in grey or ink reads as switched off. -->
      <div class="text-primary flex shrink-0 items-center gap-1.5">
        <div v-if="$slots.actions" data-bar-part="actions" class="flex items-center gap-1.5"><slot name="actions" /></div>
        <!-- On wide screens your account is at the foot of the sidebar. -->
        <div data-bar-part="account" class="flex lg:hidden"><AccountButton /></div>
      </div>
    </div>
  </nav>
  </Teleport>
</template>
