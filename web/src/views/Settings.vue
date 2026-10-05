<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { Bell, BellOff, BellRing, History, Smartphone, Sun } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import Segmented from '@/components/ui/Segmented.vue'
import Switch from '@/components/ui/Switch.vue'
import { useScrolledPast } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import { useTheme, type Theme } from '@/composables/useTheme'
import { ALERT_KINDS, useAlerts } from '@/composables/useAlerts'
import { platform } from '@/lib/native'
import { useAuthStore } from '@/stores/auth'
import { clearDeviceHistory } from '@/lib/deviceHistory'
import { confirm, toast } from '@/lib/admin/feedback'
import { isNative } from '@/lib/native'
import { startViewTransition } from '@/lib/transition'

// Settings: alerts, appearance and this device. Your account (and how you
// use ScotDance, and signing out) lives on the Account page; help, the
// questions and the fine print are on About.
usePageTitle(['Settings'])

const alerts = useAlerts()
const auth = useAuthStore()
// Notifications need an account (they follow your dancers) and a phone.
async function setPush(on: boolean) {
  if (!auth.isSignedIn) return auth.openLogin({ reason: 'account' })
  if (!on) {
    await alerts.turnOff()
    return
  }
  const state = await alerts.turnOn()
  if (state === 'blocked') toast('Notifications are off for ScotDance in your phone’s settings.')
  else if (state === 'failed') toast('Notifications couldn’t be turned on. Try again in a moment.')
}
const pushHint = computed(() => {
  if (!auth.isSignedIn) return 'Sign in to get them for the dancers you follow'
  if (alerts.push.value === 'blocked')
    return platform === 'android' ? 'Off for ScotDance in your phone’s settings. Turn them on under Apps › ScotDance › Notifications.' : 'Off for ScotDance in your iPhone’s settings. Turn them on under Settings › ScotDance › Notifications.'
  if (alerts.push.value === 'on') return 'On for this phone, even with ScotDance closed'
  return 'Results, the morning of, and when dancers are listed, even with ScotDance closed'
})
const pushId = useId()
const { theme } = useTheme()
// A new appearance cross-fades in rather than snapping.
async function setTheme(next: Theme) {
  if (next === theme.value) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return void (theme.value = next)
  startViewTransition(async () => {
    theme.value = next
    await nextTick()
  }, ['theme'])
}

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
        <!-- Notifications, in the apps: on for this phone, then which kinds
             (those go with your account, so every phone you use agrees). -->
        <div v-if="alerts.push.value !== 'unavailable'" class="surface overflow-hidden rounded-2xl">
          <label :for="pushId" :class="rowClass">
            <component :is="alerts.push.value === 'blocked' ? BellOff : BellRing" class="text-primary" />
            <span class="min-w-0 flex-1">
              <span :id="`${pushId}-label`" class="block text-base font-medium">Notifications</span>
              <span :id="`${pushId}-hint`" class="text-muted-foreground block text-sm">{{ pushHint }}</span>
            </span>
            <Switch
              :id="pushId"
              :model-value="alerts.push.value === 'on'"
              :disabled="alerts.busy.value || alerts.push.value === 'blocked'"
              :aria-labelledby="`${pushId}-label`"
              :aria-describedby="`${pushId}-hint`"
              @update:model-value="setPush"
            />
          </label>
          <Transition
            enter-active-class="transition-[grid-template-rows,opacity] duration-(--dur-base) ease-snappy"
            enter-from-class="grid-rows-[0fr] opacity-0"
            enter-to-class="grid-rows-[1fr]"
            leave-active-class="transition-[grid-template-rows,opacity] duration-(--dur-quick) ease-exit"
            leave-from-class="grid-rows-[1fr]"
            leave-to-class="grid-rows-[0fr] opacity-0"
          >
            <div v-if="alerts.push.value === 'on'" class="grid">
              <ul class="min-h-0 overflow-hidden border-t pl-12" aria-label="Which notifications">
                <li v-for="k in ALERT_KINDS" :key="k.id" class="border-b last:border-b-0">
                  <label :for="`${pushId}-${k.id}`" class="press-row focus-inset flex min-h-14 w-full items-center gap-3 py-2 pr-4 text-left">
                    <span class="min-w-0 flex-1">
                      <span :id="`${pushId}-${k.id}-label`" class="block text-base font-medium">{{ k.label }}</span>
                      <span class="text-muted-foreground block text-sm">{{ k.hint }}</span>
                    </span>
                    <Switch :id="`${pushId}-${k.id}`" v-model="alerts.kinds[k.id].value" :aria-labelledby="`${pushId}-${k.id}-label`" />
                  </label>
                </li>
              </ul>
            </div>
          </Transition>
        </div>

        <!-- The whole row toggles: the label is for the switch. -->
        <label :for="alertsId" :class="['surface overflow-hidden rounded-2xl', rowClass]">
          <Bell class="text-primary" />
          <span class="min-w-0 flex-1">
            <span :id="`${alertsId}-label`" class="block text-base font-medium">{{ alerts.push.value === 'unavailable' ? 'Live result alerts' : 'While the app is open' }}</span>
            <span :id="`${alertsId}-hint`" class="text-muted-foreground block text-sm">{{ alerts.push.value === 'unavailable' ? 'A banner when a dancer you follow places, while ScotDance.app is open' : 'A banner when a dancer you follow places' }}</span>
          </span>
          <Switch
            :id="alertsId"
            v-model="alerts.enabled.value"
            :aria-labelledby="`${alertsId}-label`"
            :aria-describedby="`${alertsId}-hint`"
          />
        </label>
        <p v-if="alerts.push.value === 'unavailable'" class="text-muted-foreground flex items-start gap-2 px-1 text-sm">
          <Smartphone class="mt-0.5 size-4 shrink-0" aria-hidden="true" /> The ScotDance app for iPhone and Android can also send these as notifications, even when it’s closed.
        </p>
      </section>

      <!-- Display -->
      <section class="space-y-2">
        <h2 class="text-heading">Display</h2>
        <div class="surface space-y-3 rounded-2xl p-4">
          <div class="space-y-1">
            <p class="flex items-center gap-3 text-base font-medium"><Sun class="text-primary size-5" /> Appearance</p>
            <!-- Only the app can follow the phone's text size; a browser has its own zoom. -->
            <p class="text-muted-foreground pl-8 text-sm">
              <template v-if="isNative">Automatic follows your phone. Text size follows your phone’s settings too.</template>
              <template v-else>Automatic follows your device. To make text bigger, zoom in your browser.</template>
            </p>
          </div>
          <Segmented :model-value="theme" :options="THEMES" label="Appearance" @update:model-value="setTheme" />
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
    </main>
  </div>
</template>
