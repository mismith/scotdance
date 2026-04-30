<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useCompetition } from '@/composables/useCompetition';
import { staffMemberName, type StaffMember } from '@/types/competition';
import {
  formatExternalURL,
  formatHumanURL,
  formatLongDate,
  formatDateTime,
  isPast,
  isSameDay,
} from '@/lib/format';

const { competition, staff, loadStaff } = useCompetition();

onMounted(loadStaff);

const isToday = computed(() => isSameDay(competition.value?.date));

const registrationOpen = computed(() => {
  const end = competition.value?.registrationEnd;
  return end == null || !isPast(end);
});

const registrationStatus = computed(() => {
  const c = competition.value;
  if (!c) return null;
  const lines: string[] = [];
  if (c.registrationStart) {
    const verb = isPast(c.registrationStart) ? 'opened' : 'opens';
    lines.push(`Registration ${verb} ${formatDateTime(c.registrationStart)}`);
  }
  if (c.registrationEnd) {
    const verb = isPast(c.registrationEnd) ? 'closed' : 'closes';
    lines.push(`Registration ${verb} ${formatDateTime(c.registrationEnd)}`);
  }
  return lines.length ? lines : null;
});

const mapsHref = computed(() => {
  const c = competition.value;
  if (!c?.venue) return null;
  const parts = [c.venue, c.address, c.location].filter(Boolean).join(', ');
  return `https://maps.google.com/?q=${encodeURIComponent(parts)}`;
});

const groupedStaff = computed(() => {
  const groups = new Map<string, StaffMember[]>();
  for (const member of staff.value) {
    if (!member.type) continue;
    const list = groups.get(member.type) ?? [];
    list.push(member);
    groups.set(member.type, list);
  }
  return [...groups.entries()].map(([type, members]) => ({ type, members }));
});
</script>

<template>
  <article v-if="competition" class="space-y-6">
    <header class="flex flex-wrap gap-6">
      <img
        v-if="competition.image"
        :src="competition.image"
        :alt="competition.name ?? ''"
        class="size-40 rounded-md object-cover bg-muted shadow"
      />
      <div class="flex-1 min-w-0 space-y-2">
        <h2 class="text-2xl font-semibold">{{ competition.name }}</h2>
        <p v-if="competition.date" class="text-base flex items-center gap-2">
          {{ formatLongDate(competition.date) }}
          <span
            v-if="isToday"
            class="inline-block px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground"
          >Today</span>
        </p>
        <div v-if="competition.venue" class="text-sm text-muted-foreground">
          <a
            v-if="mapsHref"
            :href="mapsHref"
            target="_blank"
            rel="noopener"
            class="underline hover:text-foreground"
          >{{ competition.venue }}</a>
          <span v-else>{{ competition.venue }}</span>
        </div>
        <div v-if="competition.location" class="text-sm text-muted-foreground">
          {{ competition.location }}
        </div>
      </div>
    </header>

    <section v-if="competition.registrationURL" class="space-y-2">
      <a
        :href="formatExternalURL(competition.registrationURL)"
        target="_blank"
        rel="noopener"
        :aria-disabled="!registrationOpen"
        class="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 aria-disabled:opacity-50 aria-disabled:pointer-events-none"
      >
        Register
      </a>
      <ul v-if="registrationStatus" class="text-xs text-muted-foreground space-y-0.5">
        <li v-for="line in registrationStatus" :key="line">{{ line }}</li>
      </ul>
    </section>

    <section v-if="competition.links?.length" class="flex flex-wrap gap-2">
      <a
        v-for="link in competition.links"
        :key="link.url"
        :href="formatExternalURL(link.url)"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center px-3 py-1.5 rounded-md border text-sm hover:bg-accent"
      >
        {{ link.name || formatHumanURL(link.url) }}
      </a>
    </section>

    <section v-if="competition.description" class="prose prose-sm max-w-none whitespace-pre-line">
      {{ competition.description }}
    </section>

    <p v-if="competition.sobhd" class="text-xs text-muted-foreground">
      <strong>RSOBHD</strong> {{ competition.sobhd }}
    </p>

    <section v-if="groupedStaff.length" class="space-y-4">
      <div v-for="group in groupedStaff" :key="group.type">
        <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          {{ group.type }}s
        </h3>
        <ul class="divide-y border rounded-md">
          <li
            v-for="member in group.members"
            :key="member.id"
            class="flex items-center gap-3 p-3"
          >
            <img
              v-if="member.image"
              :src="member.image"
              :alt="staffMemberName(member)"
              class="size-10 rounded-full object-cover bg-muted"
            />
            <div v-else class="size-10 rounded-full bg-muted" />
            <div class="min-w-0 flex-1">
              <div class="font-medium truncate">{{ staffMemberName(member) }}</div>
              <div v-if="member.location" class="text-xs text-muted-foreground truncate">
                {{ member.location }}
              </div>
            </div>
          </li>
        </ul>
      </div>
    </section>
  </article>
</template>
