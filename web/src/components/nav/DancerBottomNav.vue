<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, ChartLine, LayoutGrid, Trophy, Users } from '@lucide/vue'
import TabBar, { type TabItem } from '@/components/nav/TabBar.vue'
import SidebarBranch from '@/components/nav/SidebarBranch.vue'
import SidebarLink from '@/components/nav/SidebarLink.vue'
import { backPath, goUp } from '@/lib/back'
import { tapHaptic } from '@/lib/haptics'

// A signed-in dancer's profile has its own tabs, like a competition's:
// Overview, Progress, Results (always last). Switching replaces history, so
// Back never steps through them. A round glass button beside the pill leaves
// the profile in one tap: back to wherever you came from within the app, else
// up to Dancers.
const props = defineProps<{ name: string }>()
const route = useRoute()
const router = useRouter()
const dancerId = computed(() => String(route.params.dancerId ?? ''))

const TABS = [
  { label: 'Overview', icon: LayoutGrid, to: 'dancer.info' },
  { label: 'Progress', icon: ChartLine, to: 'dancer.progress' },
  { label: 'Results', icon: Trophy, to: 'dancer.results' },
]
const items = computed<TabItem[]>(() =>
  TABS.map((t) => ({
    label: t.label,
    icon: t.icon,
    to: { name: t.to, params: { dancerId: dancerId.value } },
    active: route.name === t.to,
  })),
)

// Only the page before this one decides which: it's read as the profile opens.
const cameFromApp = computed(() => {
  void route.fullPath
  return backPath() !== null
})
function leave() {
  tapHaptic()
  if (backPath() !== null) router.back()
  else goUp(router, { name: 'dancers' })
}
</script>

<template>
  <TabBar :items="items" label="Dancer" replace>
    <template #leading>
      <button
        v-tap-feedback
        type="button"
        data-nav="back"
        class="glass press-glass text-foreground pointer-events-auto flex size-16 shrink-0 items-center justify-center rounded-full"
        :aria-label="cameFromApp ? 'Leave this profile' : 'Leave this profile, back to Dancers'"
        :title="cameFromApp ? 'Back' : 'Back to Dancers'"
        @click="leave"
      >
        <span class="flex items-center -space-x-0.5" aria-hidden="true">
          <ChevronLeft class="size-5" stroke-width="2.6" />
          <Users class="size-5" stroke-width="2.2" />
        </span>
      </button>
    </template>
  </TabBar>
  <!-- Wide screens: the same tabs, nested under Dancers in the sidebar. -->
  <SidebarBranch under="dancers" :label="props.name">
    <SidebarLink
      v-for="t in items"
      :key="t.label"
      :to="t.to!"
      :icon="t.icon"
      :label="t.label"
      :state="t.active ? 'current' : null"
      replace
    >
      <!-- Progress is new and may still change (as its own page says). -->
      <template v-if="t.label === 'Progress'" #end>
        <span class="border-primary/40 text-primary rounded-full border px-1.5 text-[0.6875rem] leading-4 font-semibold">Beta</span>
      </template>
    </SidebarLink>
  </SidebarBranch>
</template>
