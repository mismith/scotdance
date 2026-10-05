<script lang="ts">
import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useAlerts } from '@/composables/useAlerts'

// Asking to send notifications, the moment they'd mean something: just after
// following a dancer. The phone's own prompt shows only once, so this comes
// first and says what they're for; "Not now" leaves the phone's prompt
// unspent, for Settings later.

const asking = ref<{ firstName: string } | null>(null)
const asked = useLocalStorage<number | null>('alerts:asked', null)

/** After following someone: ask, if this phone hasn't been asked yet. */
export function askForAlerts(firstName: string) {
  const alerts = useAlerts()
  if (!alerts.canAsk.value || asked.value) return
  asking.value = { firstName: firstName.trim() || 'your dancer' }
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/Dialog.vue'
import NotificationCard from '@/components/NotificationCard.vue'
import { toast } from '@/lib/admin/feedback'

const alerts = useAlerts()
const open = computed(() => !!asking.value)
const name = computed(() => asking.value?.firstName ?? 'your dancer')

function close() {
  asked.value = Date.now()
  asking.value = null
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
  <Dialog :open="open" variant="sheet" :morph="false" @close="close">
    <div class="space-y-5 p-5 pb-[calc(1.25rem+var(--safe-bottom))] text-center">
      <div class="bg-blue-paper relative -mx-5 -mt-5 overflow-hidden px-6 pt-8 pb-6" aria-hidden="true">
        <NotificationCard :title="`${name} placed 1st`" body="Highland Fling · Novice 9 & 10 Years · Foothills Fall Classic" class="mx-auto max-w-sm" />
        <NotificationCard title="Sword Dance results are in" body="Novice 9 & 10 Years · Foothills Fall Classic" when="2m ago" class="mx-auto mt-2 max-w-sm scale-[0.96] opacity-70" />
      </div>
      <div class="space-y-2">
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
