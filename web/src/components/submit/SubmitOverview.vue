<script setup lang="ts">
import { ref, useId } from 'vue'
import Button from '@/components/ui/Button.vue'
import { grow, shrink } from '@/lib/admin/motion'
import { CalendarClock, ChevronDown, ClipboardList, FileSpreadsheet, Laptop, MailCheck, Pointer, Wifi } from '@lucide/vue'

// Before the first step: the four steps and how long approval takes, so it
// reads as quick. What's needed later stays tucked away until asked for.
// Signed out, the way in is signing in.

defineProps<{ steps: Array<{ title: string; asks: string }>; signedIn: boolean }>()
defineEmits<{ start: [] }>()

const NEEDS = [
  {
    title: 'Before the competition',
    items: [
      { icon: CalendarClock, lead: 'A month or so.', rest: ' Submitting a month or more ahead leaves time to add everything.' },
      { icon: ClipboardList, lead: 'Your program.', rest: ' Everything in it goes into the app, from age groups to the schedule.' },
      { icon: FileSpreadsheet, lead: 'Your entry list.', rest: ' Import your dancers from Excel or Google Sheets, or add them one at a time.' },
    ],
  },
  {
    title: 'On the day',
    items: [
      { icon: Laptop, lead: 'A laptop or tablet.', rest: ' A phone works, but entering results is much easier on a bigger screen.' },
      { icon: Wifi, lead: 'Wi-Fi or mobile signal', rest: ' where results are entered, like the announcer’s desk.' },
      { icon: Pointer, lead: 'A volunteer', rest: ' to enter results as they’re announced. It’s much like following along in the app: listen, and tap.' },
    ],
  },
]

const id = useId()
// For the page, so the bar can take over the title once it scrolls away.
const title = ref<HTMLElement | null>(null)
defineExpose({ title })
const open = ref(new Set<string>())
function toggle(title: string) {
  const next = new Set(open.value)
  if (!next.delete(title)) next.add(title)
  open.value = next
}
</script>

<template>
  <div class="space-y-6">
    <header class="space-y-2">
      <h1 ref="title" class="text-display">Submit a competition</h1>
      <p class="text-muted-foreground text-base">Free, and it takes a few minutes. If you have an info sheet, you’re mostly done already.</p>
    </header>

    <div class="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start lg:gap-x-10 lg:space-y-0">
      <div class="space-y-6">
        <div class="space-y-3">
          <ol class="surface divide-y rounded-2xl">
            <li v-for="(s, i) in steps" :key="s.title" class="flex items-center gap-3 px-4 py-2.5">
              <span class="bg-blue-paper text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold">{{ i + 1 }}</span>
              <span class="w-20 shrink-0 text-base font-semibold">{{ s.title }}</span>
              <span class="text-muted-foreground min-w-0 text-sm">{{ s.asks }}</span>
            </li>
          </ol>
          <p class="text-muted-foreground flex gap-3 px-1 text-callout">
            <MailCheck class="text-primary mt-0.5 size-5 shrink-0" />
            Usually approved overnight. You’ll get an email.
          </p>
        </div>

        <div class="space-y-2">
          <Button variant="primary" size="lg" class="max-sm:w-full sm:px-8" @click="$emit('start')">
            {{ signedIn ? 'Start' : 'Sign in to submit' }}
          </Button>
          <p v-if="!signedIn" class="text-muted-foreground text-sm">Any email address works. You’ll manage the competition from the same account.</p>
        </div>
      </div>

      <section class="space-y-3">
        <h2 class="text-heading">What you’ll need</h2>
        <ul class="surface divide-y overflow-hidden rounded-2xl">
          <li v-for="(group, g) in NEEDS" :key="group.title">
            <button
              type="button"
              class="press-row focus-inset flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
              :aria-expanded="open.has(group.title)"
              :aria-controls="`${id}-${g}`"
              @click="toggle(group.title)"
            >
              <span class="flex-1 text-base font-semibold">{{ group.title }}</span>
              <ChevronDown :class="['text-muted-foreground size-5 shrink-0 transition-transform duration-(--dur-base) ease-snappy', open.has(group.title) && 'rotate-180']" />
            </button>
            <!-- Opens to its height, rather than jumping. -->
            <Transition :css="false" @enter="grow" @leave="shrink">
              <ul v-if="open.has(group.title)" :id="`${id}-${g}`" class="space-y-3 px-4 pb-4">
                <li v-for="item in group.items" :key="item.lead" class="text-callout flex gap-3">
                  <component :is="item.icon" class="text-primary mt-0.5 size-5 shrink-0" />
                  <span class="text-muted-foreground"><b class="text-foreground font-semibold">{{ item.lead }}</b>{{ item.rest }}</span>
                </li>
              </ul>
            </Transition>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
