<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useCompetition } from '@/composables/useCompetition'
import { staffMemberName, type StaffMember } from '@/types/competition'
import {
  formatExternalURL,
  formatHumanURL,
  formatLongDate,
  formatDateTime,
  isPast,
  isSameDay,
} from '@/lib/format'

const { competition, staff, loadStaff } = useCompetition()

onMounted(loadStaff)

const isToday = computed(() => isSameDay(competition.value?.date))

const registrationOpen = computed(() => {
  const end = competition.value?.registrationEnd
  return end == null || !isPast(end)
})

const registrationStatus = computed(() => {
  const c = competition.value
  if (!c) return null
  const lines: string[] = []
  if (c.registrationStart) {
    const verb = isPast(c.registrationStart) ? 'opened' : 'opens'
    lines.push(`Registration ${verb} ${formatDateTime(c.registrationStart)}`)
  }
  if (c.registrationEnd) {
    const verb = isPast(c.registrationEnd) ? 'closed' : 'closes'
    lines.push(`Registration ${verb} ${formatDateTime(c.registrationEnd)}`)
  }
  return lines.length ? lines : null
})

const mapsHref = computed(() => {
  const c = competition.value
  if (!c?.venue) return null
  const parts = [c.venue, c.address, c.location].filter(Boolean).join(', ')
  return `https://maps.google.com/?q=${encodeURIComponent(parts)}`
})

const groupedStaff = computed(() => {
  const groups = new Map<string, StaffMember[]>()
  for (const member of staff.value) {
    if (!member.type) continue
    const list = groups.get(member.type) ?? []
    list.push(member)
    groups.set(member.type, list)
  }
  return [...groups.entries()].map(([type, members]) => ({ type, members }))
})
</script>

<template>
  <article v-if="competition" class="space-y-6">
    <!-- Layout chrome already shows the comp identity. Here we surface the
         meta + key actions only. -->
    <header class="space-y-2">
      <div
        v-if="competition.date"
        class="flex flex-wrap items-center gap-2 font-serif text-lg font-medium tracking-tight"
      >
        {{ formatLongDate(competition.date) }}
        <span
          v-if="isToday"
          class="bg-secondary text-secondary-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-[0.14em] uppercase"
        >
          <span class="size-1.5 animate-pulse rounded-full bg-current" />
          Today
        </span>
      </div>
      <div v-if="competition.venue" class="text-muted-foreground text-sm">
        <a
          v-if="mapsHref"
          :href="mapsHref"
          target="_blank"
          rel="noopener"
          class="hover:text-foreground underline"
          >{{ competition.venue }}</a
        >
        <span v-else>{{ competition.venue }}</span>
      </div>
    </header>

    <section v-if="competition.registrationURL" class="space-y-2">
      <a
        :href="formatExternalURL(competition.registrationURL)"
        target="_blank"
        rel="noopener"
        :aria-disabled="!registrationOpen"
        class="bg-primary text-primary-foreground inline-flex items-center rounded-full px-5 py-2 text-sm font-medium hover:opacity-90 aria-disabled:pointer-events-none aria-disabled:opacity-50"
      >
        Register
      </a>
      <ul v-if="registrationStatus" class="text-muted-foreground space-y-0.5 text-xs">
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
        class="bg-card hover:bg-accent inline-flex items-center rounded-full border px-3 py-1.5 text-sm"
      >
        {{ link.name || formatHumanURL(link.url) }}
      </a>
    </section>

    <section
      v-if="competition.description"
      class="prose prose-sm max-w-none whitespace-pre-line"
    >
      {{ competition.description }}
    </section>

    <p v-if="competition.sobhd" class="text-muted-foreground text-xs">
      <strong>RSOBHD</strong> {{ competition.sobhd }}
    </p>

    <section v-if="groupedStaff.length" class="space-y-4">
      <div v-for="group in groupedStaff" :key="group.type">
        <h3
          class="text-muted-foreground mb-2 text-[11px] font-semibold tracking-[0.14em] uppercase"
        >
          {{ group.type }}s
        </h3>
        <ul class="divide-y border-y">
          <li
            v-for="member in group.members"
            :key="member.id"
            class="flex items-center gap-3 px-1 py-3"
          >
            <img
              v-if="member.image"
              :src="member.image"
              :alt="staffMemberName(member)"
              class="bg-muted size-10 rounded-full object-cover"
            />
            <div v-else class="bg-muted size-10 rounded-full" />
            <div class="min-w-0 flex-1">
              <div
                class="font-serif truncate text-[15px] font-medium tracking-tight"
              >
                {{ staffMemberName(member) }}
              </div>
              <div
                v-if="member.location"
                class="text-muted-foreground truncate text-[11.5px]"
              >
                {{ member.location }}
              </div>
            </div>
          </li>
        </ul>
      </div>
    </section>
  </article>
</template>
