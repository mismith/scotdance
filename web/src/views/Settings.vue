<script setup lang="ts">
import { ref, useId } from 'vue'
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
import Segmented from '@/components/ui/Segmented.vue'
import Switch from '@/components/ui/Switch.vue'
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

const THEMES: Array<{ value: Theme; label: string }> = [
  { value: 'auto', label: 'Automatic' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const alertsId = useId()

// One row anatomy (as in the More menu): icon, label, then whatever ends it.
const rowClass =
  'press-row focus-inset flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left [&>svg]:size-5 [&>svg]:shrink-0'

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
        <!-- The whole row toggles: the label is for the switch. -->
        <label :for="alertsId" :class="['surface overflow-hidden rounded-2xl', rowClass]">
          <Bell class="text-primary" />
          <span class="min-w-0 flex-1">
            <span :id="`${alertsId}-label`" class="block text-base font-medium">Live result alerts</span>
            <span :id="`${alertsId}-hint`" class="text-muted-foreground block text-sm">A banner when a dancer you follow places, while ScotDance is open</span>
          </span>
          <Switch
            :id="alertsId"
            v-model="alerts.enabled.value"
            :aria-labelledby="`${alertsId}-label`"
            :aria-describedby="`${alertsId}-hint`"
          />
        </label>
      </section>

      <!-- Display -->
      <section class="space-y-2">
        <h2 class="text-heading">Display</h2>
        <div class="surface space-y-3 rounded-2xl p-4">
          <div class="space-y-1">
            <p class="flex items-center gap-3 text-base font-medium"><Sun class="text-primary size-5" /> Appearance</p>
            <p class="text-muted-foreground pl-8 text-sm">Automatic follows your phone. Text size follows your phone’s settings too.</p>
          </div>
          <Segmented v-model="theme" :options="THEMES" label="Appearance" />
        </div>
      </section>

      <!-- This device -->
      <section class="space-y-2">
        <h2 class="text-heading">This device</h2>
        <div class="surface overflow-hidden rounded-2xl">
          <button type="button" :class="rowClass" @click="clearHistory">
            <History class="text-primary" />
            <span class="min-w-0 flex-1">
              <span class="block text-base font-medium">Clear history</span>
              <span class="text-muted-foreground block text-sm">Recent searches, recently viewed, and copies kept for offline use</span>
            </span>
          </button>
        </div>
      </section>

      <!-- Help -->
      <section class="space-y-2">
        <h2 class="text-heading">Help</h2>
        <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:3rem]">
          <li v-if="update.updateAvailable">
            <button type="button" :class="rowClass" @click="update.openDialog()">
              <ArrowDownToLine class="text-secondary" />
              <span class="flex-1 text-base font-medium">Update available</span>
              <span class="bg-secondary size-2.5 rounded-full" aria-hidden="true" />
            </button>
          </li>
          <li>
            <RouterLink :to="{ name: 'about' }" :class="rowClass">
              <Info class="text-primary" /><span class="flex-1 text-base font-medium">About ScotDance</span><ChevronRight class="text-muted-foreground/70" />
            </RouterLink>
          </li>
          <li>
            <RouterLink :to="{ name: 'about', hash: '#faqs' }" :class="rowClass">
              <MessageCircleQuestion class="text-primary" /><span class="flex-1 text-base font-medium">Questions and answers</span><ChevronRight class="text-muted-foreground/70" />
            </RouterLink>
          </li>
          <li v-if="crisp.available">
            <button type="button" :class="rowClass" @click="crisp.open()">
              <LifeBuoy class="text-primary" />
              <span class="flex-1 text-base font-medium">Send feedback or get help</span>
              <span v-if="crisp.unread > 0" class="bg-secondary text-secondary-foreground rounded-full px-2 text-sm font-semibold tabular-nums">{{ crisp.unread }}</span>
            </button>
          </li>
          <li>
            <RouterLink :to="{ name: 'policies' }" :class="rowClass">
              <FileText class="text-primary" /><span class="flex-1 text-base font-medium">Privacy and terms</span><ChevronRight class="text-muted-foreground/70" />
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
