<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Clock, LayoutGrid, Trophy, Users } from '@lucide/vue'
import TabBar, { type TabItem } from '@/components/nav/TabBar.vue'

// Inside a competition the bar swaps to the competition's own tabs, exactly as
// v3 did, with v3's names and order. Info became Overview because it now
// leads with your dancers. Schedule always shows, even when empty, so the
// landmarks never move. Switching tabs replaces history rather than adding
// to it, like a native tab bar, so Back never steps through tabs.
const route = useRoute()
const competitionId = computed(() => String(route.params.competitionId ?? ''))

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

const items = computed<TabItem[]>(() =>
  TABS.map((t) => ({
    label: t.label,
    icon: t.icon,
    to: { name: t.to, params: { competitionId: competitionId.value } },
    active: t.matches.includes(String(route.name ?? '')),
  })),
)
</script>

<template>
  <TabBar :items="items" label="Competition" replace />
</template>
