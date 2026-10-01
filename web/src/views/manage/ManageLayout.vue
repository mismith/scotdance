<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { getCurrentUser } from 'vuefire'
import { CalendarX, ExternalLink, Lock, LogIn } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import SaveStatus from '@/components/admin/SaveStatus.vue'
import SectionNav from '@/components/admin/SectionNav.vue'
import { provideManagedCompetition } from '@/composables/admin/useManagedCompetition'
import { useSidebar, useSplit } from '@/composables/admin/useWide'
import { provideManageBack } from '@/composables/admin/useManageBack'
import { usePageTitle } from '@/composables/usePageTitle'
import { ALL_SECTIONS } from '@/lib/admin/sections'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

const route = useRoute()
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
// side by side, so it leaves Manage.
const exit = computed(() => {
  const cid = competitionId.value
  if (!sidebar.value) {
    if (backOverride.value) return backOverride.value
    const parent = route.meta.manageParent as string | undefined
    if (parent) {
      const parentSection = ALL_SECTIONS.find((s) => s.route === parent)
      return { to: { name: parent, params: { competitionId: cid } }, label: parentSection?.title ?? 'Back' }
    }
    // On a phone an item fills the screen: Back returns to its list.
    const deep = Object.entries(route.params).some(([k, v]) => k !== 'competitionId' && v)
    if (!split.value && deep && section.value) {
      return { to: { name: section.value.route, params: { competitionId: cid } }, label: section.value.title }
    }
    if (!isHome.value) return { to: { name: 'manage', params: { competitionId: cid } }, label: 'Manage' }
  }
  return { to: { name: 'competition.info', params: { competitionId: cid } }, label: name.value }
})

// The bar names where you are; the competition sits underneath.
const barTitle = computed(() => (isHome.value ? 'Manage' : ((route.meta.title as string | undefined) ?? section.value?.title ?? 'Manage')))
</script>

<template>
  <div class="flex min-h-dvh flex-col md:fixed md:inset-0 md:min-h-0">
    <AppBar wide :title="barTitle" :subtitle="access === 'ok' ? name : null" show-title :scrolled="true" :exit="exit">
      <template #actions>
        <SaveStatus v-if="access === 'ok'" />
        <RouterLink
          v-if="access === 'ok' && sidebar"
          :to="{ name: 'competition.info', params: { competitionId } }"
          class="hover:bg-accent text-primary flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold"
        >
          View <ExternalLink class="size-4" />
        </RouterLink>
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
            <button type="button" class="bg-primary text-primary-foreground h-12 rounded-xl px-6 text-base font-bold" @click="auth.openLogin()">
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
