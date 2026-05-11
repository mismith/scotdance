<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { CalendarDays, ChevronRight } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { blocks, days, events, slugline } from '@/lib/schedule'
import { formatWeekday } from '@/lib/format'
import DisclosureHeader from '@/components/DisclosureHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import SmoothCollapse from '@/components/SmoothCollapse.vue'

const { competitionId, schedule, loadSchedule, hasSchedule } = useCompetition()

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

</script>

<template>
  <div class="space-y-8">
    <div v-if="hasSchedule === null" class="space-y-6" aria-busy="true" aria-live="polite">
      <span class="sr-only">Loading schedule…</span>
      <div v-for="i in 2" :key="i" class="space-y-3">
        <Skeleton class="h-7 w-1/3" />
        <Skeleton v-for="j in 3" :key="j" class="h-12 w-full" />
      </div>
    </div>
    <EmptyState
      v-else-if="hasSchedule === false"
      :icon="CalendarDays"
      title="No schedule yet"
      description="The competition organizers haven’t posted a schedule. Check back closer to the date."
    />

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
        <DisclosureHeader
          :label="block.name || 'Block'"
          :expanded="isExpanded(day.id, block.id, !!block.events)"
          @toggle="toggle(day.id, block.id, !!block.events)"
        >
          <span
            v-if="block.description"
            class="text-muted-foreground max-w-[40%] truncate text-sm"
          >
            {{ slugline(block.description) }}
          </span>
        </DisclosureHeader>

        <SmoothCollapse :open="isExpanded(day.id, block.id, !!block.events)">
          <ul>
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
                    class="text-item-title truncate"
                  >
                    {{ event.name || 'Event' }}
                  </div>
                  <div
                    v-if="event.description"
                    class="text-item-meta text-muted-foreground mt-1 truncate"
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
