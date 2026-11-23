<script setup lang="ts">
import { whenLanded } from '@/lib/pageTransition'
import DancersPill from '@/components/DancersPill.vue'
import ResultsMark from '@/components/ResultsMark.vue'
import { computed, nextTick, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { CalendarDays, ChevronRight } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useCompetitionDays } from '@/composables/useCompetitionDays'
import { useCompetitionProgress } from '@/composables/useCompetitionProgress'
import { useFollowing } from '@/composables/useFollowing'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { blocks, dances as eventDances, dayLabel, days, events, platformLabel, slugline } from '@/lib/schedule'
import { sanitizeRichText } from '@/lib/sanitize'
import { competitionPhase } from '@/lib/dancerDay'
import { isDanced, trophyEventEntrants } from '@/lib/trophyEvents'
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
  trophyEvents,
  results,
  loadSchedule,
  loadDancers,
  loadResults,
  hasSchedule,
  scheduleHidden,
  competition,
} = useCompetition()
// A competition that's over and never posted a schedule shouldn't promise one.
const isOver = computed(() => competitionPhase(competition.value?.date, schedule.value) === 'after')
const { followedByGroup } = useCompetitionDays()
const following = useFollowing()
const progress = useCompetitionProgress()

const platformName = computed(() => new Map(platforms.value.map((p) => [p.id, platformLabel(p.name)])))

type Mine = Array<{ dancer: EnrichedDancer; color: string | null; platform: string | null }>

// Who of yours dances a turn: an age group's followed dancers, or the followed
// ones dancing a trophy event (everyone it's open to, or those picked).
function followedIn(id: string): EnrichedDancer[] {
  const trophyEvent = trophyEvents.value.find((a) => a.id === id)
  if (!trophyEvent) return followedByGroup.value.get(id) ?? []
  return isDanced(trophyEvent) ? trophyEventEntrants(trophyEvent, [...followedByGroup.value.values()].flat(), results.value) : []
}

function mineIn(event: ScheduleEvent): Mine {
  const mine = new Map<string, Mine[number]>()
  for (const sd of eventDances(event)) {
    if (!sd.danceId || !sd.platforms) continue
    for (const [pid, slot] of Object.entries(sd.platforms)) {
      for (const gid of slot.orderedGroupIds ?? []) {
        for (const d of followedIn(gid)) {
          if (!mine.has(d.id))
            mine.set(d.id, { dancer: d, color: following.colorFor(following.followedIn(d)), platform: platformName.value.get(pid) || null })
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
      })),
    })),
  })),
)
// Days with no sessions (all deleted) aren't a schedule yet.
const empty = computed(() => !dayList.value.some((d) => d.blocks.length || d.day.description))

const route = useRoute()
const ready = ref(false)
onMounted(async () => {
  await Promise.all([loadSchedule(), loadDancers(), loadResults()])
  ready.value = true
  // Opened from a session on the Overview: straight to it.
  if (route.hash.startsWith('#block-')) {
    await whenLanded()
    await nextTick()
    document.getElementById(route.hash.slice(1))?.scrollIntoView({ block: 'start', behavior: 'instant' })
  } else openAtToday()
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
  <div class="section-breaks space-y-3">
    <header :ref="setHeader" class="space-y-1 pt-0.5">
      <h1 class="text-hero">Schedule</h1>
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

    <section v-for="d in empty ? [] : dayList" :id="`day-${d.day.id}`" :key="d.day.id" class="section-breaks scroll-mt-(--chrome-top) space-y-3">
      <h2 v-if="dayList.length > 1" :data-section="d.label" class="text-section flex items-baseline gap-2 pt-2">
        <!-- The organiser's own name for the day first; "Today" is ours, after it. -->
        {{ d.label }}
        <span v-if="d.relative" class="text-muted-foreground text-base font-medium">{{ d.relative }}</span>
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
          :data-section="[dayList.length > 1 ? d.label : null, b.block.name || 'Session', b.time].filter(Boolean).join(' · ')"
          :class="['flex flex-wrap items-baseline justify-between gap-x-2 pb-2', dayList.length > 1 ? 'text-heading pt-1' : 'text-section']"
        >
          <span class="truncate">{{ b.block.name || 'Session' }}</span>
          <!-- Usually a time ("9:30 am"), but organisers write sentences here
               too: a long one wraps onto its own line, never widens the page. -->
          <span v-if="b.time" class="text-muted-foreground text-callout min-w-0 font-medium tabular-nums">{{ b.time }}</span>
        </h3>
        <ul class="rows-engraved -mx-4 [--inset:1rem] [--inset-end:1rem]">
          <li v-for="e in b.events" :key="e.event.id">
            <div v-if="!e.dancing" class="px-4 py-3">
              <p class="text-base leading-snug font-semibold">{{ e.event.name || 'Event' }}</p>
              <div
                v-if="e.event.description"
                class="text-muted-foreground text-sm [&_a]:text-primary [&_a]:underline [&_p+p]:mt-2"
                v-html="sanitizeRichText(e.event.description)"
              />
            </div>
            <template v-else>
              <RouterLink
                :to="{ name: 'competition.event', params: { competitionId, dayId: d.day.id, blockId: b.block.id, eventId: e.event.id } }"
                class="press-row focus-inset flex min-h-14 items-center gap-3 py-2.5 pr-3 pl-4"
              >
                <span class="min-w-0 flex-1">
                  <span :class="['block text-base leading-snug break-words', e.state === 'done' ? 'text-muted-foreground font-medium' : 'font-semibold']">
                    {{ e.event.name || 'Event' }}
                  </span>
                  <span v-if="e.event.description" class="text-muted-foreground block truncate text-sm">
                    {{ slugline(e.event.description) }}
                  </span>
                  <!-- Yours somewhere in it: a pill, part of the row (it opens the event too). -->
                  <DancersPill
                    v-if="e.mine.length"
                    class="mt-1.5"
                    :colors="e.mine.map((m) => m.color)"
                    :names="e.mine.map((m) => m.dancer.fullName)"
                  />
                </span>
                <ResultsMark :posted="e.count.posted" :total="e.count.total" />
                <ChevronRight class="text-muted-foreground size-5 shrink-0" />
              </RouterLink>
            </template>
          </li>
          <li v-if="!b.events.length" class="text-muted-foreground px-4 py-3 text-base">Nothing listed yet.</li>
        </ul>
      </section>
    </section>
  </div>
</template>
