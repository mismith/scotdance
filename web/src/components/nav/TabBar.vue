<script setup lang="ts">
import type { Component } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { tapHaptic } from '@/lib/haptics'

// The floating tab bar, after iOS 26: a frosted pill above the home
// indicator, always labelled, the current tab sitting in a soft capsule.
// Used for both the app-wide tabs and a competition's tabs, in the same
// place, so there's one pattern to learn. A `leading` slot holds a separate
// round button beside the pill (the competition's way out). Labels never
// scale past 12px so the bar can't break at large text. On wide screens
// (lg) the bar moves up into the top chrome as a slimmer capsule, icons and
// labels side by side, so desktop doesn't look like a stretched phone.
export interface TabItem {
  label: string
  icon: Component
  /** Where the tab goes; or, for a tab that opens something, `onClick`. */
  to?: RouteLocationRaw
  onClick?: (e: MouseEvent) => void
  active: boolean
  badge?: boolean
  /** A menu button whose menu is open: drawn pressed, not selected. */
  expanded?: boolean
}

defineProps<{ items: TabItem[]; label: string; replace?: boolean }>()

function onTap(item: TabItem, e: MouseEvent) {
  tapHaptic()
  item.onClick?.(e)
}
</script>

<template>
  <nav
    data-tabbar
    :aria-label="label"
    class="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.5rem,var(--safe-bottom))] lg:top-[calc(var(--safe-top)+0.375rem)] lg:bottom-auto lg:pb-0"
  >
    <!-- What scrolls under the bar fades and softens toward the bottom, so the
         bar stands out. (On wide screens the bar sits up top, in the app bar's
         own fade.) -->
    <div
      class="lg:hidden from-background via-background/70 absolute inset-x-0 bottom-0 -z-10 h-[calc(100%+1.5rem)] bg-linear-to-t from-30% to-transparent backdrop-blur-[3px] [mask-image:linear-gradient(to_top,black_50%,transparent)]"
      aria-hidden="true"
    />
    <div class="mx-auto flex max-w-lg items-center gap-2 lg:w-fit lg:max-w-none">
      <slot name="leading" />
      <div
        class="glass pointer-events-auto grid h-16 min-w-0 flex-1 grid-cols-(--cols) rounded-full p-1 [view-transition-name:tabbar] lg:h-11 lg:flex-none lg:grid-flow-col lg:grid-cols-none lg:auto-cols-max"
        :style="{ '--cols': `repeat(${items.length}, minmax(0, 1fr))` }"
      >
        <component
          :is="item.to ? RouterLink : 'button'"
          v-for="item in items"
          :key="item.label"
          v-tap-feedback
          v-bind="item.to ? { to: item.to, replace, 'aria-current': item.active ? 'page' : undefined } : { type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': !!item.expanded }"
          :class="[
            'relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-full text-[min(0.6875rem,12px)] leading-none font-semibold transition-colors',
            'lg:flex-row lg:gap-1.5 lg:px-4 lg:text-sm',
            item.active || item.expanded ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          ]"
          @click="onTap(item, $event)"
        >
          <!-- The capsule is its own element so the page's view transition
               slides it from the old tab to the new one (style.css). -->
          <span
            v-if="item.active"
            class="bg-foreground/[0.07] absolute inset-0 rounded-full [view-transition-name:tabbar-highlight]"
            aria-hidden="true"
          />
          <component :is="item.icon" class="relative size-[1.375rem] lg:size-[1.125rem]" :stroke-width="item.active ? 2.4 : 2" />
          <span class="relative max-w-full truncate px-px">{{ item.label }}</span>
          <span
            v-if="item.badge"
            class="bg-secondary ring-card absolute top-2 right-[calc(50%-1.125rem)] size-2 rounded-full ring-2 lg:top-1.5 lg:right-2"
            aria-hidden="true"
          />
        </component>
      </div>
    </div>
  </nav>
</template>
