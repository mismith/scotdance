<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { Users, UserRound, LogOut } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import SidebarLink from '@/components/nav/SidebarLink.vue'
import LogoMark from '@/components/LogoMark.vue'
import { useConnectAccount } from './account'
import { openSupport } from './support'
import PageSkeleton from './PageSkeleton.vue'
const route = useRoute()
const store = useConnectAccount()
const loading = computed(() => !route.meta.public && (!store.ready || (route.path === '/account' && !!store.account && !store.pageReady)))
onMounted(() => { void store.initialize(!route.meta.public) })
</script>
<template>
  <div class="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pt-(--safe-top) sm:px-6">
    <header class="flex h-16 shrink-0 items-center justify-between gap-4">
      <RouterLink to="/account" class="focus-inset -ml-2 flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-2" aria-label="ScotDance Connect">
        <LogoMark class="size-7 shrink-0 text-primary" />
        <span class="truncate text-heading font-bold tracking-tight">ScotDance <span class="font-extrabold text-primary">Connect</span></span>
      </RouterLink>
      <Button v-if="store.account" v-show="!loading" variant="plain" size="sm" :disabled="store.busy" @click="store.logout()">
        <LogOut aria-hidden="true" /> Sign out
      </Button>
    </header>
    <nav v-if="store.account || loading" :inert="loading" :aria-hidden="loading || undefined" :class="{ 'invisible': loading }" aria-label="Your account" class="-mx-1 flex gap-1 pb-5">
      <SidebarLink to="/account" :icon="UserRound" label="Account" :state="route.path === '/account' ? 'current' : null" />
      <SidebarLink to="/dancers" :icon="Users" label="Dancers" :state="route.path.startsWith('/dancers') ? 'current' : null" />
    </nav>
    <main id="main" class="flex-1 pb-8 pt-4">
      <PageSkeleton v-if="loading" :account="route.path === '/account'" />
      <div v-if="route.meta.public || (store.ready && store.account)" v-show="!loading">
        <RouterView v-slot="{ Component }">
          <KeepAlive include="AccountPage,DancersPage">
            <component :is="Component" />
          </KeepAlive>
        </RouterView>
      </div>
      <section v-else-if="!loading" class="space-y-5 py-12">
        <h1 class="text-hero">Your ScotDance account</h1>
        <p class="max-w-md text-base text-muted-foreground">One ScotDance account for you and your dancers. Keep your details up to date here and reuse them in Entries, without filling them in again.</p>
        <Button variant="primary" :busy="store.busy" @click="store.login()">Sign in with ScotDance</Button>
      </section>
      <p v-if="store.error" role="alert" class="mt-5 text-destructive">{{ store.error }}</p>
    </main>
    <footer class="flex gap-5 pb-[max(1rem,var(--safe-bottom))] text-xs text-muted-foreground">
      <RouterLink to="/privacy" class="flex min-h-11 items-center hover:text-foreground">Privacy &amp; terms</RouterLink>
      <a href="/support" class="flex min-h-11 items-center hover:text-foreground" @click.prevent="store.run(openSupport)">Support</a>
    </footer>
  </div>
</template>
