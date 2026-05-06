<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { CalendarDays, Info, LayoutGrid, Trophy } from '@lucide/vue'

const route = useRoute()
const dancerId = computed(() => String(route.params.dancerId ?? ''))

const tabs: Array<{
  name: string
  to: string
  icon: typeof Info
  matches: string[]
}> = [
  { name: 'Info', to: 'dancer.info', icon: Info, matches: ['dancer.info'] },
  {
    name: 'Schedule',
    to: 'dancer.schedule',
    icon: CalendarDays,
    matches: ['dancer.schedule'],
  },
  {
    name: 'Results',
    to: 'dancer.results',
    icon: Trophy,
    matches: ['dancer.results'],
  },
]

const activeTab = computed(() => {
  const name = String(route.name ?? '')
  return tabs.find((t) => t.matches.includes(name))?.to
})
</script>

<template>
  <nav
    class="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3"
  >
    <div class="pointer-events-auto flex items-center gap-2">
      <RouterLink
        :to="{ name: 'dancers' }"
        class="bg-foreground text-background hover:opacity-90 flex size-12 items-center justify-center rounded-full shadow-lg"
        title="Back to Dancers"
        aria-label="Back to Dancers"
      >
        <LayoutGrid class="size-5" />
      </RouterLink>
      <div class="bg-foreground text-background flex items-center gap-1 rounded-full p-1 shadow-lg">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="{ name: tab.to, params: { dancerId } }"
          :class="[
            'flex flex-col items-center gap-0.5 rounded-full px-4 py-1 text-xs font-medium transition-colors',
            activeTab === tab.to ? 'bg-background/10' : 'opacity-70 hover:opacity-100',
          ]"
        >
          <component :is="tab.icon" class="size-4" />
          <span class="text-[10px]">{{ tab.name }}</span>
        </RouterLink>
      </div>
    </div>
  </nav>
</template>
