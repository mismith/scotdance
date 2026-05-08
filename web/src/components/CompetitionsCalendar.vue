<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import { formatRelative } from '@/lib/format'

const props = withDefaults(
  defineProps<{
    competitions: CompetitionListItem[]
    linkTo?: (c: CompetitionListItem) => RouteLocationRaw
  }>(),
  {
    linkTo: (c: CompetitionListItem) => ({
      name: 'competition.info',
      params: { competitionId: c.id },
    }),
  },
)

const today = startOfDay(new Date())

const cursor = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const selected = ref<Date>(new Date(today))

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const monthEvents = computed(() =>
  props.competitions.filter((c) => {
    if (!c.date) return false
    const d = new Date(c.date)
    return (
      d.getFullYear() === cursor.value.getFullYear() &&
      d.getMonth() === cursor.value.getMonth()
    )
  }),
)

const eventsByDay = computed(() => {
  const m = new Map<number, CompetitionListItem[]>()
  for (const c of monthEvents.value) {
    const d = new Date(c.date!).getDate()
    const list = m.get(d) ?? []
    list.push(c)
    m.set(d, list)
  }
  return m
})

const calendarCells = computed(() => {
  const first = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1)
  const startDow = first.getDay()
  const last = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 0)
  const rows = Math.ceil((startDow + last.getDate()) / 7)
  const start = new Date(first)
  start.setDate(1 - startDow)
  const cells: Array<{
    date: Date
    inMonth: boolean
    isToday: boolean
    eventCount: number
  }> = []
  for (let i = 0; i < rows * 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const inMonth = d.getMonth() === cursor.value.getMonth()
    cells.push({
      date: d,
      inMonth,
      isToday: d.getTime() === today.getTime(),
      eventCount: inMonth ? (eventsByDay.value.get(d.getDate())?.length ?? 0) : 0,
    })
  }
  return cells
})

const monthLabel = computed(() =>
  cursor.value.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
)

const upcoming = computed(() => {
  const anchor = selected.value.getTime()
  return props.competitions
    .filter((c) => c.date && new Date(c.date).getTime() >= anchor)
    .slice(0, 8)
})

function shiftMonth(delta: number) {
  const next = new Date(cursor.value)
  next.setMonth(next.getMonth() + delta)
  cursor.value = next
}

function goToToday() {
  cursor.value = new Date(today.getFullYear(), today.getMonth(), 1)
  selected.value = new Date(today)
}

defineExpose({ goToToday })

function isSelected(d: Date) {
  return (
    d.getFullYear() === selected.value.getFullYear() &&
    d.getMonth() === selected.value.getMonth() &&
    d.getDate() === selected.value.getDate()
  )
}

function selectDay(cell: { date: Date; inMonth: boolean }) {
  if (!cell.inMonth) {
    cursor.value = new Date(cell.date.getFullYear(), cell.date.getMonth(), 1)
  }
  selected.value = startOfDay(cell.date)
}

const dowLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-end justify-between gap-3">
      <div class="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous month"
          class="text-muted-foreground hover:text-foreground -ml-2 rounded-md p-2"
          @click="shiftMonth(-1)"
        >
          <ChevronLeft class="size-4" />
        </button>
        <h2 class="font-serif text-2xl font-medium tracking-tight">
          {{ monthLabel }}
        </h2>
        <button
          type="button"
          aria-label="Next month"
          class="text-muted-foreground hover:text-foreground rounded-md p-2"
          @click="shiftMonth(1)"
        >
          <ChevronRight class="size-4" />
        </button>
      </div>
      <div class="text-muted-foreground text-xs tabular-nums">
        {{ monthEvents.length }} {{ monthEvents.length === 1 ? 'event' : 'events' }}
      </div>
    </div>

    <div
      class="text-muted-foreground grid grid-cols-7 text-[10px] font-semibold tracking-[0.14em] uppercase"
    >
      <div v-for="(label, i) in dowLabels" :key="i" class="py-1 text-center">
        {{ label }}
      </div>
    </div>

    <div class="grid grid-cols-7 gap-1">
      <button
        v-for="(cell, i) in calendarCells"
        :key="i"
        type="button"
        :class="[
          'relative aspect-square rounded-lg text-sm tabular-nums transition-colors',
          !cell.inMonth && 'text-muted-foreground/40',
          cell.inMonth && !cell.eventCount && !isSelected(cell.date) && 'hover:bg-accent',
          cell.eventCount && !isSelected(cell.date) && 'bg-card shadow-sm hover:shadow',
          isSelected(cell.date) && cell.eventCount && 'bg-pink-paper shadow-sm',
          isSelected(cell.date) && !cell.eventCount && 'ring-1 ring-foreground/30',
          cell.isToday && !isSelected(cell.date) && 'ring-1 ring-foreground/30',
        ]"
        @click="selectDay(cell)"
      >
        <span
          class="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-[-60%] font-medium"
        >
          {{ cell.date.getDate() }}
        </span>
        <span
          v-if="cell.eventCount"
          class="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-0.5"
        >
          <span
            v-for="n in Math.min(cell.eventCount, 3)"
            :key="n"
            class="bg-secondary size-1 rounded-full"
          />
        </span>
      </button>
    </div>

    <section v-if="upcoming.length" class="space-y-3 pt-2">
      <div
        class="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase"
      >
        Upcoming
      </div>
      <ul class="divide-y border-t border-b">
        <li v-for="competition in upcoming" :key="competition.id">
          <RouterLink
            :to="props.linkTo(competition)"
            class="flex items-center gap-4 px-1 py-3"
          >
            <div class="text-secondary w-10 shrink-0 text-center">
              <div class="font-serif text-2xl leading-none">
                {{ new Date(competition.date!).getDate() }}
              </div>
              <div
                class="mt-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase"
              >
                {{
                  new Date(competition.date!).toLocaleString('en-US', {
                    month: 'short',
                  })
                }}
              </div>
            </div>
            <div class="min-w-0 flex-1">
              <div
                class="font-serif truncate text-[15px] leading-tight font-medium tracking-tight"
              >
                {{ competition.name ?? '?' }}
              </div>
              <div class="text-muted-foreground truncate text-xs">
                <span v-if="competition.location">{{ competition.location }}</span>
                <span v-if="competition.location && competition.date"> · </span>
                <span v-if="competition.date">{{
                  formatRelative(competition.date)
                }}</span>
              </div>
            </div>
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>
