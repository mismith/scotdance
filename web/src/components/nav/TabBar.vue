<script setup lang="ts">
import { nextTick, useTemplateRef, watch, type Component } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { tapHaptic } from '@/lib/haptics'
import { usePageShowing } from '@/composables/usePageShowing'

// The floating tab bar, after iOS 26: a frosted pill above the home
// indicator, always labelled, the current tab sitting in a soft capsule.
// Used for both the app-wide tabs and a competition's tabs, in the same
// place, so there's one pattern to learn. A `leading` slot holds a separate
// round button before the pill (the competition's way out), `trailing` one
// after it (More). Labels never
// scale past 12px so the bar can't break at large text. Each tab is as wide
// as its label and some room either side, then they share what's left, so a
// long label's capsule isn't tight. On a narrow bar that room goes first,
// then the tabs squeeze alike. On wide screens
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

const props = defineProps<{ items: TabItem[]; label: string; replace?: boolean }>()
// Kept alive out of sight (PageStack), a page's bar leaves with it.
const showing = usePageShowing()

// The current tab's capsule slides to the new tab, overshooting a little,
// stretching to fit as it goes (tabs differ in width). Moved, not resized,
// so the compositor plays it.
const pill = useTemplateRef<HTMLElement>('pill')
const capsule = () => pill.value?.querySelector<HTMLElement>('[data-capsule]') ?? null
watch(
  () => props.items.findIndex((i) => i.active),
  async () => {
    const from = capsule()?.getBoundingClientRect()
    await nextTick()
    const el = capsule()
    if (!from || !el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const to = el.getBoundingClientRect()
    if (!to.width || Math.abs(from.left - to.left) < 1) return
    el.animate(
      [{ transform: `translateX(${from.left - to.left}px) scaleX(${from.width / to.width})` }, { transform: 'none' }],
      { duration: 300, easing: getComputedStyle(el).getPropertyValue('--ease-elastic').trim() || 'ease-out' },
    )
  },
  { flush: 'pre' },
)

function onTap(item: TabItem, e: MouseEvent) {
  tapHaptic()
  item.onClick?.(e)
}
</script>

<template>
  <!-- In the bars' own layer, outside the pages, so it holds still while they
       slide (lib/pageTransition). Its frosted strip is one sheet behind it
       (App). It runs 2.5rem past the foot of the screen, which iOS can paint
       a little below where bottom: 0 lands. -->
  <Teleport v-if="showing" to="#chrome-bottom">
  <nav
    data-tabbar
    data-nav-axis="x"
    :aria-label="label"
    class="pointer-events-none fixed inset-x-chrome-0 -bottom-10 z-30 px-3 pb-[calc(max(0.5rem,var(--safe-bottom))+2.5rem)] lg:hidden"
  >
    <div data-tabbar-row class="mx-auto flex max-w-lg items-center gap-2">
      <slot name="leading" />
      <div
        ref="pill"
        data-menu-anchor
        class="glass @container pointer-events-auto grid h-16 min-w-0 flex-1 grid-cols-(--cols) rounded-full p-1"
        :style="{ '--cols': `repeat(${items.length}, minmax(0, auto))` }"
      >
        <component
          :is="item.to ? RouterLink : 'button'"
          v-for="item in items"
          :key="item.label"
          v-tap-feedback
          v-bind="item.to ? { to: item.to, replace, 'aria-current': item.active ? 'page' : undefined } : { type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': !!item.expanded, 'data-current': item.active ? '' : undefined }"
          :class="[
            'relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-full px-[clamp(1px,(100cqi-14rem)/4,0.75rem)] text-[min(0.6875rem,12px)] leading-none font-semibold transition-colors',
            item.active || item.expanded ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          ]"
          @click="onTap(item, $event)"
        >
          <span
            v-if="item.active"
            data-capsule
            class="bg-foreground/[0.07] absolute inset-0 rounded-full"
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
      <slot name="trailing" />
    </div>
  </nav>
  </Teleport>
</template>
