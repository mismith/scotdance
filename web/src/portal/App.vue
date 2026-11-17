<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { ContactRound, UserRound, LogOut, LockKeyhole } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import ScotDanceSignInButton from '@/components/ScotDanceSignInButton.vue'
import ConnectBrand from './ConnectBrand.vue'
import { useConnectAccount } from './account'
import { openSupport } from './support'
import PageSkeleton from './PageSkeleton.vue'
const route = useRoute()
const store = useConnectAccount()
const sections = [
  { to: '/account', label: 'Account', icon: UserRound },
  { to: '/dancers', label: 'Dancers', icon: ContactRound },
]
const isCurrent = (path: string) => route.path === path || route.path.startsWith(`${path}/`)
// Session loading owns the shell; a tab's data loading only owns its content.
const shellLoading = computed(() => !route.meta.public && !store.ready)
const loading = computed(() => shellLoading.value || (!route.meta.public && route.path === '/account' && !!store.account && !store.pageReady))
async function refreshOnReturn() {
  if (document.visibilityState === 'hidden' || !store.ready || !store.account || store.busy) return
  try { await store.load() } catch (error) { store.error = error instanceof Error ? error.message : 'Could not refresh your account.' }
}
let refreshTimer: ReturnType<typeof setInterval>
onMounted(() => {
  refreshTimer = setInterval(() => { void refreshOnReturn() }, 15000)
  void store.initialize(!route.meta.public)
  window.addEventListener('focus', refreshOnReturn)
  document.addEventListener('visibilitychange', refreshOnReturn)
})
onBeforeUnmount(() => {
  clearInterval(refreshTimer)
  window.removeEventListener('focus', refreshOnReturn)
  document.removeEventListener('visibilitychange', refreshOnReturn)
})
</script>
<template>
  <div class="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pt-(--safe-top) sm:px-6">
    <header class="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 md:grid-cols-[auto_minmax(0,1fr)_auto]">
      <RouterLink to="/account" class="focus-inset -ml-2 my-2.5 flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-2" aria-label="ScotDance Connect">
        <ConnectBrand />
      </RouterLink>
      <Button v-if="store.account" v-show="!shellLoading" variant="plain" size="sm" class="col-start-2 row-start-1 justify-self-end md:col-start-3" :disabled="store.busy" @click="store.logout()">
        <LogOut aria-hidden="true" /> Sign out
      </Button>
    <nav v-if="store.account || shellLoading" :inert="shellLoading" :aria-hidden="shellLoading || undefined" :class="{ 'invisible': shellLoading }" aria-label="Your account" class="col-span-2 row-start-2 pb-5 md:col-span-1 md:col-start-2 md:row-start-1 md:justify-self-center md:pb-0">
      <div class="grid w-full max-w-sm grid-cols-2 md:w-auto gap-1 rounded-2xl border border-border bg-background p-0.5">
        <RouterLink v-for="section in sections" :key="section.to" :to="section.to"
          :aria-current="isCurrent(section.to) ? 'page' : undefined"
          class="press-row focus-inset flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-callout font-semibold"
          :class="isCurrent(section.to) ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'">
          <component :is="section.icon" class="size-5 shrink-0" aria-hidden="true" />
          {{ section.label }}
        </RouterLink>
      </div>
    </nav>
    </header>
    <main id="main" class="flex-1 pb-8 pt-4">
      <PageSkeleton v-if="loading" :account="route.path === '/account'" />
      <div v-if="route.meta.public || (store.ready && store.account)" v-show="!loading">
        <RouterView v-slot="{ Component }">
          <KeepAlive include="AccountPage,DancersPage">
            <component :is="Component" :key="route.path" />
          </KeepAlive>
        </RouterView>
      </div>
      <section v-else-if="!loading" class="space-y-6 py-10 sm:py-14">
        <LockKeyhole class="mb-8 size-20 text-primary" :stroke-width="1.3" aria-hidden="true" />
        <h1 class="text-[clamp(2.5rem,6vw,3.5rem)] font-extrabold leading-[1.06] tracking-tight">One account.<br /><span class="text-primary">Less filling in.</span></h1>
        <p class="max-w-md text-base text-muted-foreground">Your account details, in one private place. Save what you need and reuse it across the ScotDance.app family of <a href="https://toolkit.scotdance.app" target="_blank" rel="noopener noreferrer" class="text-primary underline underline-offset-4">tools</a>.</p>
        <ScotDanceSignInButton :busy="store.busy" @click="store.login()" />
      </section>
      <p v-if="store.error" role="alert" class="mt-5 text-destructive">{{ store.error }}</p>
    </main>
    <footer class="flex gap-5 pb-[max(1rem,var(--safe-bottom))] text-xs text-muted-foreground">
      <RouterLink to="/privacy" class="flex min-h-11 items-center hover:text-foreground">Privacy &amp; terms</RouterLink>
      <a href="/help" class="flex min-h-11 items-center hover:text-foreground" @click.prevent="store.run(openSupport)">Help &amp; feedback</a>
    </footer>
  </div>
</template>
