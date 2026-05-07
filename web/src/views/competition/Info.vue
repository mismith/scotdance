<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { MapPin } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import SectionHeader from '@/components/SectionHeader.vue'
import { staffMemberName, type StaffMember } from '@/types/competition'
import {
  formatExternalURL,
  formatHumanURL,
  formatDateTime,
  isPast,
  isSameDay,
} from '@/lib/format'

const {
  competition,
  staff,
  loadStaff,
  dancers,
  categories,
  loadDancers,
  schedule,
  loadSchedule,
} = useCompetition()

onMounted(() => {
  loadStaff()
  loadDancers()
  loadSchedule()
})

const isToday = computed(() => isSameDay(competition.value?.date))
const datePast = computed(() => {
  const d = competition.value?.date
  return d != null && isPast(d) && !isSameDay(d)
})

const monthLabel = computed(() => {
  const d = competition.value?.date
  return d == null
    ? ''
    : new Date(d).toLocaleString('en-US', { month: 'short' }).toUpperCase()
})

const dayLabel = computed(() => {
  const d = competition.value?.date
  return d == null ? '' : String(new Date(d).getDate())
})

const yearLabel = computed(() => {
  const d = competition.value?.date
  if (d == null) return ''
  if (isToday.value) return 'TODAY'
  return String(new Date(d).getFullYear())
})

const addressLine = computed(() => {
  const c = competition.value
  if (!c) return ''
  return [c.address, c.location].filter(Boolean).join(' · ')
})

const mapsHref = computed(() => {
  const c = competition.value
  if (!c?.venue && !c?.address && !c?.location) return null
  const parts = [c.venue, c.address, c.location].filter(Boolean).join(', ')
  return `https://maps.google.com/?q=${encodeURIComponent(parts)}`
})

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

const scheduleDayCount = computed(() => {
  const days = schedule.value?.days
  return days ? Object.keys(days).length : 0
})

const stats = computed(() => {
  const list: Array<{ value: string; label: string }> = []
  if (dancers.value.length) {
    list.push({ value: String(dancers.value.length), label: 'Dancers' })
  }
  if (categories.value.length) {
    list.push({ value: String(categories.value.length), label: 'Categories' })
  }
  if (scheduleDayCount.value) {
    list.push({
      value: String(scheduleDayCount.value),
      label: scheduleDayCount.value === 1 ? 'Day' : 'Days',
    })
  }
  return list
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
  <article v-if="competition" class="space-y-5">
    <!-- Date / Venue card -->
    <section
      v-if="competition.date || competition.venue"
      class="bg-card overflow-hidden rounded-2xl border shadow-sm"
    >
      <div class="flex items-stretch">
        <div
          v-if="competition.date"
          class="bg-background flex w-20 shrink-0 flex-col items-center justify-center border-r py-3"
        >
          <div class="text-muted-foreground text-[10px] font-bold tracking-[0.14em]">
            {{ monthLabel }}
          </div>
          <div
            class="font-serif text-4xl leading-none font-medium tracking-tight tabular-nums"
          >
            {{ dayLabel }}
          </div>
          <div
            :class="[
              'mt-1 text-[10px] font-bold tracking-[0.12em]',
              datePast ? 'text-muted-foreground' : 'text-secondary',
            ]"
          >
            {{ yearLabel }}
          </div>
        </div>
        <div class="flex flex-1 flex-col justify-center gap-1 p-3">
          <div
            v-if="competition.venue"
            class="font-serif text-[15px] leading-snug font-medium tracking-tight"
          >
            {{ competition.venue }}
          </div>
          <component
            :is="mapsHref ? 'a' : 'div'"
            v-if="addressLine"
            :href="mapsHref ?? undefined"
            target="_blank"
            rel="noopener"
            :class="[
              'text-muted-foreground inline-flex items-center gap-1.5 text-[11.5px]',
              mapsHref && 'hover:text-foreground',
            ]"
          >
            <MapPin class="size-3 shrink-0" />
            <span class="truncate">{{ addressLine }}</span>
          </component>
        </div>
      </div>
    </section>

    <!-- Stat tiles -->
    <section
      v-if="stats.length"
      :class="[
        'grid gap-2',
        stats.length === 1 && 'grid-cols-1',
        stats.length === 2 && 'grid-cols-2',
        stats.length >= 3 && 'grid-cols-3',
      ]"
    >
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="bg-card flex flex-col items-center rounded-xl border py-2.5 shadow-sm"
      >
        <div
          class="font-serif text-2xl leading-none font-medium tracking-tight tabular-nums"
        >
          {{ stat.value }}
        </div>
        <div
          class="text-muted-foreground mt-1 text-[10px] font-bold tracking-[0.14em] uppercase"
        >
          {{ stat.label }}
        </div>
      </div>
    </section>

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

    <!-- Staff as two-column credits -->
    <section v-for="group in groupedStaff" :key="group.type" class="space-y-3">
      <SectionHeader :label="`${group.type}s`" :count="group.members.length" />
      <div class="columns-2 gap-4 [column-fill:balance]">
        <div
          v-for="member in group.members"
          :key="member.id"
          class="mb-2 break-inside-avoid"
        >
          <div class="font-serif text-[14px] leading-tight font-medium tracking-tight">
            {{ staffMemberName(member) }}
          </div>
          <div
            v-if="member.location"
            class="text-muted-foreground font-serif text-[11px] italic"
          >
            {{ member.location }}
          </div>
        </div>
      </div>
    </section>

    <!-- Sanction footer -->
    <div
      v-if="competition.sobhd"
      class="text-muted-foreground flex items-center justify-between pt-2 text-[11px]"
    >
      <span class="font-serif italic">RSOBHD sanctioned</span>
      <span class="tracking-wider tabular-nums">{{ competition.sobhd }}</span>
    </div>
  </article>
</template>
