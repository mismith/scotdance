<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { getCurrentUser } from 'vuefire'
import { ChevronRight, Inbox, Landmark, Lock, LogIn, UserCog, Wrench } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import SidebarBranch from '@/components/nav/SidebarBranch.vue'
import SidebarLink from '@/components/nav/SidebarLink.vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import SaveStatus from '@/components/admin/SaveStatus.vue'
import { useSidebar, useSplit } from '@/composables/admin/useWide'
import { viaHistory } from '@/composables/admin/useManageBack'
import { provideSectionTitle } from '@/composables/admin/useSectionTitle'
import { usePageTitle } from '@/composables/usePageTitle'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

// System admin: approving submitted competitions, people and their access,
// organisations, and maintenance tools. Only for system admins.

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const me = useMeStore()
const sidebar = useSidebar()
const split = useSplit()

interface AdminSection {
  route: string
  title: string
  blurb: string
  icon: typeof Inbox
}
const SECTIONS: AdminSection[] = [
  { route: 'admin.submissions', title: 'Submissions', blurb: 'Review and approve new competitions', icon: Inbox },
  { route: 'admin.users', title: 'Users', blurb: 'Accounts and who can manage what', icon: UserCog },
  { route: 'admin.tools', title: 'Tools', blurb: 'App versions, search and profile rebuilds', icon: Wrench },
  { route: 'admin.organisations', title: 'Organisations', blurb: 'Every organisation, and which competitions they run', icon: Landmark },
]

const authReady = ref(false)
onMounted(async () => {
  await getCurrentUser()
  authReady.value = true
})
const access = computed(() => {
  if (!authReady.value) return 'checking'
  if (!auth.isSignedIn) return 'signed-out'
  if (!me.permissionsLoaded) return 'checking'
  return me.isAdmin ? 'ok' : 'denied'
})

const section = computed(() => SECTIONS.find((s) => route.matched.some((r) => r.name === s.route)))
const isHome = computed(() => route.name === 'admin')
usePageTitle(() => [section.value?.title, 'System admin'])

const exit = computed(() => {
  void route.fullPath
  const deep = Object.entries(route.params).some(([, v]) => v)
  if (!sidebar.value && !split.value && deep && section.value) return viaHistory(router, { to: { name: section.value.route }, label: section.value.title })
  if (!sidebar.value && !isHome.value) return viaHistory(router, { to: { name: 'admin' }, label: 'System admin' })
  return viaHistory(router, { to: { name: 'manage.competitions' }, label: 'Manage' })
})

// As in Manage: the bar names the section once the page's own title has
// scrolled away (see useSectionTitle), with System admin underneath, and
// never repeats what Back already says. The home page has its own big title.
const sectionTitle = provideSectionTitle()
const barTitle = computed(() => {
  const t = isHome.value ? null : (section.value?.title ?? null)
  return t === exit.value.label ? null : t
})
const barSubtitle = computed(() => (isHome.value || exit.value.label === 'System admin' ? null : 'System admin'))
</script>

<template>
  <div class="flex min-h-dvh flex-col md:fixed md:inset-y-0 md:right-0 md:left-(--sidebar) md:min-h-0">
    <AppBar wide :title="barTitle" :subtitle="barSubtitle" :show-title="sectionTitle.showInBar()" :scrolled="true" :exit="exit">
      <template #actions>
        <SaveStatus v-if="access === 'ok'" />
      </template>
    </AppBar>
    <div class="flex flex-1 pt-(--chrome-top) md:min-h-0 md:overflow-hidden">
      <main class="min-w-0 flex-1 md:overflow-y-auto">
        <div v-if="access === 'checking'" class="mx-auto max-w-3xl space-y-3 p-4"><Skeleton v-for="i in 3" :key="i" class="h-16 w-full rounded-2xl!" /></div>
        <template v-else-if="access === 'signed-out'">
          <EmptyState :icon="LogIn" title="Sign in to continue" />
          <div class="flex justify-center"><Button variant="primary" size="lg" @click="auth.openLogin()">Sign in</Button></div>
        </template>
        <EmptyState v-else-if="access === 'denied'" :icon="Lock" title="For system admins only" description="This area is for whoever runs ScotDance.app." />
        <template v-else>
          <div v-if="isHome" class="mx-auto max-w-3xl space-y-4 p-4">
            <h1 class="text-display">System admin</h1>
            <ul class="surface divide-y overflow-hidden rounded-2xl">
              <li v-for="s in SECTIONS" :key="s.route">
                <RouterLink :to="{ name: s.route }" class="press-row focus-inset flex min-h-16 items-center gap-3 px-4 py-2.5">
                  <component :is="s.icon" class="text-primary size-6 shrink-0" stroke-width="1.75" aria-hidden="true" />
                  <span class="min-w-0 flex-1">
                    <span class="block text-base font-semibold">{{ s.title }}</span>
                    <span class="text-muted-foreground block text-sm">{{ s.blurb }}</span>
                  </span>
                  <ChevronRight class="text-muted-foreground size-5" />
                </RouterLink>
              </li>
            </ul>
          </div>
          <RouterView v-else />
        </template>
      </main>
    </div>
    <!-- Wide screens: the sections, nested under System admin in the sidebar. -->
    <SidebarBranch v-if="sidebar && access === 'ok'" under="admin">
      <SidebarLink v-for="s in SECTIONS" :key="s.route" :to="{ name: s.route }" :icon="s.icon" :label="s.title" :state="section?.route === s.route ? 'current' : null" />
    </SidebarBranch>
  </div>
</template>
