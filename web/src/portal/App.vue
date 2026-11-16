<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { Users, UserRound, LogOut, LockKeyhole } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import ScotDanceSignInButton from '@/components/ScotDanceSignInButton.vue'
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
      <section v-else-if="!loading" class="space-y-6 py-10 sm:py-14">
        <LockKeyhole class="mb-8 size-20 text-primary" :stroke-width="1.3" aria-hidden="true" />
        <h1 class="text-[clamp(2.5rem,6vw,3.5rem)] font-extrabold leading-[1.06] tracking-tight">One account.<br /><span class="text-primary">Less filling in.</span></h1>
        <p class="max-w-md text-base text-muted-foreground">Your account details, in one private place. Save what you need and reuse it across the ScotDance.app family of <a href="https://toolkit.scotdance.app" class="text-primary underline underline-offset-4">tools</a>.</p>
        <ScotDanceSignInButton :busy="store.busy" @click="store.login()" />
      </section>
      <p v-if="store.error" role="alert" class="mt-5 text-destructive">{{ store.error }}</p>
    </main>
    <footer class="flex gap-5 pb-[max(1rem,var(--safe-bottom))] text-xs text-muted-foreground">
      <RouterLink to="/privacy" class="flex min-h-11 items-center hover:text-foreground">Privacy &amp; terms</RouterLink>
      <a href="/support" class="flex min-h-11 items-center hover:text-foreground" @click.prevent="store.run(openSupport)">Support</a>
    </footer>
  </div>
</template>
