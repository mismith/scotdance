<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ArrowDownToLine,
  Bell,
  ChevronRight,
  ExternalLink,
  FileText,
  Gavel,
  Info,
  LifeBuoy,
  LogOut,
  MessageCircleQuestion,
  Music,
  School,
  Sun,
  Users,
} from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import { useScrolledPast } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import { useTheme, type Theme } from '@/composables/useTheme'
import { useAlerts } from '@/composables/useAlerts'
import { useCrisp } from '@/composables/useCrisp'
import { useUpdate } from '@/composables/useUpdate'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'
import { ROLES, useRoles } from '@/composables/useRoles'
import { gravatarUrl } from '@/lib/gravatar'
import { initialsOf } from '@/lib/format'

// Everything that isn't a competition or a dancer, as plain labelled rows:
// account, notifications, display, the people lists, help. Settings that
// change how the app looks are controls right here, not another screen.
usePageTitle(['More'])

const auth = useAuthStore()
const me = useMeStore()
const alerts = useAlerts()
const crisp = useCrisp()
const update = useUpdate()
const { theme } = useTheme()

const titleEl = ref<HTMLElement | null>(null)
const scrolledPast = useScrolledPast(titleEl)

const avatar = ref<string | null>(null)
watch(
  () => me.email,
  async (email) => (avatar.value = await gravatarUrl(email, 96)),
  { immediate: true },
)
const initials = computed(() => initialsOf(me.displayName ?? me.email ?? '?'))

const THEMES: Array<{ id: Theme; label: string }> = [
  { id: 'auto', label: 'Automatic' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

const roles = useRoles()
const rolesLabel = computed(() => {
  const picked = ROLES.filter((r) => roles.has(r.id)).map((r) => r.label)
  return picked.length ? picked.join(', ') : 'Not answered yet'
})
const canManage = computed(
  () => me.isAdmin || roles.has('organizer') || Object.keys(me.permissions?.competitions ?? {}).length > 0,
)

const rowClass = 'flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent'
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar title="More" :show-title="scrolledPast" :back="false" />

    <main class="mx-auto w-full max-w-3xl space-y-5 px-4 pt-[calc(var(--chrome-top)+0.25rem)]">
      <header ref="titleEl">
        <h1 class="text-display">More</h1>
      </header>

      <!-- Account -->
      <section class="bg-card overflow-hidden rounded-2xl border shadow-sm">
        <template v-if="auth.isSignedIn">
          <RouterLink :to="{ name: 'profile' }" :class="rowClass">
            <img v-if="avatar" :src="avatar" alt="" class="size-12 shrink-0 rounded-full" />
            <span v-else class="bg-primary text-primary-foreground flex size-12 shrink-0 items-center justify-center rounded-full text-lg font-extrabold">
              {{ initials }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[1.0625rem] font-extrabold">{{ me.displayName ?? 'Your account' }}</span>
              <span class="text-muted-foreground block truncate text-sm">{{ me.email }}</span>
            </span>
            <ChevronRight class="text-muted-foreground size-5" />
          </RouterLink>
          <button type="button" :class="[rowClass, 'border-t']" @click="roles.open()">
            <span class="min-w-0 flex-1">
              <span class="block text-base font-bold">How you use ScotDance</span>
              <span class="text-muted-foreground block truncate text-sm">{{ rolesLabel }}</span>
            </span>
            <ChevronRight class="text-muted-foreground size-5" />
          </button>
        </template>
        <div v-else class="space-y-3 p-4">
          <p class="text-base"><b>Not signed in.</b> Sign in to follow dancers and get alerts.</p>
          <button
            type="button"
            class="bg-primary text-primary-foreground h-12 w-full rounded-xl text-base font-bold"
            @click="auth.openLogin({ reason: 'account' })"
          >
            Sign in
          </button>
        </div>
      </section>

      <!-- Alerts -->
      <section class="space-y-2">
        <h2 class="text-heading">Alerts</h2>
        <div class="bg-card overflow-hidden rounded-2xl border shadow-sm">
          <button type="button" role="switch" :aria-checked="alerts.enabled.value" :class="rowClass" @click="alerts.enabled.value = !alerts.enabled.value">
            <Bell class="text-primary size-5 shrink-0" />
            <span class="min-w-0 flex-1">
              <span class="block text-base font-bold">Live result alerts</span>
              <span class="text-muted-foreground block text-sm">A banner when a dancer you follow places, while ScotDance is open</span>
            </span>
            <span
              :class="[
                'relative h-7 w-12 shrink-0 rounded-full transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform',
                alerts.enabled.value ? 'bg-primary after:translate-x-5' : 'bg-strong',
              ]"
              aria-hidden="true"
            />
          </button>
        </div>
      </section>

      <!-- Display -->
      <section class="space-y-2">
        <h2 class="text-heading">Display</h2>
        <div class="bg-card space-y-2 rounded-2xl border p-4 shadow-sm">
          <div class="space-y-2">
            <p class="flex items-center gap-2 text-base font-bold"><Sun class="text-primary size-5" /> Appearance</p>
            <p class="text-muted-foreground text-sm">Automatic follows your phone. Text size follows your phone’s settings too.</p>
            <div class="bg-muted grid grid-cols-3 rounded-xl border p-1" role="group" aria-label="Appearance">
              <button
                v-for="t in THEMES"
                :key="t.id"
                type="button"
                :aria-pressed="theme === t.id"
                :class="[
                  'h-10 rounded-lg text-[0.9375rem] font-bold transition-colors',
                  theme === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                ]"
                @click="theme = t.id"
              >
                {{ t.label }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Browse -->
      <section class="space-y-2">
        <h2 class="text-heading">Browse</h2>
        <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
          <li>
            <RouterLink :to="{ name: 'dancers' }" :class="rowClass">
              <Users class="text-primary size-5" /><span class="flex-1 text-base font-bold">Dancers</span><ChevronRight class="text-muted-foreground size-5" />
            </RouterLink>
          </li>
          <li>
            <RouterLink :to="{ name: 'judges' }" :class="rowClass">
              <Gavel class="text-primary size-5" /><span class="flex-1 text-base font-bold">Judges</span><ChevronRight class="text-muted-foreground size-5" />
            </RouterLink>
          </li>
          <li>
            <RouterLink :to="{ name: 'pipers' }" :class="rowClass">
              <Music class="text-primary size-5" /><span class="flex-1 text-base font-bold">Pipers</span><ChevronRight class="text-muted-foreground size-5" />
            </RouterLink>
          </li>
          <li>
            <RouterLink :to="{ name: 'venues' }" :class="rowClass">
              <School class="text-primary size-5" /><span class="flex-1 text-base font-bold">Venues</span><ChevronRight class="text-muted-foreground size-5" />
            </RouterLink>
          </li>
        </ul>
      </section>

      <!-- Help -->
      <section class="space-y-2">
        <h2 class="text-heading">Help</h2>
        <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
          <li v-if="update.updateAvailable">
            <button type="button" :class="rowClass" @click="update.openDialog()">
              <ArrowDownToLine class="text-secondary size-5" />
              <span class="flex-1 text-base font-bold">Update available</span>
              <span class="bg-secondary size-2.5 rounded-full" aria-hidden="true" />
            </button>
          </li>
          <li>
            <RouterLink :to="{ name: 'about', hash: '#faqs' }" :class="rowClass">
              <MessageCircleQuestion class="text-primary size-5" /><span class="flex-1 text-base font-bold">Questions and answers</span><ChevronRight class="text-muted-foreground size-5" />
            </RouterLink>
          </li>
          <li v-if="crisp.available">
            <button type="button" :class="rowClass" @click="crisp.open()">
              <LifeBuoy class="text-primary size-5" />
              <span class="flex-1 text-base font-bold">Send feedback or get help</span>
              <span v-if="crisp.unread > 0" class="bg-secondary text-secondary-foreground rounded-full px-2 text-sm font-bold">{{ crisp.unread }}</span>
            </button>
          </li>
          <li>
            <RouterLink :to="{ name: 'about' }" :class="rowClass">
              <Info class="text-primary size-5" /><span class="flex-1 text-base font-bold">About ScotDance</span><ChevronRight class="text-muted-foreground size-5" />
            </RouterLink>
          </li>
          <li>
            <RouterLink :to="{ name: 'policies' }" :class="rowClass">
              <FileText class="text-primary size-5" /><span class="flex-1 text-base font-bold">Privacy and terms</span><ChevronRight class="text-muted-foreground size-5" />
            </RouterLink>
          </li>
          <li v-if="canManage">
            <a href="/admin" target="_blank" rel="noopener" :class="rowClass">
              <ExternalLink class="text-primary size-5" /><span class="flex-1 text-base font-bold">Manage competitions</span>
            </a>
          </li>
          <li v-if="auth.isSignedIn">
            <button type="button" :class="rowClass" @click="auth.signOut()">
              <LogOut class="text-destructive size-5" /><span class="text-destructive flex-1 text-base font-bold">Sign out</span>
            </button>
          </li>
        </ul>
      </section>

      <p class="text-muted-foreground pb-2 text-center text-sm">
        ScotDance {{ update.currentVersion }} · Run by a volunteer
      </p>
    </main>
  </div>
</template>
