<script setup lang="ts">
import { ClipboardList, FileSpreadsheet, Laptop, MailCheck, Pointer, Printer, Users, Wifi } from '@lucide/vue'

// Before the first step: the whole process, from today to competition day,
// so it reads as quick and nothing comes as a surprise later. Signed out,
// the way in is signing in.

defineProps<{ steps: Array<{ title: string; asks: string }>; signedIn: boolean }>()
defineEmits<{ start: [] }>()

const APPROVAL = { icon: MailCheck, lead: 'Then it’s approved,', rest: ' usually overnight and within a week at most. You’ll get an email.' }
const LATER = [
  {
    title: 'Before the competition',
    items: [
      { icon: ClipboardList, lead: 'The details.', rest: ' Everything in a paper program goes into the app, in Manage once it’s approved.' },
      { icon: FileSpreadsheet, lead: 'Your dancers.', rest: ' Import them from an Excel sheet, or add them in Manage.' },
    ],
  },
  {
    title: 'On the day',
    items: [
      { icon: Laptop, lead: 'A laptop or tablet.', rest: ' A phone works, but entering results is much easier on a bigger screen.' },
      { icon: Wifi, lead: 'Wi-Fi or mobile signal', rest: ' where results are entered, like the announcer’s desk.' },
      { icon: Pointer, lead: 'A volunteer entering results', rest: ' as they’re announced. It’s much like following along in the app: listen, and tap.' },
      { icon: Printer, lead: 'Printed results sheets,', rest: ' so nothing’s missed.' },
      { icon: Users, lead: 'A partner', rest: ' to check for mistakes.' },
    ],
  },
]
</script>

<template>
  <div class="space-y-7">
    <header class="space-y-2">
      <h1 class="text-display">Submit a competition</h1>
      <p class="text-muted-foreground text-base">
        Run a Highland dancing competition? Add it here so dancers and families can follow along: the schedule, dancing order and results, live. It saves hours of work and paper, and it’s free.
      </p>
    </header>

    <section class="space-y-3">
      <div class="space-y-1">
        <h2 class="text-heading">Today</h2>
        <p class="text-muted-foreground text-sm">
          Best done a month or more before the competition. It takes a few minutes, and if you have an info sheet, you’re mostly done already. You can change anything later.
        </p>
      </div>
      <ol class="bg-card divide-y rounded-2xl border shadow-sm">
        <li v-for="(s, i) in steps" :key="s.title" class="flex items-center gap-3 px-4 py-3">
          <span class="bg-blue-paper text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-[0.9375rem] font-extrabold">{{ i + 1 }}</span>
          <span>
            <span class="block text-base font-bold">{{ s.title }}</span>
            <span class="text-muted-foreground block text-sm">{{ s.asks }}</span>
          </span>
        </li>
      </ol>
      <p class="flex gap-3 px-1 text-[0.9375rem]">
        <component :is="APPROVAL.icon" class="text-primary mt-0.5 size-5 shrink-0" />
        <span class="text-muted-foreground"><b class="text-foreground">{{ APPROVAL.lead }}</b>{{ APPROVAL.rest }}</span>
      </p>
    </section>

    <div class="space-y-2">
      <button type="button" class="bg-primary text-primary-foreground h-12 w-full rounded-xl px-8 text-base font-bold sm:w-auto" @click="$emit('start')">
        {{ signedIn ? 'Start' : 'Sign in to submit' }}
      </button>
      <p v-if="!signedIn" class="text-muted-foreground text-sm">Any email address works. You’ll manage the competition from the same account once it’s approved.</p>
    </div>

    <section v-for="group in LATER" :key="group.title" class="space-y-3">
      <h2 class="text-heading">{{ group.title }}</h2>
      <ul class="space-y-3">
        <li v-for="item in group.items" :key="item.lead" class="flex gap-3 px-1 text-[0.9375rem]">
          <component :is="item.icon" class="text-primary mt-0.5 size-5 shrink-0" />
          <span class="text-muted-foreground"><b class="text-foreground">{{ item.lead }}</b>{{ item.rest }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
