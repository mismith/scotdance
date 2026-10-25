<script lang="ts">
import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useAlerts } from '@/composables/useAlerts'

// Asking to send notifications, the moment they'd mean something: just after
// something turns alerts on (favouriting a dancer, a dancer's bell, or a
// competition's). The phone's own prompt shows only once, so this comes
// first and says what they're for; "Not now" leaves the phone's prompt
// unspent, for Settings later, and the in-app banner still shows.

type Asking = { firstName: string } | { competition: string }
const showing = ref(false)
/** What it's asking about (kept while the sheet closes, so its words don't change on the way out). */
const asking = ref<Asking>({ firstName: 'your dancer' })
const asked = useLocalStorage<number | null>('alerts:asked', null)

/**
 * After something turns alerts on: a dancer (by first name) or a
 * competition (by name). Asks, if this phone hasn't been asked yet.
 */
export function askForAlerts(about: { firstName: string } | { competition: string }) {
  const alerts = useAlerts()
  if (!alerts.canAsk.value || asked.value) return
  asking.value =
    'competition' in about
      ? { competition: about.competition.trim() || 'the competition' }
      : { firstName: about.firstName.trim() || 'your dancer' }
  showing.value = true
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/Dialog.vue'
import NotificationCard from '@/components/NotificationCard.vue'
import { toast } from '@/lib/admin/feedback'

const alerts = useAlerts()
const competition = computed(() => ('competition' in asking.value ? asking.value.competition : null))
const name = computed(() => ('firstName' in asking.value ? asking.value.firstName : 'your dancer'))

function close() {
  asked.value = Date.now()
  showing.value = false
}
async function turnOn() {
  const state = await alerts.turnOn()
  close()
  if (state === 'on') toast('Notifications on. Choose which kinds in Settings.')
  else if (state === 'blocked') toast('Notifications are off for ScotDance. You can turn them on in your phone’s settings.')
  else if (state === 'failed') toast('Notifications couldn’t be turned on. Try again from Settings.')
}
</script>

<template>
  <Dialog :open="showing" variant="sheet" :morph="false" @close="close">
    <div class="space-y-5 p-5 pb-[calc(1.25rem+var(--safe-bottom))] text-center">
      <div class="bg-blue-paper relative -mx-5 -mt-5 overflow-hidden px-6 pt-8 pb-6" aria-hidden="true">
        <template v-if="competition">
          <NotificationCard :title="`${competition} is live`" body="The dancer list and schedule are up." class="mx-auto max-w-sm" />
          <NotificationCard :title="`${competition} is today`" body="Tap for platforms and dancing order." when="2m ago" class="mx-auto mt-2 max-w-sm scale-[0.96] opacity-70" />
        </template>
        <template v-else>
          <NotificationCard :title="`${name} placed 1st`" body="Highland Fling · Novice 9 & 10 Years · Foothills Fall Classic" class="mx-auto max-w-sm" />
          <NotificationCard title="Sword Dance results are in" body="Novice 9 & 10 Years · Foothills Fall Classic" when="2m ago" class="mx-auto mt-2 max-w-sm scale-[0.96] opacity-70" />
        </template>
      </div>
      <div v-if="competition" class="space-y-2">
        <h2 class="text-title text-balance">Know when the dancer list is up</h2>
        <p class="text-muted-foreground mx-auto max-w-sm text-base">
          Get a notification when {{ competition }} posts its dancers and schedule, and on the morning of, even with ScotDance closed. You can change it any time in Settings.
        </p>
      </div>
      <div v-else class="space-y-2">
        <h2 class="text-title text-balance">Know the moment {{ name }} places</h2>
        <p class="text-muted-foreground mx-auto max-w-sm text-base">
          Get a notification when results are posted, even with ScotDance closed. You can change it any time in Settings.
        </p>
      </div>
      <div class="space-y-2">
        <Button variant="primary" size="lg" block :busy="alerts.busy.value" @click="turnOn">Turn on notifications</Button>
        <Button variant="plain" size="lg" block @click="close">Not now</Button>
      </div>
    </div>
  </Dialog>
</template>
