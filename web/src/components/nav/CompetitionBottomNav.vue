<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { CalendarDays, Info, Trophy, Users } from '@lucide/vue'

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
    name: 'Dancers',
    to: 'competition.dancers',
    icon: Users,
    matches: ['competition.dancers', 'competition.dancer'],
  },
  {
    name: 'Schedule',
    to: 'competition.schedule',
    icon: CalendarDays,
    matches: ['competition.schedule', 'competition.event'],
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
  <nav class="bottom-safe pointer-events-none fixed inset-x-0 z-30 px-3">
    <div class="mx-auto flex max-w-3xl items-center justify-between">
      <RouterLink
        :to="{ name: 'competitions' }"
        class="bg-nav/90 text-nav-foreground pointer-events-auto flex size-12 items-center justify-center rounded-full shadow-lg backdrop-blur-xl [view-transition-class:clip] [view-transition-name:nav-left] hover:opacity-90"
        title="Back to Competitions"
        aria-label="Back to Competitions"
      >
        <span class="[view-transition-name:match-element]">
          <CalendarDays class="size-5" />
        </span>
      </RouterLink>
      <div
        class="bg-nav/90 text-nav-foreground pointer-events-auto rounded-full p-1 shadow-lg backdrop-blur-xl [view-transition-class:clip] [view-transition-name:nav-right]"
      >
        <div class="flex items-center gap-1 [view-transition-name:match-element]">
          <RouterLink
            v-for="tab in tabs"
            :key="tab.to"
            :to="{ name: tab.to, params: { competitionId } }"
            :class="[
              'relative isolate flex flex-col items-center gap-0.5 rounded-full px-4 py-1 text-xs font-medium transition-colors',
              activeTab === tab.to
                ? `before:absolute before:inset-0 before:-z-10 before:rounded-full before:bg-nav-foreground/10 before:content-[''] before:[view-transition-name:nav-right-active]`
                : 'opacity-70 hover:opacity-100',
            ]"
          >
            <component :is="tab.icon" class="size-4" />
            <span class="text-[10px]">{{ tab.name }}</span>
          </RouterLink>
        </div>
      </div>
    </div>
  </nav>
</template>
