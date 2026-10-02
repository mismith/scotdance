<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CalendarDays, ChevronLeft, Clock, House, LayoutGrid, Search, Trophy, Users } from '@lucide/vue'
import TabBar, { type TabItem } from '@/components/nav/TabBar.vue'
import SidebarBranch from '@/components/nav/SidebarBranch.vue'
import SidebarLink from '@/components/nav/SidebarLink.vue'
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
// Competitions or Search): a back chevron with that tab's icon, so it reads
// as "back to Competitions" rather than as another tab. Like the detached
// button beside iOS 26 tab bars (Music's Search).
const route = useRoute()
const router = useRouter()
const competitionId = computed(() => String(route.params.competitionId ?? ''))
const { competition, scheduleHidden, resultsHidden } = useCompetition()

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

// A dancer opened from Schedule or Results keeps that tab lit (and Back
// returns to it), like iOS tab stacks; opened from Dancers or a link, Dancers.
const lastTab = ref<string | null>(null)
watch(
  () => route.name,
  (name) => {
    if (name === 'competition.dancer') return
    lastTab.value = TABS.find((t) => t.matches.includes(String(name)))?.to ?? null
  },
  { immediate: true },
)
const isActive = (t: (typeof TABS)[number]) =>
  route.name === 'competition.dancer' && lastTab.value ? t.to === lastTab.value : t.matches.includes(String(route.name ?? ''))

const items = computed<TabItem[]>(() =>
  TABS.filter(
    (t) =>
      !(t.to === 'competition.schedule' && scheduleHidden.value) &&
      !(t.to === 'competition.results' && resultsHidden.value),
  ).map((t) => ({
    label: t.label,
    icon: t.icon,
    to: { name: t.to, params: { competitionId: competitionId.value } },
    active: isActive(t),
  })),
)
</script>

<template>
  <TabBar :items="items" label="Competition" replace>
    <template #leading>
      <button
        v-tap-feedback
        type="button"
        class="glass press-glass text-foreground pointer-events-auto flex size-16 shrink-0 items-center justify-center rounded-full [view-transition-name:tabbar-exit]"
        :aria-label="`Leave this competition, back to ${exit.label}`"
        :title="`Back to ${exit.label}`"
        @click="leave"
      >
        <span class="flex items-center -space-x-0.5" aria-hidden="true">
          <ChevronLeft class="size-5" stroke-width="2.6" />
          <component :is="exit.icon" class="size-5" stroke-width="2.2" />
        </span>
      </button>
    </template>
  </TabBar>
  <!-- Wide screens: the same tabs, nested under Competitions in the sidebar. -->
  <SidebarBranch under="competitions" :label="competition?.name ?? 'Competition'">
    <SidebarLink
      v-for="t in items"
      :key="t.label"
      :to="t.to!"
      :icon="t.icon"
      :label="t.label"
      :state="t.active ? 'current' : null"
      replace
    />
  </SidebarBranch>
</template>
