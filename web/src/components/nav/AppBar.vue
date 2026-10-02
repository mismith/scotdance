<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import AccountButton from '@/components/nav/AccountButton.vue'
import TopBackButton from '@/components/nav/TopBackButton.vue'

// The one top bar, 3.5rem, under the status bar. What scrolls under it
// fades and softens into the page, as under the tab bar, so there's no hard
// line. Left: a labelled
// Back button (when there's somewhere to go back to), or whatever the page
// puts in the `leading` slot (Home: the ScotDance.app name). Middle: a small title
// (and optional subtitle) that appears once the page's own big title has
// scrolled away, or always when `showTitle` says so. Right: the page's own
// actions (the `actions` slot), then your account, on every page.
//
// `titleVt` names the title for view transitions, so a page's big title can
// shrink into the bar; it's only applied while the title is showing, so the
// name is never on two elements at once.
withDefaults(
  defineProps<{
    title?: string | null
    subtitle?: string | null
    showTitle?: boolean
    /** Border under the bar; defaults to `showTitle` (i.e. once scrolled). */
    scrolled?: boolean
    titleVt?: string | null
    /** Span the full window (Manage screens on wide displays). */
    wide?: boolean
    back?: boolean
    fallback?: { to: RouteLocationRaw; label: string }
    exit?: { delta?: number; to?: RouteLocationRaw; label: string } | null
    /** The competition this page belongs to: the account menu offers to manage it. */
    competitionId?: string
  }>(),
  { title: null, subtitle: null, showTitle: false, scrolled: undefined, titleVt: null, wide: false, back: true, fallback: undefined, exit: null, competitionId: undefined },
)

const scrollTop = () => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'instant' : 'smooth' })
}
</script>

<template>
  <nav class="fixed inset-x-0 top-0 z-30 pt-(--safe-top)" :data-scrolled="scrolled ?? showTitle">
    <div
      class="from-background via-background/90 absolute inset-x-0 top-0 -z-10 h-[calc(100%+1.25rem)] bg-linear-to-b from-55% to-transparent backdrop-blur-[3px] [mask-image:linear-gradient(to_bottom,black_60%,transparent)]"
      aria-hidden="true"
    />
    <div :class="['mx-auto flex h-14 items-center gap-2 px-3', wide ? 'max-w-none' : 'max-w-3xl']">
      <TopBackButton v-if="back" :fallback="fallback" :exit="exit" />
      <slot name="leading" />
      <button
        type="button"
        :class="[
          'min-w-0 flex-1 text-left transition-opacity',
          showTitle && title ? 'opacity-100' : 'pointer-events-none opacity-0',
        ]"
        :tabindex="showTitle && title ? 0 : -1"
        @click="scrollTop"
      >
        <span
          :class="['block truncate font-semibold', subtitle ? 'text-callout leading-tight' : 'text-[1.0625rem]']"
          :style="showTitle && titleVt ? { viewTransitionName: titleVt } : undefined"
        >
          {{ title }}
        </span>
        <span v-if="subtitle" class="text-muted-foreground block truncate text-xs font-medium">{{ subtitle }}</span>
      </button>
      <div class="flex shrink-0 items-center gap-1.5">
        <slot name="actions" />
        <AccountButton :competition-id="competitionId" />
      </div>
    </div>
  </nav>
</template>
