<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { formatLongDate, formatMonthYear, parseDate } from '@/lib/format'
import { selectionHaptic } from '@/lib/haptics'
import { now } from '@/lib/now'

// One day, picked on a month at a time: the competitions calendar's grid
// (Monday first, today ringed, the chosen day a solid disc that slides from
// cell to cell, months that slide and can be swiped), without its
// competitions. The value is YYYY-MM-DD, or '' for none yet.
const model = defineModel<string>({ default: '' })
defineProps<{ labelledby?: string }>()

const pad = (n: number) => String(n).padStart(2, '0')
const toValue = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const today = startOfDay(now())

const selected = computed(() => {
  if (!model.value) return null
  const d = parseDate(model.value)
  return Number.isNaN(d.getTime()) ? null : d
})
const first = selected.value ?? today
const cursor = ref(new Date(first.getFullYear(), first.getMonth(), 1))
// Which way the month moved, for the slide.
const direction = ref<1 | -1>(1)

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()
const isSelected = (d: Date) => !!selected.value && sameDay(d, selected.value)

const cells = computed(() => {
  const start = new Date(cursor.value)
  const lead = (start.getDay() + 6) % 7
  const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  start.setDate(1 - lead)
  return Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    return {
      date,
      inMonth: date.getMonth() === cursor.value.getMonth(),
      isToday: sameDay(date, today),
    }
  })
})
const monthKey = computed(
  () => `${cursor.value.getFullYear()}-${cursor.value.getMonth()}`,
)

function shiftMonth(delta: 1 | -1) {
  direction.value = delta
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1)
}

function pick(cell: { date: Date; inMonth: boolean }) {
  selectionHaptic()
  if (!cell.inMonth) {
    direction.value = cell.date < cursor.value ? -1 : 1
    cursor.value = new Date(cell.date.getFullYear(), cell.date.getMonth(), 1)
  }
  model.value = toValue(cell.date)
}

// One stop for Tab (the chosen day, or today, or the 1st), and the arrows
// move the choice a day or a week, into the next month as they go.
const grid = ref<HTMLElement | null>(null)
const tabDay = computed(() => {
  const inMonth = (d: Date | null) =>
    !!d &&
    d.getFullYear() === cursor.value.getFullYear() &&
    d.getMonth() === cursor.value.getMonth()
  return inMonth(selected.value) ? selected.value! : inMonth(today) ? today : cursor.value
})
async function onArrow(e: KeyboardEvent) {
  const step = (
    { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 } as Record<string, number>
  )[e.key]
  if (!step) return
  e.preventDefault()
  const from = tabDay.value
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + step)
  pick({
    date,
    inMonth:
      date.getMonth() === cursor.value.getMonth() &&
      date.getFullYear() === cursor.value.getFullYear(),
  })
  await nextTick()
  grid.value?.querySelector<HTMLElement>(`[data-day="${toValue(date)}"]`)?.focus()
}

// The disc sits behind the chosen cell and slides to the next one chosen.
const marker = computed(() => {
  const i = cells.value.findIndex((c) => c.inMonth && isSelected(c.date))
  return i < 0 ? null : { col: i % 7, row: Math.floor(i / 7) }
})

// Two letters, Monday first, in the reader's language.
const dowLabels = Array.from({ length: 7 }, (_, i) =>
  new Date(2024, 0, 1 + i)
    .toLocaleDateString(undefined, { weekday: 'short' })
    .slice(0, 2),
)

// A sideways swipe moves a month; vertical scrolling is left alone.
let swipe: { x: number; y: number } | null = null
function onPointerDown(e: PointerEvent) {
  if (e.pointerType !== 'mouse') swipe = { x: e.clientX, y: e.clientY }
}
function onPointerUp(e: PointerEvent) {
  if (!swipe) return
  const dx = e.clientX - swipe.x
  const dy = e.clientY - swipe.y
  swipe = null
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftMonth(dx < 0 ? 1 : -1)
}
</script>

<template>
  <div
    class="surface max-w-sm space-y-2 rounded-2xl p-3"
    role="group"
    :aria-labelledby="labelledby"
  >
    <div class="flex items-center gap-1 pl-1">
      <p class="text-heading flex-1" aria-live="polite">{{ formatMonthYear(cursor) }}</p>
      <button
        type="button"
        aria-label="Previous month"
        class="press text-primary flex size-11 items-center justify-center rounded-full"
        @click="shiftMonth(-1)"
      >
        <ChevronLeft class="size-5" stroke-width="2.4" />
      </button>
      <button
        type="button"
        aria-label="Next month"
        class="press text-primary flex size-11 items-center justify-center rounded-full"
        @click="shiftMonth(1)"
      >
        <ChevronRight class="size-5" stroke-width="2.4" />
      </button>
    </div>

    <div
      class="text-muted-foreground grid grid-cols-7 text-xs font-medium"
      aria-hidden="true"
    >
      <div v-for="(label, i) in dowLabels" :key="i" class="py-1 text-center">
        {{ label }}
      </div>
    </div>

    <div
      ref="grid"
      class="grid touch-pan-y overflow-hidden"
      @keydown="onArrow"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointercancel="swipe = null"
    >
      <Transition
        :enter-from-class="
          direction > 0 ? 'translate-x-6 opacity-0' : '-translate-x-6 opacity-0'
        "
        :leave-to-class="
          direction > 0 ? '-translate-x-6 opacity-0' : 'translate-x-6 opacity-0'
        "
        enter-active-class="transition-[translate,opacity] duration-(--dur-base) ease-standard motion-reduce:transition-opacity"
        leave-active-class="transition-[translate,opacity] duration-(--dur-quick) ease-exit motion-reduce:transition-opacity"
      >
        <div :key="monthKey" class="relative grid grid-cols-7 gap-1 [grid-area:1/1]">
          <span
            v-if="marker"
            class="bg-primary-fill ease-snappy pointer-events-none absolute top-0 left-0 aspect-square w-[calc((100%-1.5rem)/7)] rounded-full transition-[translate] duration-(--dur-slow) motion-reduce:transition-none"
            :style="{
              translate: `calc(${marker.col} * (100% + 0.25rem)) calc(${marker.row} * (100% + 0.25rem))`,
            }"
            aria-hidden="true"
          />
          <button
            v-for="cell in cells"
            :key="cell.date.getTime()"
            type="button"
            :aria-label="formatLongDate(cell.date.getTime())"
            :aria-pressed="isSelected(cell.date)"
            :data-day="cell.inMonth ? toValue(cell.date) : undefined"
            :tabindex="cell.inMonth && sameDay(cell.date, tabDay) ? 0 : -1"
            :class="[
              'press focus-inset relative aspect-square rounded-full text-base tabular-nums transition-colors',
              // Other months' days: quieter by colour, still readable (not faded).
              !cell.inMonth && 'text-muted-foreground',
              isSelected(cell.date)
                ? 'text-primary-foreground font-bold'
                : cell.inMonth && 'hover:bg-[var(--tint-hover)]',
              cell.isToday &&
                !isSelected(cell.date) &&
                'ring-live text-live font-semibold ring-2 ring-inset',
            ]"
            @click="pick(cell)"
          >
            {{ cell.date.getDate() }}
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>
