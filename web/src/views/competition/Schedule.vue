<script setup lang="ts">
import MyDancerLine from '@/components/MyDancerLine.vue'
import ResultsMark from '@/components/ResultsMark.vue'
import { computed, nextTick, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { CalendarDays, ChevronRight } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useCompetitionDays } from '@/composables/useCompetitionDays'
import { useCompetitionProgress } from '@/composables/useCompetitionProgress'
import { useFollowing } from '@/composables/useFollowing'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { blocks, dances as eventDances, dayLabel, days, events, platformLabel, slugline } from '@/lib/schedule'
import { sanitizeRichText } from '@/lib/sanitize'
import { competitionPhase } from '@/lib/dancerDay'
import { today } from '@/lib/now'
import type { EnrichedDancer, ScheduleEvent } from '@/types/competition'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'

// Every session open, in order. Events that include someone you follow say
// so, and each says how many of its results are in (a check once they all
// are, when it steps back). There's no guessing what's on now: the data has
// no clock. On a later day of the competition, the first visit of the day
// opens at today. The tab is always here, even before a schedule is posted,
// so it never moves.
const setHeader = injectInfoHeaderSetter()
const {
  competitionId,
  schedule,
  platforms,
  loadSchedule,
  loadDancers,
  loadResults,
  hasSchedule,
  scheduleHidden,
  competition,
} = useCompetition()
// A competition that's over and never posted a schedule shouldn't promise one.
const isOver = computed(() => competitionPhase(competition.value?.date, schedule.value) === 'after')
const { followedByGroup, followedHere } = useCompetitionDays()
// The events your dancers dance next in, marked "Next" like their day card.
const nextEvents = computed(
  () => new Set(followedHere.value.flatMap((f) => f.days.map((d) => d.next?.slot?.eventId).filter(Boolean) as string[])),
)
const following = useFollowing()
const progress = useCompetitionProgress()

const platformName = computed(() => new Map(platforms.value.map((p) => [p.id, platformLabel(p.name)])))

type Mine = Array<{ dancer: EnrichedDancer; color: string | null; platform: string | null }>

function mineIn(event: ScheduleEvent): Mine {
  const mine = new Map<string, Mine[number]>()
  for (const sd of eventDances(event)) {
    if (!sd.danceId || !sd.platforms) continue
    for (const [pid, slot] of Object.entries(sd.platforms)) {
      for (const gid of slot.orderedGroupIds ?? []) {
        for (const d of followedByGroup.value.get(gid) ?? []) {
          if (!mine.has(d.id))
            mine.set(d.id, { dancer: d, color: following.colorFor(d.dancerId), platform: platformName.value.get(pid) || null })
        }
      }
    }
  }
  return [...mine.values()]
}

const RELATIVE: Record<number, string> = { 0: 'Today', 1: 'Tomorrow' }

const dayList = computed(() =>
  days(schedule.value).map((day, i) => ({
    day,
    label: dayLabel(day, i),
    relative: RELATIVE[progress.value.dayOffset.get(day.id) ?? NaN] ?? null,
    blocks: blocks(day).map((block) => ({
      block,
      time: slugline(block.description),
      events: events(block).map((event) => ({
        event,
        // Ceilidhs, receptions, meetings: nothing to dance, so nothing to open.
        dancing: eventDances(event).some((sd) => sd.danceId),
        mine: mineIn(event),
        count: progress.value.counts.get(event.id) ?? { posted: 0, total: 0 },
        state: progress.value.events.get(event.id) ?? null,
        next: nextEvents.value.has(event.id),
      })),
    })),
  })),
)
// Days with no sessions (all deleted) aren't a schedule yet.
const empty = computed(() => !dayList.value.some((d) => d.blocks.length || d.day.description))

const ready = ref(false)
onMounted(async () => {
  await Promise.all([loadSchedule(), loadDancers(), loadResults()])
  ready.value = true
  openAtToday()
})

// The first visit of the day opens at today's part of the schedule (when it
// isn't already at the top); after that, wherever you left it.
async function openAtToday() {
  const i = dayList.value.findIndex((d) => progress.value.dayOffset.get(d.day.id) === 0)
  if (i <= 0) return
  const key = `schedule:opened:${competitionId.value}`
  try {
    if (localStorage.getItem(key) === today.value) return
    localStorage.setItem(key, today.value)
  } catch {
    return
  }
  await nextTick()
  document.getElementById(`day-${dayList.value[i].day.id}`)?.scrollIntoView({ block: 'start', behavior: 'instant' })
}
</script>

<template>
  <div class="space-y-3">
    <header :ref="setHeader" class="space-y-1">
      <h1 class="text-display">Schedule</h1>
    </header>

    <div v-if="hasSchedule === null || !ready" class="space-y-2" aria-busy="true">
      <Skeleton v-for="i in 5" :key="i" class="h-14 w-full rounded-xl!" />
    </div>
    <EmptyState
      v-else-if="scheduleHidden"
      :icon="CalendarDays"
      title="No schedule here"
      description="This competition doesn’t share its schedule here."
    />
    <EmptyState
      v-else-if="hasSchedule === false || empty"
      :icon="CalendarDays"
      :title="isOver ? 'No schedule was posted' : 'No schedule yet'"
      :description="
        isOver
          ? 'This competition didn’t post one here. Its results are under Results.'
          : 'Platforms and dancing order show up here once the organisers post it.'
      "
    />

    <section v-for="d in empty ? [] : dayList" :id="`day-${d.day.id}`" :key="d.day.id" class="scroll-mt-(--chrome-top) space-y-3">
      <h2 v-if="dayList.length > 1" class="text-title flex items-baseline gap-2 pt-2">
        {{ d.relative ?? d.label }}
        <span v-if="d.relative" class="text-muted-foreground text-base font-medium">{{ d.label }}</span>
      </h2>
      <div
        v-if="d.day.description"
        class="text-muted-foreground text-callout"
        v-html="sanitizeRichText(d.day.description)"
      />

      <section
        v-for="b in d.blocks"
        :id="`block-${b.block.id}`"
        :key="b.block.id"
        class="scroll-mt-[calc(var(--chrome-top)+0.25rem)]"
      >
        <h3
          class="bg-background text-muted-foreground text-callout sticky top-(--chrome-top) z-10 flex items-baseline justify-between gap-2 py-2 font-semibold"
        >
          <span class="truncate">{{ b.block.name || 'Session' }}</span>
          <span v-if="b.time" class="shrink-0 font-medium tabular-nums">{{ b.time }}</span>
        </h3>
        <ul class="surface rows-inset overflow-hidden rounded-2xl">
          <li v-for="e in b.events" :key="e.event.id">
            <div v-if="!e.dancing" class="px-4 py-3">
              <p class="text-base leading-snug font-semibold">{{ e.event.name || 'Event' }}</p>
              <div
                v-if="e.event.description"
                class="text-muted-foreground text-sm [&_a]:text-primary [&_a]:underline [&_p+p]:mt-2"
                v-html="sanitizeRichText(e.event.description)"
              />
            </div>
            <RouterLink
              v-else
              :to="{
                name: 'competition.event',
                params: { competitionId, dayId: d.day.id, blockId: b.block.id, eventId: e.event.id },
              }"
              :class="['press-row focus-inset relative flex min-h-14 items-center gap-3 py-2.5 pr-3 pl-4', e.next && 'bg-next/55']"
              :style="e.mine.length ? { '--dc': e.mine[0].color ?? 'var(--primary)' } : undefined"
            >
              <span v-if="e.mine.length" class="sash absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
              <span class="min-w-0 flex-1">
                <span :class="['block text-base leading-snug break-words', e.state === 'done' ? 'text-muted-foreground font-medium' : 'font-semibold']">
                  {{ e.event.name || 'Event' }}
                </span>
                <span v-if="e.next" class="text-next-foreground text-callout block font-semibold">Up next</span>
                <span v-if="e.event.description" class="text-muted-foreground block truncate text-sm">
                  {{ slugline(e.event.description) }}
                </span>
                <MyDancerLine
                  v-for="m in e.mine"
                  :key="m.dancer.id"
                  :color="m.color"
                  :name="m.dancer.firstName ?? ''"
                  :details="[`#${m.dancer.number}`, m.platform]"
                  class="mt-1"
                />
              </span>
              <ResultsMark :posted="e.count.posted" :total="e.count.total" />
              <ChevronRight class="text-muted-foreground size-5 shrink-0" />
            </RouterLink>
          </li>
          <li v-if="!b.events.length" class="text-muted-foreground px-4 py-3 text-base">Nothing listed yet.</li>
        </ul>
      </section>
    </section>
  </div>
</template>
