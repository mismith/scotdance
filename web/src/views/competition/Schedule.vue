<script setup lang="ts">
import MyDancerLine from '@/components/MyDancerLine.vue'
import ResultsMark from '@/components/ResultsMark.vue'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { CalendarDays, ChevronRight } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useCompetitionDays } from '@/composables/useCompetitionDays'
import { useFollowing } from '@/composables/useFollowing'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { blocks, dances as eventDances, days, events, slugline } from '@/lib/schedule'
import { sanitizeRichText } from '@/lib/sanitize'
import { formatWeekday } from '@/lib/format'
import { competitionPhase } from '@/lib/dancerDay'
import type { EnrichedDancer, ScheduleEvent } from '@/types/competition'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'

// Every session open, in order. Events that include someone you follow say
// so, and events whose results are all posted say "Results in". The tab is
// always here, even before a schedule is posted, so it never moves.
const setHeader = injectInfoHeaderSetter()
const {
  competitionId,
  schedule,
  platforms,
  results,
  loadSchedule,
  loadDancers,
  loadResults,
  hasSchedule,
  competition,
} = useCompetition()
// A competition that's over and never posted a schedule shouldn't promise one.
const isOver = computed(() => competitionPhase(competition.value?.date) === 'after')
const { followedByGroup } = useCompetitionDays()
const following = useFollowing()

const ready = ref(false)
onMounted(async () => {
  await Promise.all([loadSchedule(), loadDancers(), loadResults()])
  ready.value = true
})

const platformName = computed(() => new Map(platforms.value.map((p) => [p.id, p.name ?? ''])))

interface EventInfo {
  mine: Array<{ dancer: EnrichedDancer; color: string | null; platform: string | null }>
  posted: number
  total: number
}

function info(event: ScheduleEvent): EventInfo {
  const mine = new Map<string, EventInfo['mine'][number]>()
  let posted = 0
  let total = 0
  for (const sd of eventDances(event)) {
    if (!sd.danceId || !sd.platforms) continue
    for (const [pid, slot] of Object.entries(sd.platforms)) {
      for (const gid of slot.orderedGroupIds ?? []) {
        total++
        const raw = results.value?.[gid]?.[sd.danceId]
        if (raw === false || (Array.isArray(raw) && raw.length)) posted++
        for (const d of followedByGroup.value.get(gid) ?? []) {
          if (!mine.has(d.id))
            mine.set(d.id, {
              dancer: d,
              color: following.colorFor(d.dancerId),
              platform: platformName.value.get(pid) || null,
            })
        }
      }
    }
  }
  return { mine: [...mine.values()], posted, total }
}

const dayList = computed(() =>
  days(schedule.value).map((day) => ({
    day,
    blocks: blocks(day).map((block) => ({
      block,
      time: slugline(block.description),
      events: events(block).map((event) => ({ event, info: info(event) })),
    })),
  })),
)
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
      v-else-if="hasSchedule === false"
      :icon="CalendarDays"
:title="isOver ? 'No schedule was posted' : 'No schedule yet'"
      :description="
        isOver
          ? 'This competition didn’t post one here. Its results are under Results.'
          : 'Platforms and dancing order show up here once the organisers post it.'
      "
    />

    <section v-for="d in dayList" :key="d.day.id" class="space-y-3">
      <h2 v-if="dayList.length > 1" class="text-title pt-2">
        {{ d.day.name || formatWeekday(d.day.date) || 'Day' }}
      </h2>
      <div
        v-if="d.day.description"
        class="text-muted-foreground text-[0.9375rem]"
        v-html="sanitizeRichText(d.day.description)"
      />

      <section v-for="b in d.blocks" :key="b.block.id">
        <h3
          class="bg-background sticky top-(--chrome-top) z-10 flex items-baseline justify-between gap-2 py-2 text-[1.0625rem] font-extrabold"
        >
          <span class="truncate">{{ b.block.name || 'Session' }}</span>
          <span v-if="b.time" class="text-muted-foreground shrink-0 text-sm font-bold tabular-nums">{{ b.time }}</span>
        </h3>
        <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
          <li v-for="{ event, info: i } in b.events" :key="event.id">
            <RouterLink
              :to="{
                name: 'competition.event',
                params: { competitionId, dayId: d.day.id, blockId: b.block.id, eventId: event.id },
              }"
              class="relative flex min-h-14 items-center gap-3 py-2.5 pr-2 pl-4 hover:bg-accent"
              :style="i.mine.length ? { '--dc': i.mine[0].color ?? 'var(--primary)' } : undefined"
            >
              <span v-if="i.mine.length" class="sash absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
              <span class="min-w-0 flex-1">
                <span class="block text-base leading-snug font-bold">{{ event.name || 'Event' }}</span>
                <span v-if="event.description" class="text-muted-foreground block truncate text-sm">
                  {{ slugline(event.description) }}
                </span>
                <MyDancerLine
                  v-for="m in i.mine"
                  :key="m.dancer.id"
                  :color="m.color"
                  :name="m.dancer.firstName ?? ''"
                  :details="[`#${m.dancer.number}`, m.platform ? `Platform ${m.platform}` : null]"
                  class="mt-1"
                />
              </span>
              <ResultsMark :posted="i.posted" :total="i.total" />
              <ChevronRight class="text-muted-foreground size-5 shrink-0" />
            </RouterLink>
          </li>
          <li v-if="!b.events.length" class="text-muted-foreground px-4 py-3 text-base">Nothing listed yet.</li>
        </ul>
      </section>
    </section>
  </div>
</template>
