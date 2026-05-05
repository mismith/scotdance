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
    <header class="flex flex-wrap gap-6">
      <img
        v-if="competition.image"
        :src="competition.image"
        :alt="competition.name ?? ''"
        class="bg-muted size-40 rounded-md object-cover shadow"
      />
      <div class="min-w-0 flex-1 space-y-2">
        <h2 class="text-2xl font-semibold">{{ competition.name }}</h2>
        <p v-if="competition.date" class="flex items-center gap-2 text-base">
          {{ formatLongDate(competition.date) }}
          <span
            v-if="isToday"
            class="bg-primary text-primary-foreground inline-block rounded-full px-2 py-0.5 text-xs"
            >Today</span
          >
        </p>
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
        <div v-if="competition.location" class="text-muted-foreground text-sm">
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
        class="bg-primary text-primary-foreground inline-flex items-center rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 aria-disabled:pointer-events-none aria-disabled:opacity-50"
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
        class="hover:bg-accent inline-flex items-center rounded-md border px-3 py-1.5 text-sm"
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
          class="text-muted-foreground mb-2 text-sm font-semibold tracking-wide uppercase"
        >
          {{ group.type }}s
        </h3>
        <ul class="divide-y rounded-md border">
          <li
            v-for="member in group.members"
            :key="member.id"
            class="flex items-center gap-3 p-3"
          >
            <img
              v-if="member.image"
              :src="member.image"
              :alt="staffMemberName(member)"
              class="bg-muted size-10 rounded-full object-cover"
            />
            <div v-else class="bg-muted size-10 rounded-full" />
            <div class="min-w-0 flex-1">
              <div class="truncate font-medium">{{ staffMemberName(member) }}</div>
              <div v-if="member.location" class="text-muted-foreground truncate text-xs">
                {{ member.location }}
              </div>
            </div>
          </li>
        </ul>
      </div>
    </section>
  </article>
</template>
