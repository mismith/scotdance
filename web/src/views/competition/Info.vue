<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChevronRight, MapPin } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import CompChip from '@/components/CompChip.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import StaffAvatar from '@/components/StaffAvatar.vue'
import StaffDialog from '@/components/StaffDialog.vue'
import { staffMemberName, type StaffMember } from '@/types/competition'
import { blocks, days, events } from '@/lib/schedule'
import {
  formatExternalURL,
  formatHumanURL,
  formatDateTime,
  formatMonthAbbrev,
  isBeforeToday,
  isPast,
  isSameDay,
  parseDate,
} from '@/lib/format'

const {
  competition,
  staff,
  loadStaff,
  dancers,
  loadDancers,
  dances,
  loadResults,
  schedule,
  loadSchedule,
} = useCompetition()

onMounted(() => {
  loadStaff()
  loadDancers()
  loadResults()
  loadSchedule()
})

const eventCount = computed(() => {
  if (!schedule.value) return 0
  return days(schedule.value).reduce(
    (total, day) =>
      total + blocks(day).reduce((sum, block) => sum + events(block).length, 0),
    0,
  )
})

const isToday = computed(() => isSameDay(competition.value?.date))
const datePast = computed(() => {
  const d = competition.value?.date
  return d != null && isBeforeToday(d)
})

const monthLabel = computed(() => {
  const d = competition.value?.date
  return d == null
    ? ''
    : formatMonthAbbrev(d).toUpperCase()
})

const dayLabel = computed(() => {
  const d = competition.value?.date
  return d == null ? '' : String(parseDate(d).getDate())
})

const yearLabel = computed(() => {
  const d = competition.value?.date
  if (d == null) return ''
  if (isToday.value) return 'TODAY'
  return String(parseDate(d).getFullYear())
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

const stats = computed(() => {
  const list: Array<{ value: string; label: string }> = []
  if (dancers.value.length) {
    list.push({ value: String(dancers.value.length), label: 'Dancers' })
  }
  if (eventCount.value) {
    list.push({
      value: String(eventCount.value),
      label: eventCount.value === 1 ? 'Event' : 'Events',
    })
  }
  if (dances.value.length) {
    list.push({
      value: String(dances.value.length),
      label: dances.value.length === 1 ? 'Dance' : 'Dances',
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
  return [...groups.entries()].map(([type, members]) => ({
    type,
    members,
    showAvatars: members.length > 0 && members.every((m) => !!m.image),
  }))
})

const activeStaff = ref<StaffMember | null>(null)
function openStaff(member: StaffMember) {
  activeStaff.value = member
}
function closeStaff() {
  activeStaff.value = null
}
</script>

<template>
  <article v-if="competition" class="space-y-5">
    <header class="space-y-3 pr-16">
      <CompChip
        :name="competition.name"
        :image="competition.image"
        class="size-18 rounded-2xl [view-transition-class:nav-avatar] [view-transition-name:comp-avatar]"
      />
      <h1
        class="text-title [view-transition-class:fit_nav-title] [view-transition-name:comp-name]"
      >
        {{ competition.name ?? '?' }}
      </h1>
    </header>

    <!-- Date / Venue card -->
    <section
      v-if="competition.date || competition.venue"
      class="bg-card overflow-hidden rounded-2xl border shadow-sm"
    >
      <div class="flex items-stretch">
        <div
          v-if="competition.date"
          class="bg-background flex min-w-28 shrink-0 items-stretch border-r py-4"
        >
          <div
            class="flex flex-1 flex-col items-center justify-center gap-1"
          >
            <div class="text-foreground/65 text-xs text-eyebrow">
              {{ monthLabel }}
            </div>
            <div
              class="text-5xl leading-none font-medium tracking-tight tabular-nums"
            >
              {{ dayLabel }}
            </div>
            <div
              :class="[
                'text-sm font-bold tracking-[0.14em] tabular-nums',
                datePast ? 'text-muted-foreground' : 'text-secondary',
              ]"
            >
              {{ yearLabel }}
            </div>
          </div>
        </div>
        <component
          :is="mapsHref ? 'a' : 'div'"
          :href="mapsHref ?? undefined"
          :target="mapsHref ? '_blank' : undefined"
          :rel="mapsHref ? 'noopener' : undefined"
          class="flex flex-1 items-center p-3"
        >
          <div class="flex flex-1 items-center gap-2">
            <div class="flex min-w-0 flex-1 flex-col justify-center gap-1">
              <div v-if="competition.venue" class="flex items-center gap-1.5">
                <MapPin class="text-muted-foreground -mt-1 size-6 shrink-0" />
                <span class="text-xl leading-snug font-medium tracking-tight">
                  {{ competition.venue }}
                </span>
              </div>
              <div
                v-if="competition.address || competition.location"
                class="text-muted-foreground space-y-0.5 pl-8 text-sm"
              >
                <div v-if="competition.address">{{ competition.address }}</div>
                <div v-if="competition.location">{{ competition.location }}</div>
              </div>
            </div>
            <ChevronRight v-if="mapsHref" class="text-muted-foreground size-4 shrink-0" />
          </div>
        </component>
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
          class="text-4xl leading-none font-medium tracking-tight tabular-nums"
        >
          {{ stat.value }}
        </div>
        <div
          class="text-foreground/65 mt-1 text-xs text-eyebrow"
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
        class="bg-primary text-primary-foreground inline-flex items-center rounded-full px-5 py-2 text-lg font-medium hover:opacity-90 aria-disabled:pointer-events-none aria-disabled:opacity-50"
      >
        Register
      </a>
      <ul v-if="registrationStatus" class="text-muted-foreground space-y-0.5">
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
        class="bg-card hover:bg-accent inline-flex items-center rounded-full border px-3 py-1.5 text-lg"
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
      <div class="columns-2 gap-4 px-1 [column-fill:balance]">
        <button
          v-for="member in group.members"
          :key="member.id"
          type="button"
          class="mb-2 flex w-full break-inside-avoid items-center gap-3 rounded-md py-1 text-left hover:bg-accent/40"
          @click="openStaff(member)"
        >
          <StaffAvatar v-if="group.showAvatars" :member="member" :size="40" />
          <div class="min-w-0 flex-1">
            <div class="text-item-title truncate">
              {{ staffMemberName(member) }}
            </div>
            <div
              v-if="member.location"
              class="text-item-subtitle text-muted-foreground truncate"
            >
              {{ member.location }}
            </div>
          </div>
        </button>
      </div>
    </section>

    <StaffDialog :member="activeStaff" @close="closeStaff" />

    <!-- Sanction footer -->
    <div
      v-if="competition.sobhd"
      class="text-muted-foreground flex items-center justify-between pt-2"
    >
      <span class="italic">RSOBHD sanctioned</span>
      <span class="tracking-wider tabular-nums">{{ competition.sobhd }}</span>
    </div>
  </article>
</template>
