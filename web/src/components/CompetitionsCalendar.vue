<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import CompetitionRow from '@/components/CompetitionRow.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import Skeleton from '@/components/Skeleton.vue'
import { parseDate } from '@/lib/format'
import { useFavoritesStore } from '@/stores/favorites'

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

const today = startOfDay(new Date())

const cursor = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const selected = ref<Date | null>(new Date(today))

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const monthEvents = computed(() =>
  props.competitions.filter((c) => {
    if (!c.date) return false
    const d = parseDate(c.date)
    return (
      d.getFullYear() === cursor.value.getFullYear() &&
      d.getMonth() === cursor.value.getMonth()
    )
  }),
)

const eventsByDay = computed(() => {
  const m = new Map<number, CompetitionListItem[]>()
  for (const c of monthEvents.value) {
    const d = parseDate(c.date!).getDate()
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
    favCount: number
  }> = []
  for (let i = 0; i < rows * 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const inMonth = d.getMonth() === cursor.value.getMonth()
    const dayEvents = inMonth ? (eventsByDay.value.get(d.getDate()) ?? []) : []
    cells.push({
      date: d,
      inMonth,
      isToday: d.getTime() === today.getTime(),
      eventCount: dayEvents.length,
      favCount: dayEvents.filter((c) => favorites.isFavoriteCompetition(c.id)).length,
    })
  }
  return cells
})

const monthLabel = computed(() =>
  cursor.value.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
)

const visibleCompetitions = computed(() => {
  if (selected.value) {
    const dayStart = startOfDay(selected.value).getTime()
    const dayEnd = dayStart + 86_400_000
    return props.competitions.filter((c) => {
      if (!c.date) return false
      const t = parseDate(c.date).getTime()
      return t >= dayStart && t < dayEnd
    })
  }
  return [...monthEvents.value].sort(
    (a, b) => parseDate(a.date!).getTime() - parseDate(b.date!).getTime(),
  )
})

const sectionLabel = computed(() =>
  selected.value
    ? selected.value.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : monthLabel.value,
)

function shiftMonth(delta: number) {
  const next = new Date(cursor.value)
  next.setMonth(next.getMonth() + delta)
  cursor.value = next
  selected.value = null
}

function goToToday() {
  cursor.value = new Date(today.getFullYear(), today.getMonth(), 1)
  selected.value = new Date(today)
}

defineExpose({ goToToday })

function isSelected(d: Date) {
  if (!selected.value) return false
  return (
    d.getFullYear() === selected.value.getFullYear() &&
    d.getMonth() === selected.value.getMonth() &&
    d.getDate() === selected.value.getDate()
  )
}

function selectDay(cell: { date: Date; inMonth: boolean }) {
  if (!cell.inMonth) {
    cursor.value = new Date(cell.date.getFullYear(), cell.date.getMonth(), 1)
    selected.value = startOfDay(cell.date)
    return
  }
  selected.value = isSelected(cell.date) ? null : startOfDay(cell.date)
}

const dowLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-center gap-1">
      <button
        type="button"
        aria-label="Previous month"
        class="text-muted-foreground hover:text-foreground hover:bg-accent flex size-11 items-center justify-center rounded-full"
        @click="shiftMonth(-1)"
      >
        <ChevronLeft class="size-4" />
      </button>
      <h2 class="font-serif text-4xl font-medium tracking-tight">
        {{ monthLabel }}
      </h2>
      <button
        type="button"
        aria-label="Next month"
        class="text-muted-foreground hover:text-foreground hover:bg-accent flex size-11 items-center justify-center rounded-full"
        @click="shiftMonth(1)"
      >
        <ChevronRight class="size-4" />
      </button>
    </div>

    <div
      class="text-foreground/65 grid grid-cols-7 text-xs font-medium tracking-[0.18em] uppercase"
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
          'relative aspect-square rounded-lg text-lg tabular-nums transition-colors',
          !cell.inMonth && 'text-muted-foreground/40',
          cell.inMonth && !cell.eventCount && !isSelected(cell.date) && 'hover:bg-accent',
          cell.eventCount && !isSelected(cell.date) && 'bg-card shadow-sm hover:shadow',
          isSelected(cell.date) && 'bg-blue-paper shadow-sm',
          cell.isToday && !isSelected(cell.date) && 'ring-foreground/30 ring-1',
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
          class="text-primary absolute bottom-1.5 left-1/2 flex -translate-x-1/2 items-center gap-0.5"
        >
          <span
            v-for="n in Math.min(cell.favCount, 3)"
            :key="`f${n}`"
            class="bg-secondary size-1 rounded-full"
          />
          <span
            v-for="n in Math.max(0, Math.min(cell.eventCount, 3) - cell.favCount)"
            :key="`e${n}`"
            class="bg-primary size-1 rounded-full"
          />
          <span
            v-if="cell.eventCount > 3"
            class="-mt-[2.5px] -mr-1 text-xs leading-none font-bold"
            aria-hidden="true"
            >+</span
          >
        </span>
      </button>
    </div>

    <section v-if="visibleCompetitions.length" class="space-y-2 pt-2">
      <SectionHeader :label="sectionLabel" :count="visibleCompetitions.length" />
      <ul>
        <CompetitionRow
          v-for="competition in visibleCompetitions"
          :key="competition.id"
          :competition="competition"
          :to="props.linkTo(competition)"
          :show-date="!selected"
        />
      </ul>
    </section>

    <div
      v-else-if="loading"
      class="space-y-3 pt-2"
      aria-busy="true"
      aria-live="polite"
    >
      <span class="sr-only">Loading competitions…</span>
      <div v-for="i in 3" :key="i" class="flex items-start gap-3 py-3">
        <Skeleton class="size-12 shrink-0 rounded-xl!" />
        <div class="flex-1 space-y-2 pt-1">
          <Skeleton class="h-5 w-3/4" />
          <Skeleton class="h-4 w-1/2" />
        </div>
      </div>
    </div>
  </div>
</template>
