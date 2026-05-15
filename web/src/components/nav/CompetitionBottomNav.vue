<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Calendars, Info, Timeline, Trophy, Users } from '@lucide/vue'
import { smartBackClick } from '@/lib/back'
import { useCompetition } from '@/composables/useCompetition'

const route = useRoute()
const router = useRouter()
const competitionId = computed(() => String(route.params.competitionId ?? ''))

const { hasSchedule } = useCompetition()

const allTabs: Array<{
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
    icon: Timeline,
    matches: ['competition.schedule', 'competition.event'],
  },
  {
    name: 'Results',
    to: 'competition.results',
    icon: Trophy,
    matches: ['competition.results', 'competition.group'],
  },
]

// hasSchedule === false means resolved-and-empty/disabled. While unresolved
// (null), keep the tab visible to avoid a flicker on initial load.
const tabs = computed(() =>
  allTabs.filter((t) => t.to !== 'competition.schedule' || hasSchedule.value !== false),
)

const activeTab = computed(() => {
  const name = String(route.name ?? '')
  return tabs.value.find((t) => t.matches.includes(name))?.to
})
</script>

<template>
  <nav class="pointer-events-none fixed inset-x-0 bottom-(--nav-bottom) z-30 px-3">
    <div class="mx-auto flex max-w-3xl items-center justify-between">
      <RouterLink
        v-slot="{ href, route: r, navigate }"
        :to="{ name: 'competitions' }"
        custom
      >
        <a
          :href="href"
          class="floating-nav pointer-events-auto flex size-16 items-center justify-center rounded-full [view-transition-class:clip] [view-transition-name:nav-left] hover:opacity-90"
          title="Back to Competitions"
          aria-label="Back to Competitions"
          @click="smartBackClick(router, $event, r.fullPath, navigate)"
        >
          <span class="[view-transition-name:match-element]">
            <Calendars class="size-5" />
          </span>
        </a>
      </RouterLink>
      <div
        class="floating-nav pointer-events-auto flex items-center rounded-full p-1 [view-transition-class:clip] [view-transition-name:nav-right]"
      >
        <RouterLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="{ name: tab.to, params: { competitionId } }"
          :class="[
            'relative isolate flex h-14 min-w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-full px-3 font-sans font-medium transition-colors [view-transition-name:match-element]',
            activeTab === tab.to
              ? `before:bg-card-foreground/10 before:absolute before:inset-0 before:-z-10 before:rounded-full before:[view-transition-class:fixed-height] before:[view-transition-name:nav-right-active]`
              : 'opacity-70 hover:opacity-100',
          ]"
        >
          <component :is="tab.icon" class="size-5" />
          <span class="text-xs leading-none">{{ tab.name }}</span>
        </RouterLink>
      </div>
    </div>
  </nav>
</template>
