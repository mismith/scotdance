<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ArrowDownToLine,
  Bell,
  ChevronRight,
  FileText,
  History,
  Info,
  LifeBuoy,
  MessageCircleQuestion,
  Sun,
} from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import { useScrolledPast } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import { useTheme, type Theme } from '@/composables/useTheme'
import { useAlerts } from '@/composables/useAlerts'
import { useCrisp } from '@/composables/useCrisp'
import { useUpdate } from '@/composables/useUpdate'
import { clearDeviceHistory } from '@/lib/deviceHistory'
import { confirm, toast } from '@/lib/admin/feedback'

// Settings: alerts, appearance, help and the fine print. Your account (and
// how you use ScotDance, and signing out) lives on the Account page; the
// everyday places are in the More menu on the tab bar.
usePageTitle(['Settings'])

const alerts = useAlerts()
const crisp = useCrisp()
const update = useUpdate()
const { theme } = useTheme()

const titleEl = ref<HTMLElement | null>(null)
const scrolledPast = useScrolledPast(titleEl)

const THEMES: Array<{ id: Theme; label: string }> = [
  { id: 'auto', label: 'Automatic' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

const rowClass = 'flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent'

// Everything this device remembers of where you've been (lib/deviceHistory),
// so a shared or borrowed phone can be tidied in one go.
async function clearHistory() {
  const ok = await confirm({
    title: 'Clear history on this device?',
    message: 'Recent searches, recently viewed, and the copies kept for offline use. Your account, the dancers you follow and your settings stay.',
    confirmLabel: 'Clear history',
    destructive: true,
  })
  if (!ok) return
  await clearDeviceHistory()
  toast('History cleared')
}
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar title="Settings" :show-title="scrolledPast" :fallback="{ to: { name: 'home' }, label: 'Home' }" />

    <main class="mx-auto w-full max-w-3xl space-y-5 px-4 pt-[calc(var(--chrome-top)+0.25rem)]">
      <header ref="titleEl">
        <h1 class="text-display">Settings</h1>
      </header>

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

      <!-- This device -->
      <section class="space-y-2">
        <h2 class="text-heading">This device</h2>
        <div class="bg-card overflow-hidden rounded-2xl border shadow-sm">
          <button type="button" :class="rowClass" @click="clearHistory">
            <History class="text-primary size-5 shrink-0" />
            <span class="min-w-0 flex-1">
              <span class="block text-base font-bold">Clear history</span>
              <span class="text-muted-foreground block text-sm">Recent searches, recently viewed, and copies kept for offline use</span>
            </span>
          </button>
        </div>
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
            <RouterLink :to="{ name: 'about' }" :class="rowClass">
              <Info class="text-primary size-5" /><span class="flex-1 text-base font-bold">About ScotDance</span><ChevronRight class="text-muted-foreground size-5" />
            </RouterLink>
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
            <RouterLink :to="{ name: 'policies' }" :class="rowClass">
              <FileText class="text-primary size-5" /><span class="flex-1 text-base font-bold">Privacy and terms</span><ChevronRight class="text-muted-foreground size-5" />
            </RouterLink>
          </li>
        </ul>
      </section>

      <p class="text-muted-foreground pb-2 text-center text-sm">
        ScotDance {{ update.currentVersion }} · Run by a volunteer
      </p>
    </main>
  </div>
</template>
