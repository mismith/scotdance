<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  FilePen,
  Laptop,
  MailCheck,
  Pointer,
  ListChecks,
  SquarePlus,
  Wifi,
} from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import { formatLongDate } from '@/lib/format'
import { useMorph } from '@/lib/morph'

// Before the first question: what it takes and what happens after, as three
// stops, so it reads as quick. The page's own button (Start) sits at the
// foot like every question's. What's needed later is in a sheet.

const props = defineProps<{
  /** What's saved and not yet sent, if anything. */
  draft: { name: string; date: string } | null
}>()
defineEmits<{ startOver: [] }>()

// What happens, in order: the quick part here, then the rest in Manage.
const STOPS = [
  { icon: SquarePlus, title: 'Add it', text: 'When, where and what it’s called. That’s all for now.' },
  { icon: MailCheck, title: 'Approved', text: 'Usually overnight. You’ll get an email with a link.' },
  { icon: ListChecks, title: 'Add the rest', text: 'Dancers, the schedule and results, whenever you’re ready.' },
]

const NEEDS = [
  {
    title: 'Before the competition',
    items: [
      {
        icon: CalendarClock,
        lead: 'A month or so.',
        rest: ' Adding it a month or more ahead leaves time to add everything.',
      },
      {
        icon: ClipboardList,
        lead: 'Your program.',
        rest: ' Everything in it goes into the app, from age groups to the schedule.',
      },
      {
        icon: FileSpreadsheet,
        lead: 'Your entry list.',
        rest: ' Import your dancers from Excel or Google Sheets, or add them one at a time.',
      },
    ],
  },
  {
    title: 'On the day',
    items: [
      {
        icon: Laptop,
        lead: 'A laptop or tablet.',
        rest: ' A phone works, but entering results is much easier on a bigger screen.',
      },
      {
        icon: Wifi,
        lead: 'Wi-Fi or mobile signal',
        rest: ' where results are entered, like the announcer’s desk.',
      },
      {
        icon: Pointer,
        lead: 'A volunteer',
        rest: ' to enter results as they’re announced. It’s much like following along in the app: listen, and tap.',
      },
    ],
  },
]

// The draft, as far as it got: its name and day, or just that there is one.
const draftLine = computed(() => (props.draft?.date ? formatLongDate(props.draft.date) : 'Not sent yet'))

const needs = useMorph()
// For the page, so the bar can take over the title once it scrolls away.
const title = ref<HTMLElement | null>(null)
defineExpose({ title })
</script>

<template>
  <div class="space-y-6">
    <header class="space-y-2">
      <h1 ref="title" tabindex="-1" class="text-hero outline-none">
        Add your competition
      </h1>
      <p class="text-muted-foreground flex items-center gap-2 text-base">
        <Clock class="text-primary size-5 shrink-0" aria-hidden="true" />
        Free, and about 2 minutes.
      </p>
    </header>

    <ol aria-label="What happens">
      <li
        v-for="(stop, i) in STOPS"
        :key="stop.title"
        class="relative flex gap-3.5 py-3"
      >
        <!-- The line from one stop down to the next. -->
        <span
          v-if="i < STOPS.length - 1"
          class="bg-border absolute top-[3.25rem] -bottom-3 left-[1.1875rem] w-0.5"
          aria-hidden="true"
        />
        <span
          class="bg-blue-paper text-primary relative flex size-10 shrink-0 items-center justify-center rounded-full"
          aria-hidden="true"
        >
          <component :is="stop.icon" class="size-5" stroke-width="2.2" />
        </span>
        <span class="min-w-0 pt-0.5">
          <span class="block text-base font-semibold">{{ stop.title }}</span>
          <span class="text-muted-foreground text-callout block text-pretty">{{
            stop.text
          }}</span>
        </span>
      </li>
    </ol>

    <!-- Left part-way: what's saved, to pick up (the page's button) or drop. -->
    <div v-if="draft" class="-mr-2 flex items-center gap-3.5">
      <!-- (Its text lines up with the stops' above.) -->
      <span class="flex w-10 shrink-0 justify-center" aria-hidden="true"><FilePen class="text-primary size-5" /></span>
      <span class="min-w-0 flex-1 py-1">
        <span class="block truncate text-base font-semibold">{{ draft.name.trim() || 'Your competition' }}</span>
        <span class="text-muted-foreground block truncate text-callout">{{ draftLine }}</span>
      </span>
      <button
        type="button"
        class="press-row text-primary text-callout flex min-h-11 shrink-0 items-center rounded-full px-3 font-semibold"
        @click="$emit('startOver')"
      >
        Start over
      </button>
    </div>

    <div class="-mx-4">
      <button
        type="button"
        class="press-row text-primary text-callout flex min-h-11 items-center gap-1 rounded-full px-4 font-semibold"
        @click="needs.show($event)"
      >
        What you’ll need <ChevronRight class="size-4" stroke-width="2.4" />
      </button>
    </div>

    <Dialog
      :open="needs.open"
      :morph="needs"
      variant="sheet"
      size="md"
      @close="needs.hide()"
    >
      <template #header>
        <h2 class="text-title">What you’ll need</h2>
      </template>
      <div class="space-y-5 px-4 pt-1 pb-[calc(1.5rem+var(--safe-bottom))]">
        <section v-for="group in NEEDS" :key="group.title" class="space-y-3">
          <h3 class="text-heading">{{ group.title }}</h3>
          <ul class="space-y-3">
            <li
              v-for="item in group.items"
              :key="item.lead"
              class="text-callout flex gap-3"
            >
              <component
                :is="item.icon"
                class="text-primary mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <span class="text-muted-foreground"
                ><b class="text-foreground font-semibold">{{ item.lead }}</b
                >{{ item.rest }}</span
              >
            </li>
          </ul>
        </section>
      </div>
    </Dialog>
  </div>
</template>
