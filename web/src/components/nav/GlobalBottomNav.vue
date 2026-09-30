<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { CalendarDays, CircleEllipsis, House, Search } from '@lucide/vue'
import TabBar, { type TabItem } from '@/components/nav/TabBar.vue'
import { useCrisp } from '@/composables/useCrisp'
import { useUpdate } from '@/composables/useUpdate'

// Home · Competitions · Search · More. Always visible outside a competition,
// always labelled, never hidden behind a menu (NN/g: hidden navigation cut
// discoverability by over 20%).
const route = useRoute()
const update = useUpdate()
const crisp = useCrisp()

const MORE_PREFIXES = ['/more', '/about', '/judges', '/pipers', '/venues', '/dancers', '/profile', '/policies']

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
      to: { name: 'more' },
      active: MORE_PREFIXES.some((p) => path.startsWith(p)),
      badge: update.updateAvailable || crisp.unread > 0,
    },
  ]
})
</script>

<template>
  <TabBar :items="items" label="App" />
</template>
