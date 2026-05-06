<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  CalendarDays,
  Info,
  LayoutGrid,
  Trophy,
  Users,
} from '@lucide/vue'

const route = useRoute()
const competitionId = computed(() => String(route.params.competitionId ?? ''))

const tabs: Array<{
  name: string
  to: string
  icon: typeof Info
  matches: string[]
}> = [
  { name: 'Info', to: 'competition.info', icon: Info, matches: ['competition.info'] },
  {
    name: 'Schedule',
    to: 'competition.schedule',
    icon: CalendarDays,
    matches: ['competition.schedule', 'competition.event'],
  },
  {
    name: 'Dancers',
    to: 'competition.dancers',
    icon: Users,
    matches: ['competition.dancers', 'competition.dancer'],
  },
  {
    name: 'Results',
    to: 'competition.results',
    icon: Trophy,
    matches: ['competition.results', 'competition.group'],
  },
]

const activeTab = computed(() => {
  const name = String(route.name ?? '')
  return tabs.find((t) => t.matches.includes(name))?.to
})
</script>

<template>
  <nav
    class="pointer-events-none fixed inset-x-0 bottom-safe z-30 flex justify-center px-3"
  >
    <div class="pointer-events-auto flex items-center gap-2">
      <RouterLink
        :to="{ name: 'competitions' }"
        class="bg-nav/90 text-nav-foreground backdrop-blur-xl hover:opacity-90 flex size-12 items-center justify-center rounded-full shadow-lg"
        title="Back to Competitions"
        aria-label="Back to Competitions"
      >
        <LayoutGrid class="size-5" />
      </RouterLink>
      <div class="bg-nav/90 text-nav-foreground backdrop-blur-xl flex items-center gap-1 rounded-full p-1 shadow-lg">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="{ name: tab.to, params: { competitionId } }"
          :class="[
            'flex flex-col items-center gap-0.5 rounded-full px-4 py-1 text-xs font-medium transition-colors',
            activeTab === tab.to ? 'bg-nav-foreground/10' : 'opacity-70 hover:opacity-100',
          ]"
        >
          <component :is="tab.icon" class="size-4" />
          <span class="text-[10px]">{{ tab.name }}</span>
        </RouterLink>
      </div>
    </div>
  </nav>
</template>
