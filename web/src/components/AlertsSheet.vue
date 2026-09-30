<script setup lang="ts">
import { computed, ref } from 'vue'
import { Bell } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import { useAlerts } from '@/composables/useAlerts'
import { useAlertsPrompt } from '@/composables/useAlertsPrompt'

// Permission priming: explain what alerts are before the one-shot system
// prompt, and only after someone has followed a dancer.
const prompt = useAlertsPrompt()
const alerts = useAlerts()
const busy = ref(false)
const result = ref<string | null>(null)

const first = computed(() => prompt.forName.value?.split(' ')[0] ?? null)

async function turnOn() {
  busy.value = true
  const channel = await alerts.enable()
  busy.value = false
  if (channel === 'blocked' && alerts.isNative) {
    result.value = 'Notifications are off for ScotDance. Turn them on in your phone’s Settings, then try again.'
    return
  }
  prompt.close()
}
</script>

<template>
  <Dialog :open="prompt.open.value" variant="sheet" @close="prompt.close()">
    <template #header>
      <h2 class="text-title">Know when results are in</h2>
    </template>
    <div class="space-y-4 p-4 pb-[calc(1.5rem+var(--safe-bottom))]">
      <div class="bg-background flex gap-3 rounded-2xl border p-3 shadow-sm" aria-hidden="true">
        <span class="bg-primary flex size-10 shrink-0 items-center justify-center rounded-[10px]">
          <svg viewBox="0 0 40 40" class="size-10"><path d="M9 9 31 31M31 9 9 31" stroke="#fff" stroke-width="5.5" /></svg>
        </span>
        <span class="min-w-0 text-sm">
          <span class="text-muted-foreground flex justify-between text-xs font-bold uppercase">
            <span>ScotDance</span><span>now</span>
          </span>
          <b class="block text-[0.9375rem]">{{ first ?? 'Emma' }} placed 3rd in the Sword Dance</b>
          <span class="text-muted-foreground">Beginners 8</span>
        </span>
      </div>
      <p class="text-base">
        Get an alert when {{ first ?? 'your dancers' }} places, a short summary on competition mornings, and a
        heads-up when a competition’s dancer list goes live. Choose which in More.
      </p>
      <p v-if="result" class="text-destructive text-[0.9375rem] font-semibold" role="alert">{{ result }}</p>
      <button
        type="button"
        class="bg-primary text-primary-foreground flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-bold disabled:opacity-60"
        :disabled="busy"
        @click="turnOn"
      >
        <Bell class="size-5" /> {{ busy ? 'Turning on…' : 'Turn on alerts' }}
      </button>
      <button
        type="button"
        class="bg-card border-strong h-12 w-full rounded-xl border text-base font-bold"
        @click="prompt.close()"
      >
        Not now
      </button>
      <p class="text-muted-foreground text-center text-sm">Change these any time in More, under Notifications.</p>
    </div>
  </Dialog>
</template>
