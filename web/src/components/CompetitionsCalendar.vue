<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { CalendarOff, ChevronLeft, ChevronRight } from '@lucide/vue'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import CompetitionDateRow from '@/components/CompetitionDateRow.vue'
import { useCompetitionLinks } from '@/composables/useCompetitionLinks'
import { orderLinked, railRows } from '@/lib/linked'
import Skeleton from '@/components/Skeleton.vue'
import Button from '@/components/ui/Button.vue'
import { formatLongDate, formatMonthDay, formatMonthYear, formatShortDate, formatWeekdayShortDate, parseDate } from '@/lib/format'
import { selectionHaptic } from '@/lib/haptics'
import { lateSkeleton } from '@/lib/settle'
import { useFavoritesStore } from '@/stores/favorites'
import { now } from '@/lib/now'

// A month at a time, Monday first (Highland competitions are weekend
// events; a week shouldn't split one). Days with competitions are tinted;
// the chosen day is a solid disc that moves from cell to cell. The months
// either side wait just off screen, so a swipe drags them along under your
// thumb, and the arrows slide them the same way. Beside it on wide screens (below on phones), what's on
// the chosen day, or the whole month.
const props = withDefaults(
  defineProps<{
    competitions: CompetitionListItem[]
    linkTo?: (c: CompetitionListItem) => RouteLocationRaw
    loading?: boolean
  }>(),
  {
    linkTo: (c: CompetitionListItem) => ({
      name: 'competition.info',
      params: { competitionId: c.id },
    }),
  },
)

const favorites = useFavoritesStore()

const DAY = 86_400_000
const today = startOfDay(now())

// The day picked (?date=2026-08-15), or the month with none (?date=2026-08),
// is in the address, so Back from a competition returns to it. Today, the
// default, is left out.
const route = useRoute()
const router = useRouter()
const pad = (n: number) => String(n).padStart(2, '0')
const monthParam = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
function fromParam(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}(-\d{2})?$/.test(value)) return null
  const isDay = value.length > 7
  const d = parseDate(isDay ? value : `${value}-01`)
  if (Number.isNaN(d.getTime())) return null
  return { cursor: new Date(d.getFullYear(), d.getMonth(), 1), selected: isDay ? d : null }
}
const start = fromParam(route.query.date)

const cursor = ref(start?.cursor ?? new Date(today.getFullYear(), today.getMonth(), 1))
const selected = ref<Date | null>(start ? start.selected : new Date(today))

const dateParam = computed(() => {
  if (!selected.value) return monthParam(cursor.value)
  if (selected.value.getTime() === today.getTime()) return undefined
  return `${monthParam(selected.value)}-${pad(selected.value.getDate())}`
})
watch(dateParam, (date) => router.replace({ query: { ...route.query, date } }))

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const monthEvents = computed(() =>
  props.competitions.filter((c) => {
    if (!c.date) return false
    const d = parseDate(c.date)
    return d.getFullYear() === cursor.value.getFullYear() && d.getMonth() === cursor.value.getMonth()
  }),
)

function cellsFor(month: Date) {
  const byDay = new Map<number, number>()
  for (const c of props.competitions) {
    if (!c.date) continue
    const d = parseDate(c.date)
    if (d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth()) byDay.set(d.getDate(), (byDay.get(d.getDate()) ?? 0) + 1)
  }
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const startDow = (first.getDay() + 6) % 7
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const rows = Math.ceil((startDow + last.getDate()) / 7)
  const start = new Date(first)
  start.setDate(1 - startDow)
  return Array.from({ length: rows * 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const inMonth = d.getMonth() === month.getMonth()
    return { date: d, inMonth, isToday: d.getTime() === today.getTime(), eventCount: inMonth ? (byDay.get(d.getDate()) ?? 0) : 0 }
  })
}
const monthFrom = (delta: number) => new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1)
const calendarCells = computed(() => cellsFor(cursor.value))
// The month before, this one and the one after, side by side.
const months = computed(() =>
  [-1, 0, 1].map((delta) => {
    const m = monthFrom(delta)
    return { key: `${m.getFullYear()}-${m.getMonth()}`, current: delta === 0, cells: delta === 0 ? calendarCells.value : cellsFor(m) }
  }),
)

const monthLabel = computed(() => formatMonthYear(cursor.value))

const onDay = (day: Date) => {
  const start = startOfDay(day).getTime()
  return props.competitions
    .filter((c) => {
      if (!c.date) return false
      const t = parseDate(c.date).getTime()
      return t >= start && t < start + DAY
    })
    .sort((a, b) => parseDate(a.date!).getTime() - parseDate(b.date!).getTime())
}

const visibleCompetitions = computed(() =>
  selected.value
    ? onDay(selected.value)
    : [...monthEvents.value].sort((a, b) => parseDate(a.date!).getTime() - parseDate(b.date!).getTime()),
)
// Linked ones together on their rail (ADR 0007 §8); one on its own (as on a
// single day) names the rest of its set.
const { linkOf, othersLine } = useCompetitionLinks()
const railed = (list: CompetitionListItem[]) =>
  railRows(orderLinked(list, linkOf)).map(({ item, rail, alone }) => ({ competition: item, rail, note: alone ? othersLine(item) : null }))

const sectionLabel = computed(() => (selected.value ? formatWeekdayShortDate(selected.value) : monthLabel.value))
const selectedIsToday = computed(() => !!selected.value && selected.value.getTime() === today.getTime())

// The nearest day with competitions after (or, within about two months,
// before) the chosen one, so nobody has to scrub the calendar to find it.
const PREVIOUS_WITHIN = 60 * DAY
function adjacentDay(direction: 'next' | 'prev') {
  if (!selected.value) return null
  const anchor = startOfDay(selected.value).getTime()
  const times = props.competitions
    .filter((c) => !!c.date)
    .map((c) => parseDate(c.date!).getTime())
    .filter((t) => (direction === 'next' ? t >= anchor + DAY : t < anchor && t >= anchor - PREVIOUS_WITHIN))
    .sort((a, b) => (direction === 'next' ? a - b : b - a))
  if (!times.length) return null
  const day = startOfDay(new Date(times[0]))
  const comps = onDay(day)
  const sameYear = day.getFullYear() === cursor.value.getFullYear()
  return { date: day, label: sameYear ? formatMonthDay(day) : formatShortDate(day.getTime()), comps }
}

// Date links keep nearby competitions available without duplicating their lists.
const nextDay = computed(() => adjacentDay('next'))
const previousDay = computed(() => adjacentDay('prev'))
const nearby = computed(() =>
  [
    previousDay.value && { ...previousDay.value, kind: 'Previous' },
    nextDay.value && { ...nextDay.value, kind: 'Next' },
  ].filter((d) => !!d),
)

function goToDay(day: Date) {
  selectionHaptic()
  cursor.value = new Date(day.getFullYear(), day.getMonth(), 1)
  selected.value = startOfDay(day)
}

function moveMonth(delta: 1 | -1) {
  cursor.value = monthFrom(delta)
}
function shiftMonth(delta: 1 | -1) {
  slideTo(delta, () => {
    moveMonth(delta)
    selected.value = null
  })
}

function goToToday() {
  const there = new Date(today.getFullYear(), today.getMonth(), 1)
  cursor.value = there
  selected.value = new Date(today)
}

defineExpose({ goToToday })

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const isSelected = (d: Date) => !!selected.value && sameDay(d, selected.value)

function selectDay(cell: { date: Date; inMonth: boolean }) {
  selectionHaptic()
  if (!cell.inMonth) {
    const day = startOfDay(cell.date)
    slideTo(cell.date < cursor.value ? -1 : 1, () => {
      cursor.value = new Date(day.getFullYear(), day.getMonth(), 1)
      selected.value = day
    })
    return
  }
  selected.value = isSelected(cell.date) ? null : startOfDay(cell.date)
}

// The disc sits behind the chosen cell and slides to the next one chosen.
const marker = computed(() => {
  const i = calendarCells.value.findIndex((c) => c.inMonth && isSelected(c.date))
  return i < 0 ? null : { col: i % 7, row: Math.floor(i / 7) }
})

// Two letters, Monday first, in the reader's language.
const dowLabels = Array.from({ length: 7 }, (_, i) =>
  new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2),
)

// The strip of three months follows a sideways drag (vertical scrolling is
// left to the page); let go past a quarter of the way, or with a flick, and
// it settles on that month, otherwise back. A drag is never also a tap.
const viewport = useTemplateRef<HTMLElement>('viewport')
const offset = ref(0)
const settling = ref(false)
let afterSettle: (() => void) | null = null
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function slideTo(delta: -1 | 0 | 1, then?: () => void) {
  const width = viewport.value?.clientWidth ?? 0
  if (reduceMotion() || !width) {
    offset.value = 0
    then?.()
    return
  }
  const target = -delta * width
  // Already there (a tap, not a drag): nothing to animate, so no transitionend.
  if (offset.value === target) {
    offset.value = 0
    then?.()
    return
  }
  afterSettle = then ?? null
  settling.value = true
  offset.value = target
}
function onSettled(e: TransitionEvent) {
  if (e.target !== e.currentTarget) return
  settling.value = false
  offset.value = 0
  const then = afterSettle
  afterSettle = null
  then?.()
}

let drag: { x: number; y: number; id: number; axis: 'x' | 'y' | null; lastX: number; lastT: number; vx: number } | null = null
let dragged = false
function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'mouse' || settling.value) return
  drag = { x: e.clientX, y: e.clientY, id: e.pointerId, axis: null, lastX: e.clientX, lastT: e.timeStamp, vx: 0 }
  dragged = false
}
function onPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const dx = e.clientX - drag.x
  const dy = e.clientY - drag.y
  if (!drag.axis) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
    drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    if (drag.axis === 'x') (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  if (drag.axis !== 'x') return
  dragged = true
  const dt = e.timeStamp - drag.lastT
  if (dt > 0) drag.vx = (e.clientX - drag.lastX) / dt
  drag.lastX = e.clientX
  drag.lastT = e.timeStamp
  offset.value = dx
}
function onPointerUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const { axis, vx } = drag
  drag = null
  if (axis !== 'x') return
  const width = viewport.value?.clientWidth ?? 1
  const dx = offset.value
  const flick = Math.abs(vx) > 0.4 && Math.sign(vx) === Math.sign(dx)
  if (Math.abs(dx) > width / 4 || (flick && Math.abs(dx) > 16)) {
    const delta = dx < 0 ? 1 : -1
    selectionHaptic()
    slideTo(delta, () => {
      moveMonth(delta)
      selected.value = null
    })
  } else slideTo(0)
}
function onPointerCancel() {
  if (drag?.axis === 'x') slideTo(0)
  drag = null
}
// The tap that ends a drag isn't a tap on a day.
function swallowDragClick(e: MouseEvent) {
  if (!dragged) return
  dragged = false
  e.stopPropagation()
  e.preventDefault()
}
</script>

<template>
  <div class="space-y-5 md:grid md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:items-start md:gap-8 md:space-y-0">
    <div class="mx-auto w-full max-w-sm space-y-3 md:sticky md:top-[calc(var(--chrome-top)+1rem)]">
      <div class="flex items-center gap-1">
        <h2 class="text-section flex-1">{{ monthLabel }}</h2>
        <button
          type="button"
          aria-label="Previous month"
          class="press button-fill flex size-11 items-center justify-center rounded-full"
          @click="shiftMonth(-1)"
        >
          <ChevronLeft class="size-5" />
        </button>
        <button type="button" class="press button-fill h-11 rounded-full px-4 text-callout font-semibold" @click="goToToday">
          Today
        </button>
        <button
          type="button"
          aria-label="Next month"
          class="press button-fill flex size-11 items-center justify-center rounded-full"
          @click="shiftMonth(1)"
        >
          <ChevronRight class="size-5" />
        </button>
      </div>

      <div class="text-muted-foreground grid grid-cols-7 text-xs font-medium" aria-hidden="true">
        <div v-for="(label, i) in dowLabels" :key="i" class="py-1 text-center">{{ label }}</div>
      </div>

      <div
        ref="viewport"
        class="-mx-3 touch-pan-y overflow-hidden"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
        @click.capture="swallowDragClick"
      >
        <div
          :class="['flex w-[300%] items-start', settling && 'transition-transform duration-(--dur-base) ease-snappy']"
          :style="{ transform: `translateX(calc(-100% / 3 + ${offset}px))` }"
          @transitionend="onSettled"
        >
          <div
            v-for="m in months"
            :key="m.key"
            class="w-1/3 px-3"
            :aria-hidden="m.current ? undefined : 'true'"
            :inert="!m.current"
          >
            <div class="relative grid grid-cols-7 gap-1">
              <span
                v-if="m.current && marker"
                class="bg-primary-fill pointer-events-none absolute top-0 left-0 aspect-square w-[calc((100%-1.5rem)/7)] rounded-full transition-[translate] duration-(--dur-slow) ease-snappy motion-reduce:transition-none"
                :style="{ translate: `calc(${marker.col} * (100% + 0.25rem)) calc(${marker.row} * (100% + 0.25rem))` }"
                aria-hidden="true"
              />
              <button
                v-for="(cell, i) in m.cells"
                :key="i"
                type="button"
                :aria-label="`${formatLongDate(cell.date.getTime())}${cell.eventCount ? `, ${cell.eventCount} competition${cell.eventCount === 1 ? '' : 's'}` : ''}`"
                :aria-pressed="(m.current && isSelected(cell.date))"
                :class="[
                  'press focus-inset relative aspect-square rounded-full text-base tabular-nums transition-colors',
                  // Other months' days: quieter by colour, still readable (not faded).
                  !cell.inMonth && 'text-muted-foreground font-normal',
                  (m.current && isSelected(cell.date))
                    ? 'text-primary-foreground font-semibold'
                    : cell.eventCount
                      ? 'bg-blue-paper font-semibold hover:bg-[color-mix(in_oklab,var(--primary)_18%,var(--card))]'
                      : cell.inMonth && 'hover:bg-[var(--tint-hover)]',
                  cell.isToday && !(m.current && isSelected(cell.date)) && 'ring-live text-live ring-2 ring-inset',
                ]"
                @click="selectDay(cell)"
              >
                <span class="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-[-58%]">{{ cell.date.getDate() }}</span>
                <span v-if="cell.eventCount" class="absolute bottom-[18%] left-1/2 flex -translate-x-1/2 gap-0.5" aria-hidden="true">
                  <span
                    v-for="n in Math.min(cell.eventCount, 3)"
                    :key="n"
                    :class="[
                      'size-1 rounded-full',
                      (m.current && isSelected(cell.date)) ? 'bg-primary-foreground' : 'bg-primary',
                    ]"
                  />
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Picking another day or month fades the list through, so it doesn't jump. -->
    <Transition
      mode="out-in"
      enter-active-class="transition-opacity duration-(--dur-quick) ease-standard"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-(--dur-instant) ease-exit"
      leave-to-class="opacity-0"
    >
    <div :key="sectionLabel" class="space-y-5">
      <template v-if="visibleCompetitions.length">
        <section class="space-y-2">
          <h3 class="text-section flex items-baseline justify-between gap-3">
            {{ sectionLabel }}
            <span class="text-muted-foreground text-sm font-normal tabular-nums">{{ visibleCompetitions.length }}</span>
          </h3>
          <ul class="rows-engraved -mx-4 [--inset:4.5rem] [--inset-end:1rem]">
            <CompetitionDateRow
              v-for="{ competition, rail, note } in railed(visibleCompetitions)"
              :key="competition.id"
              :competition="competition"
              :to="props.linkTo(competition)"
              :alerts="favorites.isFavorite('competitions', competition.id)"
              :rail="rail"
              :note="note"
            />
          </ul>
        </section>
      </template>

      <div v-else-if="loading" :class="['rows-engraved -mx-4 [--inset:4.5rem] [--inset-end:1rem]', lateSkeleton]" aria-busy="true">
        <span class="sr-only">Loading competitions…</span>
        <div v-for="i in 3" :key="i" class="flex min-h-16 items-center gap-3 py-2.5 pr-3 pl-4">
          <Skeleton class="h-14 w-11 shrink-0 rounded-xl!" />
          <div class="flex-1 space-y-2">
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3.5 w-1/3" />
          </div>
        </div>
      </div>

      <section v-else-if="selected" class="space-y-2">
        <h3 class="text-section">{{ sectionLabel }}</h3>
        <p class="text-muted-foreground flex items-center gap-3 py-2 pl-1 text-base">
          <CalendarOff class="size-5 shrink-0" aria-hidden="true" />
          {{ selectedIsToday ? 'Nothing today.' : 'Nothing on this day.' }}
        </p>
      </section>

      <nav v-if="nearby.length" aria-label="More dates" class="grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-4">
        <h3 class="text-muted-foreground col-span-2 text-sm font-semibold">More dates</h3>
        <div
          v-for="d in nearby"
          :key="d.kind"
          :class="['flex flex-col', d.kind === 'Next' ? 'col-start-2 items-end' : 'items-start']"
        >
          <Button
            variant="plain"
            :class="d.kind === 'Next' ? '-mr-4' : '-ml-4'"
            :aria-label="`${d.kind} event date: ${formatLongDate(d.date.getTime())}, ${d.comps.length} competition${d.comps.length === 1 ? '' : 's'}`"
            @click="goToDay(d.date)"
          >
            <ChevronLeft v-if="d.kind === 'Previous'" aria-hidden="true" />
            {{ d.label }}
            <ChevronRight v-if="d.kind === 'Next'" aria-hidden="true" />
          </Button>
          <span class="text-muted-foreground text-sm tabular-nums">
            {{ d.comps.length }} {{ d.comps.length === 1 ? 'event' : 'events' }}
          </span>
        </div>
      </nav>
    </div>
    </Transition>
  </div>
</template>
