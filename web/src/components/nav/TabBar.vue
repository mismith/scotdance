<script setup lang="ts">
import type { Component } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { tapHaptic } from '@/lib/haptics'

// The floating tab bar, after iOS 26: a frosted pill above the home
// indicator, always labelled, the current tab sitting in a soft capsule.
// Used for both the app-wide tabs and a competition's tabs, in the same
// place, so there's one pattern to learn. A `leading` slot holds a separate
// round button beside the pill (the competition's way out). Labels never
// scale past 12px so the bar can't break at large text.
export interface TabItem {
  label: string
  icon: Component
  /** Where the tab goes; or, for a tab that opens something, `onClick`. */
  to?: RouteLocationRaw
  onClick?: (e: MouseEvent) => void
  active: boolean
  badge?: boolean
}

defineProps<{ items: TabItem[]; label: string; replace?: boolean }>()

function onTap(item: TabItem, e: MouseEvent) {
  tapHaptic()
  item.onClick?.(e)
}
</script>

<template>
  <nav
    :aria-label="label"
    class="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.5rem,var(--safe-bottom))]"
  >
    <div class="mx-auto flex max-w-lg items-center gap-2">
      <slot name="leading" />
      <div
        class="glass pointer-events-auto grid h-16 min-w-0 flex-1 rounded-full p-1 [view-transition-name:tabbar]"
        :style="{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }"
      >
        <component
          :is="item.to ? RouterLink : 'button'"
          v-for="item in items"
          :key="item.label"
          v-tap-feedback
          v-bind="item.to ? { to: item.to, replace, 'aria-current': item.active ? 'page' : undefined } : { type: 'button', 'aria-haspopup': 'dialog' }"
          :class="[
            'relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-full text-[min(0.6875rem,12px)] leading-none font-bold transition-colors',
            item.active ? 'text-primary bg-foreground/[0.07]' : 'text-muted-foreground hover:text-foreground',
          ]"
          @click="onTap(item, $event)"
        >
          <component :is="item.icon" class="size-[1.375rem]" :stroke-width="item.active ? 2.4 : 2" />
          <span class="max-w-full truncate px-0.5">{{ item.label }}</span>
          <span
            v-if="item.badge"
            class="bg-secondary ring-card absolute top-2 right-[calc(50%-1.125rem)] size-2 rounded-full ring-2"
            aria-hidden="true"
          />
        </component>
      </div>
    </div>
  </nav>
</template>
