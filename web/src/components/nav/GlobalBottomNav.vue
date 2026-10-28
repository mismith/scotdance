<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { CalendarDays, CircleEllipsis, House, Search } from '@lucide/vue'
import { tapHaptic } from '@/lib/haptics'
import TabBar, { type TabItem } from '@/components/nav/TabBar.vue'
import MoreMenu from '@/components/nav/MoreMenu.vue'
import { useMorph } from '@/lib/morph'
import { useCrisp } from '@/composables/useCrisp'
import { useUpdate } from '@/composables/useUpdate'

// Home · Competitions · Search, and More on its own beside them (it opens a
// menu rather than a page). Always visible outside a competition, always
// labelled. More's menu grows out of its button: one tap to Settings or a
// people list, without a page in between.
const route = useRoute()
const update = useUpdate()
const crisp = useCrisp()

const menu = useMorph()

// On an early build, a dot points the way to "Help & feedback" in More, until
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
  ]
})
// Not while only the menu is open: it's drawn pressed, not selected.
const moreActive = computed(() => MORE_PREFIXES.some((p) => route.path.startsWith(p)))
const moreBadge = computed(() => update.updateAvailable || crisp.unread > 0 || (update.early && crisp.available && !moreSeen.value))
function openMore(e: MouseEvent) {
  tapHaptic()
  menu.toggle(e)
}
</script>

<template>
  <TabBar :items="items" label="App">
    <template #trailing>
      <button
        v-tap-feedback
        type="button"
        data-menu-anchor
        aria-haspopup="dialog"
        :aria-expanded="menu.open"
        :data-current="moreActive ? '' : undefined"
        :class="[
          'glass press-glass pointer-events-auto relative flex size-16 shrink-0 flex-col items-center justify-center gap-1 rounded-full text-[min(0.6875rem,12px)] leading-none font-semibold',
          moreActive || menu.open ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        ]"
        @click="openMore"
      >
        <span v-if="moreActive" class="bg-foreground/[0.07] absolute inset-1 rounded-full" aria-hidden="true" />
        <CircleEllipsis class="relative size-[1.375rem]" :stroke-width="moreActive ? 2.4 : 2" />
        <span class="relative">More</span>
        <span v-if="moreBadge" class="bg-primary ring-card absolute top-2.5 right-3.5 size-2 rounded-full ring-2" aria-hidden="true" />
      </button>
    </template>
  </TabBar>
  <MoreMenu :menu="menu" />
</template>
