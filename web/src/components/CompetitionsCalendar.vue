<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { CalendarOff, ChevronLeft, ChevronRight } from '@lucide/vue'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import CompetitionDateRow from '@/components/CompetitionDateRow.vue'
import FavCount from '@/components/FavCount.vue'
import Skeleton from '@/components/Skeleton.vue'
import { formatLongDate, formatMonthYear, formatShortDate, formatWeekdayShortDate, parseDate } from '@/lib/format'
import { selectionHaptic } from '@/lib/haptics'
import { lateSkeleton } from '@/lib/settle'
import { useFavoritesStore } from '@/stores/favorites'
import { now } from '@/lib/now'

// A month at a time, Monday first (Highland competitions are weekend
// events; a week shouldn't split one). Days with competitions are tinted;
// the chosen day is a solid disc that moves from cell to cell. Months slide,
// and can be swiped. Beside it on wide screens (below on phones), what's on
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

const cursor = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const selected = ref<Date | null>(new Date(today))
// Which way the month moved, for the slide.
const direction = ref<1 | -1>(1)

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

const eventsByDay = computed(() => {
  const m = new Map<number, CompetitionListItem[]>()
  for (const c of monthEvents.value) {
    const d = parseDate(c.date!).getDate()
    m.set(d, [...(m.get(d) ?? []), c])
  }
  return m
})

const calendarCells = computed(() => {
  const first = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1)
  const startDow = (first.getDay() + 6) % 7
  const last = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 0)
  const rows = Math.ceil((startDow + last.getDate()) / 7)
  const start = new Date(first)
  start.setDate(1 - startDow)
  return Array.from({ length: rows * 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const inMonth = d.getMonth() === cursor.value.getMonth()
    const dayEvents = inMonth ? (eventsByDay.value.get(d.getDate()) ?? []) : []
    return {
      date: d,
      inMonth,
      isToday: d.getTime() === today.getTime(),
      eventCount: dayEvents.length,
      favCount: dayEvents.filter((c) => favorites.isFavoriteCompetition(c.id)).length,
    }
  })
})

const monthLabel = computed(() => formatMonthYear(cursor.value))
const monthKey = computed(() => `${cursor.value.getFullYear()}-${cursor.value.getMonth()}`)

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
const favCount = (list: CompetitionListItem[]) => list.filter((c) => favorites.isFavoriteCompetition(c.id)).length

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
  return { date: day, label: sameYear ? formatWeekdayShortDate(day) : formatShortDate(day.getTime()), comps }
}

// When the selected day has none, surface the next day that has some.
const upcomingDay = computed(() => (visibleCompetitions.value.length ? null : adjacentDay('next')))
const previousDay = computed(() => adjacentDay('prev'))
const nearby = computed(() =>
  [
    upcomingDay.value && { ...upcomingDay.value, kind: 'Next' },
    previousDay.value && { ...previousDay.value, kind: 'Previous' },
  ].filter((d) => !!d),
)

function shiftMonth(delta: 1 | -1) {
  direction.value = delta
  const next = new Date(cursor.value)
  next.setMonth(next.getMonth() + delta)
  cursor.value = next
  selected.value = null
}

function goToToday() {
  const there = new Date(today.getFullYear(), today.getMonth(), 1)
  direction.value = there < cursor.value ? -1 : 1
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
    direction.value = cell.date < cursor.value ? -1 : 1
    cursor.value = new Date(cell.date.getFullYear(), cell.date.getMonth(), 1)
    selected.value = startOfDay(cell.date)
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
  <div class="space-y-5 md:grid md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:items-start md:gap-8 md:space-y-0">
    <div class="mx-auto w-full max-w-sm space-y-3 md:sticky md:top-[calc(var(--chrome-top)+1rem)]">
      <div class="flex items-center gap-1">
        <h2 class="text-heading flex-1">{{ monthLabel }}</h2>
        <button
          type="button"
          aria-label="Previous month"
          class="press surface flex size-11 items-center justify-center rounded-full"
          @click="shiftMonth(-1)"
        >
          <ChevronLeft class="size-5" />
        </button>
        <button type="button" class="press surface h-11 rounded-full px-4 text-callout font-semibold" @click="goToToday">
          Today
        </button>
        <button
          type="button"
          aria-label="Next month"
          class="press surface flex size-11 items-center justify-center rounded-full"
          @click="shiftMonth(1)"
        >
          <ChevronRight class="size-5" />
        </button>
      </div>

      <div class="text-muted-foreground grid grid-cols-7 text-xs font-medium" aria-hidden="true">
        <div v-for="(label, i) in dowLabels" :key="i" class="py-1 text-center">{{ label }}</div>
      </div>

      <div class="grid touch-pan-y overflow-hidden" @pointerdown="onPointerDown" @pointerup="onPointerUp" @pointercancel="swipe = null">
        <Transition
          :enter-from-class="direction > 0 ? 'translate-x-6 opacity-0' : '-translate-x-6 opacity-0'"
          :leave-to-class="direction > 0 ? '-translate-x-6 opacity-0' : 'translate-x-6 opacity-0'"
          enter-active-class="transition-[translate,opacity] duration-(--dur-base) ease-standard motion-reduce:transition-opacity"
          leave-active-class="transition-[translate,opacity] duration-(--dur-quick) ease-exit motion-reduce:transition-opacity"
        >
          <div :key="monthKey" class="relative grid grid-cols-7 gap-1 [grid-area:1/1]">
            <span
              v-if="marker"
              class="bg-primary-fill pointer-events-none absolute top-0 left-0 aspect-square w-[calc((100%-1.5rem)/7)] rounded-full transition-[translate] duration-(--dur-slow) ease-snappy motion-reduce:transition-none"
              :style="{ translate: `calc(${marker.col} * (100% + 0.25rem)) calc(${marker.row} * (100% + 0.25rem))` }"
              aria-hidden="true"
            />
            <button
              v-for="(cell, i) in calendarCells"
              :key="i"
              type="button"
              :aria-label="`${formatLongDate(cell.date.getTime())}${cell.eventCount ? `, ${cell.eventCount} competition${cell.eventCount === 1 ? '' : 's'}` : ''}`"
              :aria-pressed="isSelected(cell.date)"
              :class="[
                'press focus-inset relative aspect-square rounded-full text-base tabular-nums transition-colors',
                !cell.inMonth && 'text-muted-foreground/40',
                isSelected(cell.date)
                  ? 'text-primary-foreground font-semibold'
                  : cell.eventCount
                    ? 'bg-blue-paper font-semibold hover:bg-[color-mix(in_oklab,var(--primary)_18%,var(--card))]'
                    : cell.inMonth && 'hover:bg-[var(--tint-hover)]',
                cell.isToday && !isSelected(cell.date) && 'ring-live text-live ring-2 ring-inset',
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
                    isSelected(cell.date) ? 'bg-primary-foreground' : n <= cell.favCount ? 'bg-secondary' : 'bg-primary',
                  ]"
                />
              </span>
            </button>
          </div>
        </Transition>
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
          <h3 class="text-heading flex items-baseline justify-between gap-3">
            {{ sectionLabel }}
            <FavCount class="text-sm font-normal" :favs="favCount(visibleCompetitions)" :total="visibleCompetitions.length" />
          </h3>
          <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
            <CompetitionDateRow
              v-for="competition in visibleCompetitions"
              :key="competition.id"
              :competition="competition"
              :to="props.linkTo(competition)"
              :followed="favorites.isFavorite('competitions', competition.id)"
            />
          </ul>
        </section>
      </template>

      <div v-else-if="loading" :class="['surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]', lateSkeleton]" aria-busy="true">
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
        <h3 class="text-heading">{{ sectionLabel }}</h3>
        <p class="text-muted-foreground flex items-center gap-3 py-2 pl-1 text-base">
          <CalendarOff class="size-5 shrink-0" aria-hidden="true" />
          {{ selectedIsToday ? 'Nothing today.' : 'Nothing on this day.' }}
        </p>
      </section>

      <section v-for="d in nearby" :key="d.kind" class="space-y-2">
        <h3 class="text-heading flex items-baseline justify-between gap-3">
          {{ d.kind }} · {{ d.label }}
          <FavCount class="text-sm font-normal" :favs="favCount(d.comps)" :total="d.comps.length" />
        </h3>
        <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
          <CompetitionDateRow
            v-for="competition in d.comps"
            :key="competition.id"
            :competition="competition"
            :to="props.linkTo(competition)"
            :followed="favorites.isFavorite('competitions', competition.id)"
          />
        </ul>
      </section>
    </div>
    </Transition>
  </div>
</template>
