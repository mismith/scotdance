<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useLocalStorage } from '@vueuse/core';
import { ChevronDown, Star } from 'lucide-vue-next';
import { useCompetition } from '@/composables/useCompetition';
import { dances as eventDances, getScheduleDanceName } from '@/lib/schedule';
import { findGroupDancers } from '@/lib/results';
import { staffMemberName } from '@/types/competition';
import type {
  EnrichedGroup,
  ScheduleDance,
  StaffMember,
} from '@/types/competition';
import { useFavoritesStore } from '@/stores/favorites';

const route = useRoute();
const {
  competitionId,
  schedule,
  platforms,
  groups,
  dancers,
  dances,
  staff,
  loadSchedule,
  loadDancers,
  loadResults,
  loadStaff,
} = useCompetition();
const favorites = useFavoritesStore();

onMounted(async () => {
  await Promise.all([loadSchedule(), loadDancers(), loadResults(), loadStaff()]);
});

const dayId = computed(() => String(route.params.dayId ?? ''));
const blockId = computed(() => String(route.params.blockId ?? ''));
const eventId = computed(() => String(route.params.eventId ?? ''));

const day = computed(() => schedule.value?.days?.[dayId.value] ?? null);
const block = computed(() => day.value?.blocks?.[blockId.value] ?? null);
const event = computed(() => block.value?.events?.[eventId.value] ?? null);

const eventDanceList = computed(() =>
  event.value ? eventDances({ dances: event.value.dances }) : [],
);

const expanded = useLocalStorage<Record<string, Record<string, boolean>>>(
  'schedule:expandedDances',
  {},
);

function danceHasContent(dance: ScheduleDance): boolean {
  return Boolean(dance.description || (dance.danceId && dance.platforms));
}

function isExpanded(danceId: string, hasContent: boolean): boolean {
  const map = expanded.value[eventId.value] ?? {};
  if (danceId in map) return map[danceId];
  return hasContent;
}

function toggle(danceId: string, hasContent: boolean) {
  const current = expanded.value[eventId.value] ?? {};
  expanded.value = {
    ...expanded.value,
    [eventId.value]: { ...current, [danceId]: !isExpanded(danceId, hasContent) },
  };
}

interface PlatformPool {
  id: string;
  name: string;
  judges: StaffMember[];
  groups: EnrichedGroup[];
}

function buildPools(dance: ScheduleDance): PlatformPool[] {
  const judgeById = new Map(staff.value.map((m) => [m.id, m]));
  const groupById = new Map(groups.value.map((g) => [g.id, g]));
  return platforms.value
    .map<PlatformPool | null>((platform) => {
      const slot = dance.platforms?.[platform.id];
      if (!slot) return null;
      const judges = (slot.orderedJudgeIds ?? [])
        .map((id) => judgeById.get(id))
        .filter((j): j is StaffMember => Boolean(j) && j!.type === 'Judge');
      const platformGroups = (slot.orderedGroupIds ?? [])
        .map((id) => groupById.get(id))
        .filter((g): g is EnrichedGroup => Boolean(g));
      if (!judges.length && !platformGroups.length) return null;
      return {
        id: platform.id,
        name: platform.name || 'Platform',
        judges,
        groups: platformGroups,
      };
    })
    .filter((p): p is PlatformPool => p !== null);
}

function groupDancerCount(group: EnrichedGroup): number {
  return findGroupDancers(group.id, dancers.value).length;
}

function groupHasFavorite(group: EnrichedGroup): boolean {
  return findGroupDancers(group.id, dancers.value).some((d) =>
    favorites.isFavoriteDancer(d.id),
  );
}
</script>

<template>
  <article class="space-y-6">
    <RouterLink
      :to="{ name: 'competition.schedule', params: { competitionId } }"
      class="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
    >
      ← Schedule
    </RouterLink>

    <div v-if="schedule === null" class="text-muted-foreground text-sm">Loading…</div>

    <div v-else-if="!event" class="text-muted-foreground text-sm">Event not found.</div>

    <template v-else>
      <header>
        <div class="text-xs uppercase tracking-wide text-muted-foreground">
          {{ day?.name }} <span v-if="block?.name">› {{ block.name }}</span>
        </div>
        <h2 class="text-2xl font-semibold">{{ event.name || 'Event' }}</h2>
        <p
          v-if="event.description"
          class="text-sm whitespace-pre-line mt-2"
        >
          {{ event.description }}
        </p>
      </header>

      <div v-if="!eventDanceList.length" class="text-sm text-muted-foreground">
        No dances scheduled.
      </div>

      <section
        v-for="dance in eventDanceList"
        :key="dance.id"
        class="space-y-2"
      >
        <button
          type="button"
          class="w-full flex items-center gap-2 px-1 py-1 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground"
          :disabled="!danceHasContent(dance)"
          @click="toggle(dance.id, danceHasContent(dance))"
        >
          <ChevronDown
            v-if="danceHasContent(dance)"
            :class="[
              'size-4 transition-transform',
              isExpanded(dance.id, danceHasContent(dance)) ? '' : '-rotate-90',
            ]"
          />
          <span v-else class="size-4 shrink-0" />
          <span class="flex-1 text-left">
            {{ getScheduleDanceName(dance, dances) || 'Dance' }}
          </span>
        </button>

        <div
          v-if="danceHasContent(dance) && isExpanded(dance.id, danceHasContent(dance))"
          class="space-y-3"
        >
          <p
            v-if="dance.description"
            class="text-sm whitespace-pre-line px-1"
          >
            {{ dance.description }}
          </p>

          <div
            v-if="dance.danceId && buildPools(dance).length"
            class="grid gap-3 sm:grid-cols-2"
          >
            <div
              v-for="pool in buildPools(dance)"
              :key="pool.id"
              class="border rounded-md p-3 space-y-3"
            >
              <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {{ pool.name }}
              </div>

              <div v-if="pool.judges.length" class="flex flex-wrap gap-1.5">
                <span
                  v-for="judge in pool.judges"
                  :key="judge.id"
                  class="inline-flex items-center px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                >
                  {{ staffMemberName(judge) || 'Judge' }}
                </span>
              </div>

              <ul v-if="pool.groups.length" class="space-y-1">
                <li
                  v-for="group in pool.groups"
                  :key="group.id"
                  class="flex items-center gap-2 text-sm"
                >
                  <span
                    :class="[
                      'inline-flex items-center justify-center size-6 rounded-full text-xs font-mono shrink-0',
                      groupHasFavorite(group)
                        ? 'bg-secondary text-secondary-foreground'
                        : 'bg-muted text-muted-foreground',
                    ]"
                  >
                    {{ groupDancerCount(group) }}
                  </span>
                  <span class="truncate">{{ group.name || group.fullName }}</span>
                  <Star
                    v-if="groupHasFavorite(group)"
                    class="size-3 text-secondary fill-current shrink-0"
                  />
                </li>
              </ul>
            </div>
          </div>

          <div
            v-else-if="dance.danceId"
            class="text-xs text-muted-foreground px-1"
          >
            Platforms not yet assigned.
          </div>
        </div>
      </section>
    </template>
  </article>
</template>
