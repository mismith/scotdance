<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CalendarDays, Clock, House, LayoutGrid, Search, Trophy, Users } from '@lucide/vue'
import TabBar, { type TabItem } from '@/components/nav/TabBar.vue'
import { useCompetition } from '@/composables/useCompetition'
import { goUp } from '@/lib/back'
import { competitionEntry, historyPosition } from '@/lib/competitionExit'
import { tapHaptic } from '@/lib/haptics'

// Inside a competition the bar swaps to the competition's own tabs, exactly as
// v3 did, with v3's names and order. Info became Overview because it now
// leads with your dancers. Schedule always shows, even when empty, so the
// landmarks never move, unless the organisers hid it in Manage (Results
// too). Switching tabs replaces history rather than adding to it, like a
// native tab bar, so Back never steps through tabs.
//
// A separate round glass button beside the pill leaves the competition in
// one tap from any depth, back to the main tab you came from (Home,
// Competitions or Search), wearing that tab's icon. Like the detached
// button beside iOS 26 tab bars (Music's Search).
const route = useRoute()
const router = useRouter()
const competitionId = computed(() => String(route.params.competitionId ?? ''))
const { scheduleHidden, resultsHidden } = useCompetition()

const TABS = [
  { label: 'Overview', icon: LayoutGrid, to: 'competition.info', matches: ['competition.info'] },
  {
    label: 'Dancers',
    icon: Users,
    to: 'competition.dancers',
    matches: ['competition.dancers', 'competition.dancer'],
  },
  {
    label: 'Schedule',
    icon: Clock,
    to: 'competition.schedule',
    matches: ['competition.schedule', 'competition.event'],
  },
  {
    label: 'Results',
    icon: Trophy,
    to: 'competition.results',
    matches: ['competition.results', 'competition.group'],
  },
]

const MAIN_TABS: Record<string, { label: string; icon: Component }> = {
  home: { label: 'Home', icon: House },
  competitions: { label: 'Competitions', icon: CalendarDays },
  search: { label: 'Search', icon: Search },
}
const exit = computed(() => {
  void route.fullPath
  const e = competitionEntry.value
  const from = e?.competitionId === competitionId.value && e.back ? router.resolve(e.back) : null
  const tab = from ? MAIN_TABS[String(from.name)] : null
  const delta = e && tab ? e.position - 1 - historyPosition() : 0
  return tab && delta < 0 ? { ...tab, delta } : { ...MAIN_TABS.competitions, delta: 0 }
})
function leave() {
  tapHaptic()
  if (exit.value.delta) router.go(exit.value.delta)
  else goUp(router, { name: 'competitions' })
}

const items = computed<TabItem[]>(() =>
  TABS.filter(
    (t) =>
      !(t.to === 'competition.schedule' && scheduleHidden.value) &&
      !(t.to === 'competition.results' && resultsHidden.value),
  ).map((t) => ({
    label: t.label,
    icon: t.icon,
    to: { name: t.to, params: { competitionId: competitionId.value } },
    active: t.matches.includes(String(route.name ?? '')),
  })),
)
</script>

<template>
  <TabBar :items="items" label="Competition" replace>
    <template #leading>
      <button
        v-tap-feedback
        type="button"
        class="glass text-foreground pointer-events-auto flex size-16 shrink-0 items-center justify-center rounded-full [view-transition-name:tabbar-exit]"
        :aria-label="`Leave this competition, back to ${exit.label}`"
        :title="`Back to ${exit.label}`"
        @click="leave"
      >
        <component :is="exit.icon" class="size-6" stroke-width="2.2" />
      </button>
    </template>
  </TabBar>
</template>
