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
// (lg) the sidebar (nav/AppSidebar) takes over, and the bar steps aside.
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
    data-nav-axis="x"
    :aria-label="label"
    class="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.5rem,var(--safe-bottom))] [view-transition-name:tabbar-backdrop] lg:hidden"
  >
    <!-- As under the top bar: the page's colour behind the bar, and what
         scrolls toward it fades and blurs away in a short band just above. -->
    <div
      class="from-background absolute inset-x-0 bottom-0 -z-10 h-[calc(100%+1.25rem)] bg-linear-to-t from-[calc(100%-1.25rem)] to-transparent backdrop-blur-sm [mask-image:linear-gradient(to_top,black_calc(100%-1.25rem),transparent)]"
      aria-hidden="true"
    />
    <div class="mx-auto flex max-w-lg items-center gap-2">
      <slot name="leading" />
      <div
        data-menu-anchor
        class="glass @container pointer-events-auto grid h-16 min-w-0 flex-1 grid-cols-(--cols) rounded-full p-1 [view-transition-name:tabbar]"
        :style="{ '--cols': `repeat(${items.length}, minmax(0, 1fr))` }"
      >
        <component
          :is="item.to ? RouterLink : 'button'"
          v-for="item in items"
          :key="item.label"
          v-tap-feedback
          v-bind="item.to ? { to: item.to, replace, 'aria-current': item.active ? 'page' : undefined } : { type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': !!item.expanded, 'data-current': item.active ? '' : undefined }"
          :class="[
            'relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-full text-[min(0.6875rem,12px)] leading-none font-semibold transition-colors',
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
          <component :is="item.icon" class="relative size-[1.375rem]" :stroke-width="item.active ? 2.4 : 2" />
          <!-- Labels stop growing at 12px, as iOS tab labels do, so big text
               keeps them; only a bar too narrow for them goes icons only. -->
          <span class="relative max-w-full truncate px-px @max-[200px]:sr-only">{{ item.label }}</span>
          <span
            v-if="item.badge"
            class="bg-primary ring-card absolute top-2 right-[calc(50%-1.125rem)] size-2 rounded-full ring-2"
            aria-hidden="true"
          />
        </component>
      </div>
    </div>
  </nav>
</template>
