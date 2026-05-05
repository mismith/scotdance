<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { ChevronDown, ChevronRight } from '@lucide/vue';
import { useCompetition } from '@/composables/useCompetition';
import { blocks, days, events, slugline } from '@/lib/schedule';
import { formatWeekday } from '@/lib/format';

const { competitionId, schedule, loadSchedule } = useCompetition();

onMounted(loadSchedule);

const dayList = computed(() => days(schedule.value));

const expanded = useLocalStorage<Record<string, Record<string, boolean>>>(
  'schedule:expandedBlocks',
  {},
);

function isExpanded(dayId: string, blockId: string, hasEvents: boolean): boolean {
  const map = expanded.value[dayId] ?? {};
  if (blockId in map) return map[blockId];
  return hasEvents;
}

function toggle(dayId: string, blockId: string, hasEvents: boolean) {
  const current = expanded.value[dayId] ?? {};
  expanded.value = {
    ...expanded.value,
    [dayId]: { ...current, [blockId]: !isExpanded(dayId, blockId, hasEvents) },
  };
}

const isEmpty = computed(
  () => schedule.value !== null && dayList.value.length === 0,
);
</script>

<template>
  <div class="space-y-8">
    <div v-if="schedule === null" class="text-muted-foreground text-sm">Loading…</div>
    <div v-else-if="isEmpty" class="text-muted-foreground text-sm">
      No schedule yet. Check back later.
    </div>

    <section v-for="day in dayList" :key="day.id" class="space-y-4">
      <header>
        <h2 class="text-lg font-semibold">
          {{ day.name || formatWeekday(day.date) || 'Day' }}
        </h2>
        <p
          v-if="day.description"
          class="text-sm text-muted-foreground whitespace-pre-line mt-1"
        >
          {{ day.description }}
        </p>
      </header>

      <div v-for="block in blocks(day)" :key="block.id" class="space-y-2">
        <button
          type="button"
          class="w-full flex items-center gap-2 px-1 py-1 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground"
          @click="toggle(day.id, block.id, !!block.events)"
        >
          <ChevronDown
            :class="[
              'size-4 transition-transform',
              isExpanded(day.id, block.id, !!block.events) ? '' : '-rotate-90',
            ]"
          />
          <span class="flex-1 text-left">{{ block.name || 'Block' }}</span>
          <span
            v-if="block.description"
            class="text-xs font-normal normal-case tracking-normal text-muted-foreground truncate max-w-[50%]"
          >
            {{ slugline(block.description) }}
          </span>
        </button>

        <ul
          v-if="isExpanded(day.id, block.id, !!block.events)"
          class="divide-y border rounded-md"
        >
          <li
            v-for="event in events(block)"
            :key="event.id"
            class="flex items-center"
          >
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
              class="flex items-center gap-3 p-3 flex-1 min-w-0 hover:bg-accent"
            >
              <div class="min-w-0 flex-1">
                <div class="font-medium truncate">{{ event.name || 'Event' }}</div>
                <div
                  v-if="event.description"
                  class="text-xs text-muted-foreground truncate"
                >
                  {{ slugline(event.description) }}
                </div>
              </div>
              <ChevronRight class="size-4 text-muted-foreground shrink-0" />
            </RouterLink>
          </li>
          <li v-if="!events(block).length" class="p-3 text-sm text-muted-foreground">
            No events.
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
