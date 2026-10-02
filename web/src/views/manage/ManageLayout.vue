<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { getCurrentUser } from 'vuefire'
import { CalendarX, Lock, LogIn } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import ManageMenu from '@/components/admin/ManageMenu.vue'
import SaveStatus from '@/components/admin/SaveStatus.vue'
import SectionNav from '@/components/admin/SectionNav.vue'
import { provideManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { useSidebar, useSplit } from '@/composables/admin/useWide'
import { provideManageBack, viaHistory, type ManageBack } from '@/composables/admin/useManageBack'
import { usePageTitle } from '@/composables/usePageTitle'
import { ALL_SECTIONS } from '@/lib/admin/sections'
import { historyState, redo, undo } from '@/lib/admin/history'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const me = useMeStore()
const sidebar = useSidebar()
const split = useSplit()
const backOverride = provideManageBack()

const competitionId = computed(() => String(route.params.competitionId ?? ''))
const m = provideManagedCompetition(competitionId)

const authReady = ref(false)
onMounted(async () => {
  await getCurrentUser()
  authReady.value = true
})

type Access = 'checking' | 'signed-out' | 'denied' | 'missing' | 'ok'
const access = computed<Access>(() => {
  if (!authReady.value) return 'checking'
  if (!auth.isSignedIn) return 'signed-out'
  if (!me.permissionsLoaded) return 'checking'
  if (!me.hasCompetitionPerm(competitionId.value)) return 'denied'
  if (!m.loaded.value) return 'checking'
  if (!m.exists.value) return 'missing'
  return 'ok'
})

const section = computed(() => ALL_SECTIONS.find((s) => route.matched.some((r) => r.name === s.route)))
const isHome = computed(() => route.name === 'manage')
const name = computed(() => m.competition.value?.name || 'Competition')

usePageTitle(() => [route.meta.title as string | undefined, section.value?.title, 'Manage', m.competition.value?.name])

// Back says exactly where it goes. On a phone it climbs one level (item →
// section → Manage → competition); with the sidebar showing, sections are
// side by side, so it leaves Manage. So does any page you can't use.
const up = computed<ManageBack>(() => {
  const cid = competitionId.value
  const leave = { to: { name: 'competition.info', params: { competitionId: cid } }, label: name.value }
  if (sidebar.value || ['signed-out', 'denied', 'missing'].includes(access.value)) return leave
  if (backOverride.value) return backOverride.value
  const parent = route.meta.manageParent as string | undefined
  if (parent) {
    const parentSection = ALL_SECTIONS.find((s) => s.route === parent)
    // A sub-page of one item (an age group's draws) goes back to that item.
    const itemId = route.params.itemId ? String(route.params.itemId) : undefined
    return { to: { name: parent, params: { competitionId: cid, itemId } }, label: parentSection?.title ?? 'Back' }
  }
  // On a phone an item fills the screen: Back returns to its list. (A
  // schedule's day is a tab, not a level.)
  const deep = Object.entries(route.params).some(([k, v]) => k !== 'competitionId' && k !== 'dayId' && v)
  if (!split.value && deep && section.value) {
    return { to: { name: section.value.route, params: { competitionId: cid } }, label: section.value.title }
  }
  if (!isHome.value) return { to: { name: 'manage', params: { competitionId: cid } }, label: 'Manage' }
  return leave
})
const exit = computed(() => {
  void route.fullPath
  return viaHistory(router, up.value)
})

// Undo and redo for everything changed in this competition on this visit.
// Cmd+Z / Ctrl+Z undoes, Shift+Cmd+Z / Ctrl+Y redoes, except while typing in
// a field (where they undo the typing, as usual).
const history = historyState(() => competitionId.value)
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const undoKey = isMac ? '⌘Z' : 'Ctrl+Z'
const redoKey = isMac ? '⇧⌘Z' : 'Ctrl+Y'
// One step at a time, in the order asked for: a quick second ⌘Z waits for
// the first to save rather than being lost.
const busy = ref(false)
let queue = Promise.resolve()
function run(step: () => Promise<boolean>) {
  queue = queue
    .then(async () => {
      busy.value = true
      try {
        await step()
      } finally {
        busy.value = false
      }
    })
    .catch(() => {})
  return queue
}
const doUndo = () => run(() => undo(competitionId.value))
const doRedo = () => run(() => redo(competitionId.value))
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (access.value !== 'ok' || !(e.metaKey || e.ctrlKey) || e.altKey) return
  const t = e.target as HTMLElement | null
  if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
  const key = e.key.toLowerCase()
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault()
    void doUndo()
  } else if ((key === 'z' && e.shiftKey) || (key === 'y' && !isMac)) {
    e.preventDefault()
    void doRedo()
  }
})

// "View" opens the same part of the public page, where there is one.
const PUBLIC: Record<string, string> = {
  'manage.results': 'competition.results',
  'manage.schedule': 'competition.schedule',
  'manage.dancers': 'competition.dancers',
}
const viewRoute = computed(() => ({ name: (section.value && PUBLIC[section.value.route]) || 'competition.info', params: { competitionId: competitionId.value } }))

// The bar names where you are; the competition sits underneath.
const barTitle = computed(() => (isHome.value ? 'Manage' : ((route.meta.title as string | undefined) ?? section.value?.title ?? 'Manage')))
</script>

<template>
  <div class="flex min-h-dvh flex-col md:fixed md:inset-0 md:min-h-0">
    <AppBar wide :title="barTitle" :subtitle="access === 'ok' ? name : null" show-title :scrolled="true" :exit="exit" :competition-id="competitionId">
      <template #actions>
        <template v-if="access === 'ok'">
          <SaveStatus />
          <ManageMenu
            :undo-label="history.undoLabel.value"
            :redo-label="history.redoLabel.value"
            :can-undo="history.canUndo.value"
            :can-redo="history.canRedo.value"
            :busy="busy"
            :undo-key="undoKey"
            :redo-key="redoKey"
            :view="viewRoute"
            @undo="doUndo"
            @redo="doRedo"
          />
        </template>
      </template>
    </AppBar>

    <div class="flex flex-1 pt-(--chrome-top) md:min-h-0 md:overflow-hidden">
      <aside
        v-if="sidebar && access === 'ok'"
        class="bg-background w-68 shrink-0 overflow-y-auto border-r px-3 pt-4 pb-8"
      >
        <SectionNav compact />
      </aside>

      <main class="min-w-0 flex-1 md:overflow-y-auto">
        <div v-if="access === 'checking'" class="mx-auto max-w-3xl space-y-4 p-4" aria-busy="true">
          <span class="sr-only">Loading…</span>
          <Skeleton class="h-8 w-1/2" />
          <Skeleton class="h-40 w-full rounded-2xl!" />
          <Skeleton class="h-40 w-full rounded-2xl!" />
        </div>
        <template v-else-if="access === 'signed-out'">
          <EmptyState
            :icon="LogIn"
            title="Sign in to manage this competition"
            description="Organisers and the admins they invite can edit a competition after signing in."
          />
          <div class="flex justify-center">
            <button type="button" class="bg-primary-fill text-primary-foreground h-12 rounded-xl px-6 text-base font-bold" @click="auth.openLogin()">
              Sign in
            </button>
          </div>
        </template>
        <template v-else-if="access === 'denied'">
          <EmptyState
            :icon="Lock"
            title="You can’t manage this competition"
            description="Ask one of its organisers to invite you. They can do it under Manage › Admins."
          />
          <div class="flex justify-center">
            <RouterLink :to="{ name: 'competition.info', params: { competitionId } }" class="bg-card border-strong h-12 content-center rounded-xl border px-6 text-base font-bold">
              Back to the competition
            </RouterLink>
          </div>
        </template>
        <EmptyState
          v-else-if="access === 'missing'"
          :icon="CalendarX"
          title="Competition not found"
          description="It may have been deleted, or the link is wrong."
        />
        <RouterView v-else-if="access === 'ok'" />
      </main>
    </div>
  </div>
</template>
