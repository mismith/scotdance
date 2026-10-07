<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { CalendarDays, CircleEllipsis, House, Search } from '@lucide/vue'
import TabBar, { type TabItem } from '@/components/nav/TabBar.vue'
import MoreMenu from '@/components/nav/MoreMenu.vue'
import { useMorph } from '@/lib/morph'
import { useCrisp } from '@/composables/useCrisp'
import { useUpdate } from '@/composables/useUpdate'

// Home · Competitions · Search · More. Always visible outside a competition,
// always labelled. More opens a menu that grows out of the tab: one tap to
// Settings or a people list, without a page in between.
const route = useRoute()
const update = useUpdate()
const crisp = useCrisp()

const menu = useMorph()

// On an early build, a dot points the way to "Share your ideas" in More, until
// the menu's been opened once.
const moreSeen = useLocalStorage('early-more-seen', false)
watch(
  () => menu.open,
  (open) => {
    if (open && update.early) moreSeen.value = true
  },
)

const MORE_PREFIXES = ['/settings', '/about', '/judges', '/pipers', '/venues', '/organisations', '/dancers', '/profile', '/policies']

const items = computed<TabItem[]>(() => {
  const path = route.path
  return [
    { label: 'Home', icon: House, to: { name: 'home' }, active: path === '/' },
    {
      label: 'Competitions',
      icon: CalendarDays,
      to: { name: 'competitions' },
      active: path.startsWith('/competitions'),
    },
    { label: 'Search', icon: Search, to: { name: 'search' }, active: path.startsWith('/search') },
    {
      label: 'More',
      icon: CircleEllipsis,
      onClick: (e: MouseEvent) => menu.toggle(e),
      // Not while only the menu is open: two selected capsules would share a
      // view-transition name, and the browser would cancel the menu's morph.
      active: MORE_PREFIXES.some((p) => path.startsWith(p)),
      expanded: menu.open,
      badge: update.updateAvailable || crisp.unread > 0 || (update.early && crisp.available && !moreSeen.value),
    },
  ]
})
</script>

<template>
  <TabBar :items="items" label="App" />
  <MoreMenu :menu="menu" />
</template>
