<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useCompetition } from '@/composables/useCompetition';
import type { EnrichedDancer } from '@/types/competition';

const { competitionId, dancers, loadDancers } = useCompetition();

onMounted(loadDancers);

const filter = ref('');

const matches = (d: EnrichedDancer, q: string) => {
  const haystack = [
    d.fullName,
    d.number != null ? String(d.number) : '',
    d.location ?? '',
    d.group?.fullName ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
};

const dancerNumber = (d: EnrichedDancer) =>
  d.number != null && Number.isFinite(d.number) ? d.number : Number.POSITIVE_INFINITY;

const filteredDancers = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return dancers.value;
  return dancers.value.filter((d) => matches(d, q));
});

interface DancerGroupRow {
  groupName: string;
  groupOrder: number;
  members: EnrichedDancer[];
}

const grouped = computed<DancerGroupRow[]>(() => {
  const map = new Map<string, DancerGroupRow>();
  for (const dancer of filteredDancers.value) {
    const groupName = dancer.group?.fullName || 'Unassigned';
    const groupOrder = dancer.group?._order ?? Number.POSITIVE_INFINITY;
    let row = map.get(groupName);
    if (!row) {
      row = { groupName, groupOrder, members: [] };
      map.set(groupName, row);
    }
    row.members.push(dancer);
  }
  for (const row of map.values()) {
    row.members.sort((a, b) => dancerNumber(a) - dancerNumber(b));
  }
  return [...map.values()].sort((a, b) => a.groupOrder - b.groupOrder);
});
</script>

<template>
  <div class="space-y-4">
    <input
      v-model="filter"
      type="search"
      placeholder="Search dancers…"
      class="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    />

    <div v-if="!dancers.length" class="text-muted-foreground text-sm">
      No dancers loaded yet.
    </div>
    <div v-else-if="!grouped.length" class="text-muted-foreground text-sm">
      No matches.
    </div>

    <section v-for="group in grouped" :key="group.groupName" class="space-y-2">
      <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <span>{{ group.groupName }}</span>
        <span class="text-xs font-normal normal-case tracking-normal">
          ({{ group.members.length }})
        </span>
      </h3>
      <ul class="divide-y border rounded-md">
        <li v-for="dancer in group.members" :key="dancer.id">
          <RouterLink
            :to="{ name: 'competition.dancer', params: { competitionId, dancerId: dancer.id } }"
            class="flex items-center gap-3 p-3 hover:bg-accent"
          >
            <div
              class="size-8 rounded-full bg-muted text-xs font-mono flex items-center justify-center text-muted-foreground shrink-0"
            >
              {{ dancer.number ?? '–' }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-medium truncate">{{ dancer.fullName || '?' }}</div>
              <div v-if="dancer.location" class="text-xs text-muted-foreground truncate">
                {{ dancer.location }}
              </div>
            </div>
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>
