<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
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

const MORE_PREFIXES = ['/settings', '/about', '/judges', '/pipers', '/venues', '/dancers', '/profile', '/policies']

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
      active: menu.open || MORE_PREFIXES.some((p) => path.startsWith(p)),
      badge: update.updateAvailable || crisp.unread > 0,
    },
  ]
})
</script>

<template>
  <TabBar :items="items" label="App" />
  <MoreMenu :menu="menu" />
</template>
