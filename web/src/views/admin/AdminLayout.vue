<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { getCurrentUser } from 'vuefire'
import { ChevronRight, Inbox, Lock, LogIn, UserCog, Wrench } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import SaveStatus from '@/components/admin/SaveStatus.vue'
import { useSidebar, useSplit } from '@/composables/admin/useWide'
import { viaHistory } from '@/composables/admin/useManageBack'
import { usePageTitle } from '@/composables/usePageTitle'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

// System admin: approving submitted competitions, people and their access,
// and maintenance tools. Only for system admins.

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
</script>

<template>
  <div class="flex min-h-dvh flex-col md:fixed md:inset-0 md:min-h-0">
    <AppBar wide title="System admin" :subtitle="section?.title ?? null" show-title :scrolled="true" :exit="exit">
      <template #actions>
        <SaveStatus v-if="access === 'ok'" />
      </template>
    </AppBar>
    <div class="flex flex-1 pt-(--chrome-top) md:min-h-0 md:overflow-hidden">
      <aside v-if="sidebar && access === 'ok'" class="w-64 shrink-0 space-y-1 overflow-y-auto border-r px-3 pt-4">
        <RouterLink
          v-for="s in SECTIONS"
          :key="s.route"
          :to="{ name: s.route }"
          :class="['flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-semibold', section?.route === s.route ? 'bg-primary text-primary-foreground' : 'hover:bg-accent']"
        >
          <component :is="s.icon" class="size-5" /> {{ s.title }}
        </RouterLink>
      </aside>
      <main class="min-w-0 flex-1 md:overflow-y-auto">
        <div v-if="access === 'checking'" class="mx-auto max-w-3xl space-y-3 p-4"><Skeleton v-for="i in 3" :key="i" class="h-16 w-full rounded-2xl!" /></div>
        <template v-else-if="access === 'signed-out'">
          <EmptyState :icon="LogIn" title="Sign in to continue" />
          <div class="flex justify-center"><button type="button" class="bg-primary text-primary-foreground h-12 rounded-xl px-6 text-base font-bold" @click="auth.openLogin()">Sign in</button></div>
        </template>
        <EmptyState v-else-if="access === 'denied'" :icon="Lock" title="For system admins only" description="This area is for whoever runs ScotDance." />
        <template v-else>
          <div v-if="isHome" class="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
            <h1 class="text-display">System admin</h1>
            <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
              <li v-for="s in SECTIONS" :key="s.route">
                <RouterLink :to="{ name: s.route }" class="hover:bg-accent flex min-h-16 items-center gap-3 px-4 py-2.5">
                  <span class="bg-blue-paper text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"><component :is="s.icon" class="size-5" /></span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-base font-bold">{{ s.title }}</span>
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
  </div>
</template>
