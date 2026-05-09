<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { ChevronDown, ChevronRight } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { blocks, days, events, slugline } from '@/lib/schedule'
import { formatWeekday } from '@/lib/format'
import SmoothCollapse from '@/components/SmoothCollapse.vue'

const { competitionId, schedule, loadSchedule } = useCompetition()

onMounted(loadSchedule)

const dayList = computed(() => days(schedule.value))

const expanded = useLocalStorage<Record<string, Record<string, boolean>>>(
  'schedule:expandedBlocks',
  {},
)

function isExpanded(dayId: string, blockId: string, hasEvents: boolean): boolean {
  const map = expanded.value[dayId] ?? {}
  if (blockId in map) return map[blockId]
  return hasEvents
}

function toggle(dayId: string, blockId: string, hasEvents: boolean) {
  const current = expanded.value[dayId] ?? {}
  expanded.value = {
    ...expanded.value,
    [dayId]: { ...current, [blockId]: !isExpanded(dayId, blockId, hasEvents) },
  }
}

const isEmpty = computed(() => schedule.value !== null && dayList.value.length === 0)
</script>

<template>
  <div class="space-y-8">
    <div v-if="schedule === null" class="text-muted-foreground font-serif text-lg italic">
      Loading…
    </div>
    <div v-else-if="isEmpty" class="text-muted-foreground text-lg">
      No schedule yet. Check back later.
    </div>

    <section v-for="day in dayList" :key="day.id" class="space-y-4">
      <header>
        <h2 class="font-serif text-3xl font-medium tracking-tight">
          {{ day.name || formatWeekday(day.date) || 'Day' }}
        </h2>
        <p
          v-if="day.description"
          class="text-muted-foreground mt-1 text-lg whitespace-pre-line"
        >
          {{ day.description }}
        </p>
      </header>

      <div v-for="block in blocks(day)" :key="block.id" class="space-y-1">
        <button
          type="button"
          class="flex w-full items-baseline gap-2 px-1 py-2 text-left"
          @click="toggle(day.id, block.id, !!block.events)"
        >
          <ChevronDown
            :class="[
              'text-muted-foreground size-4 shrink-0 self-center transition-transform',
              isExpanded(day.id, block.id, !!block.events) ? '' : '-rotate-90',
            ]"
          />
          <span
            class="min-w-0 flex-1 truncate font-serif text-2xl leading-tight font-medium tracking-tight"
          >
            {{ block.name || 'Block' }}
          </span>
          <span
            v-if="block.description"
            class="text-muted-foreground max-w-[40%] truncate text-xs"
          >
            {{ slugline(block.description) }}
          </span>
        </button>

        <SmoothCollapse :open="isExpanded(day.id, block.id, !!block.events)">
          <ul class="border-b">
            <li v-for="event in events(block)" :key="event.id" class="flex items-center">
              <RouterLink
                :to="{
                  name: 'competition.event',
                  params: {
                    competitionId,
                    dayId: day.id,
                    blockId: block.id,
                    eventId: event.id,
                  },
                }"
                class="flex min-w-0 flex-1 items-center gap-3 px-1 py-3"
              >
                <div class="min-w-0 flex-1">
                  <div
                    class="truncate font-serif leading-tight font-medium tracking-tight"
                  >
                    {{ event.name || 'Event' }}
                  </div>
                  <div
                    v-if="event.description"
                    class="text-muted-foreground mt-1 truncate text-xs"
                  >
                    {{ slugline(event.description) }}
                  </div>
                </div>
                <ChevronRight class="text-muted-foreground size-4 shrink-0" />
              </RouterLink>
            </li>
            <li
              v-if="!events(block).length"
              class="text-muted-foreground px-1 py-3 font-serif text-lg italic"
            >
              No events.
            </li>
          </ul>
        </SmoothCollapse>
      </div>
    </section>
  </div>
</template>
