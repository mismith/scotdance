<script setup lang="ts">
import { useMorph } from '@/lib/morph'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useIntervalFn } from '@vueuse/core'
import { ChevronRight, Clock, ExternalLink, MapPin, Search, Star, Users } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useCompetitionDays } from '@/composables/useCompetitionDays'
import DateTile from '@/components/DateTile.vue'
import DancerDayCard from '@/components/DancerDayCard.vue'
import { useLiveAlertState } from '@/composables/useLiveAlerts'
import FavoriteButton from '@/components/FavoriteButton.vue'
import StaffAvatar from '@/components/StaffAvatar.vue'
import StaffDialog from '@/components/StaffDialog.vue'
import { staffEntityRef, staffMemberName, type StaffMember } from '@/types/competition'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'
import { blocks, days } from '@/lib/schedule'
import {
  formatDateTime,
  formatExternalURL,
  formatHumanURL,
  formatLongDate,
  formatRelative,
  isPast,
} from '@/lib/format'
import { sanitizeRichText } from '@/lib/sanitize'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { nowMs } from '@/lib/now'

const setHeader = injectInfoHeaderSetter()

const {
  competitionId,
  competition,
  staff,
  loadStaff,
  dancers,
  loadDancers,
  dances,
  loadResults,
  schedule,
  loadSchedule,
  isLive,
  liveResultsAt,
} = useCompetition()
const { phase, followedHere } = useCompetitionDays()
const auth = useAuthStore()
const favorites = useFavoritesStore()

const ready = ref(false)
onMounted(async () => {
  loadStaff()
  await Promise.all([loadDancers(), loadResults(), loadSchedule()])
  ready.value = true
})

const kicker = computed(() => {
  const c = competition.value
  if (!c) return ''
  const where = c.location ? ` · ${c.location}` : ''
  if (phase.value === 'today') return `Today${where}`
  if (c.date == null) return c.location ?? ''
  const rel = formatRelative(c.date)
  return `${formatLongDate(c.date)}${phase.value === 'before' ? ` · ${rel}` : ''}`
})

// "Updated 2 min ago" on a live day, refreshed each minute.
const tick = ref(nowMs())
useIntervalFn(() => (tick.value = nowMs()), 60_000)
const updatedLabel = computed(() => {
  void tick.value
  if (!isLive.value || !liveResultsAt.value) return null
  const mins = Math.max(0, Math.round((nowMs() - liveResultsAt.value) / 60_000))
  return mins < 1 ? 'Results updating live' : `Results updating live · checked ${mins} min ago`
})

const mapsHref = computed(() => {
  const c = competition.value
  if (!c?.venue && !c?.address && !c?.location) return null
  const parts = [c.venue, c.address, c.location].filter(Boolean).join(', ')
  return `https://maps.google.com/?q=${encodeURIComponent(parts)}`
})

const registrationLines = computed(() => {
  const c = competition.value
  if (!c) return []
  const lines: string[] = []
  if (c.registrationStart)
    lines.push(`Registration ${isPast(c.registrationStart) ? 'opened' : 'opens'} ${formatDateTime(c.registrationStart)}`)
  if (c.registrationEnd)
    lines.push(`Registration ${isPast(c.registrationEnd) ? 'closed' : 'closes'} ${formatDateTime(c.registrationEnd)}`)
  return lines
})
const registrationOpen = computed(() => {
  const end = competition.value?.registrationEnd
  return end == null || !isPast(end)
})

// Sessions: the schedule's blocks, with the time organisers put in their
// description ("8:00 am").
const sessions = computed(() =>
  days(schedule.value).flatMap((day, di, all) =>
    blocks(day).map((b) => ({
      id: `${day.id}:${b.id}`,
      day: all.length > 1 ? day.name : null,
      name: b.name || 'Session',
      time: (b.description ?? '').replace(/<[^>]*>/g, ' ').split('\n')[0]?.trim().slice(0, 40) || null,
    })),
  ),
)

const staffGroups = computed(() => {
  const groups = new Map<string, StaffMember[]>()
  for (const m of staff.value) {
    if (!m.type) continue
    groups.set(m.type, [...(groups.get(m.type) ?? []), m])
  }
  return [...groups.entries()].map(([type, members]) => ({ type, members }))
})
function isFavoriteStaff(m: StaffMember) {
  const r = staffEntityRef(m)
  return r ? favorites.isFavorite(r.type, r.id) : false
}
const activeStaff = ref<StaffMember | null>(null)
const staffSheet = useMorph()
const { freshKey: liveFresh } = useLiveAlertState()
</script>

<template>
  <article v-if="competition" class="space-y-5">
    <header :ref="setHeader" class="space-y-2">
      <div class="flex items-start gap-3">
        <img v-if="competition.image" :src="competition.image" alt="" class="size-14 shrink-0 rounded-xl object-cover" />
        <DateTile v-else :date="competition.date" class="h-14" />
        <div class="min-w-0 flex-1">
          <p
            :class="[
              'flex items-center gap-1.5 text-sm font-bold',
              phase === 'today' ? 'text-live' : 'text-muted-foreground',
            ]"
          >
            <span v-if="phase === 'today'" class="bg-live size-2 animate-[live-pulse_2s_infinite] rounded-full" />
            {{ kicker }}
          </p>
          <h1 class="text-display">{{ competition.name ?? 'Competition' }}</h1>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <FavoriteButton
          :id="competitionId"
          type="competitions"
          :name="competition.name"
          labelled
        />
        <p v-if="updatedLabel" class="text-done-foreground text-sm font-bold">{{ updatedLabel }}</p>
      </div>
    </header>

    <!-- Your dancers here -->
    <section v-if="followedHere.length" class="space-y-3">
      <h2 class="text-heading">Your dancers here</h2>
      <DancerDayCard
        v-for="f in followedHere"
        :key="f.personId"
        :days="f.days"
        :fresh="liveFresh"
        :competition-id="competitionId"
        :color="f.color"
      />
    </section>
    <section
      v-else-if="ready && dancers.length"
      class="bg-card flex items-center gap-3 rounded-2xl border p-4 shadow-sm"
    >
      <span class="bg-blue-paper text-primary flex size-11 shrink-0 items-center justify-center rounded-full">
        <Star class="size-5" />
      </span>
      <p class="min-w-0 flex-1 text-[0.9375rem] leading-snug">
        <b>Is your dancer here?</b>
        {{ auth.isSignedIn ? 'Follow them to see their day on this page.' : 'Find them, then follow them to see their day here.' }}
      </p>
      <RouterLink
        :to="{ name: 'competition.dancers', params: { competitionId } }"
        class="bg-primary text-primary-foreground flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[0.9375rem] font-bold"
      >
        <Search class="size-4" /> Find
      </RouterLink>
    </section>

    <!-- When and where -->
    <section class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
      <div v-if="competition.date" class="flex items-center gap-3 p-4">
        <Clock class="text-primary size-5 shrink-0" />
        <div>
          <p class="text-base font-bold">{{ formatLongDate(competition.date) }}</p>
          <p v-if="sessions[0]?.time" class="text-muted-foreground text-sm">
            Starts {{ sessions[0].time }}
          </p>
        </div>
      </div>
      <div v-if="competition.venue || competition.address || competition.location" class="flex items-center gap-3 p-4">
        <MapPin class="text-primary size-5 shrink-0" />
        <div class="min-w-0 flex-1">
          <p v-if="competition.venue" class="text-base font-bold">{{ competition.venue }}</p>
          <p class="text-muted-foreground text-sm">
            {{ [competition.address, competition.location].filter(Boolean).join(', ') }}
          </p>
        </div>
        <a
          v-if="mapsHref"
          :href="mapsHref"
          target="_blank"
          rel="noopener"
          class="bg-card border-strong flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[0.9375rem] font-bold"
        >
          Directions
        </a>
      </div>
      <RouterLink
        v-if="dancers.length"
        :to="{ name: 'competition.dancers', params: { competitionId } }"
        class="flex items-center gap-3 p-4 hover:bg-accent"
      >
        <Users class="text-primary size-5 shrink-0" />
        <span class="flex-1 text-base font-bold">
          {{ dancers.length }} dancers<template v-if="dances.length">, {{ dances.length }} dances</template>
        </span>
        <ChevronRight class="text-muted-foreground size-5" />
      </RouterLink>
    </section>

    <!-- Sessions -->
    <section v-if="sessions.length" class="space-y-3">
      <h2 class="text-heading flex items-baseline justify-between">
        Sessions
        <RouterLink
          :to="{ name: 'competition.schedule', params: { competitionId } }"
          class="text-primary text-[0.9375rem] font-bold"
        >
          Full schedule
        </RouterLink>
      </h2>
      <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
        <li v-for="s in sessions" :key="s.id" class="flex items-center gap-3 px-4 py-3">
          <span class="bg-muted flex min-w-16 shrink-0 justify-center rounded-lg px-2 py-1 text-sm font-extrabold tabular-nums">
            {{ s.time ?? '—' }}
          </span>
          <span class="min-w-0">
            <span class="block text-base font-bold">{{ s.name }}</span>
            <span v-if="s.day" class="text-muted-foreground block text-sm">{{ s.day }}</span>
          </span>
        </li>
      </ul>
    </section>

    <!-- Registration + links -->
    <section v-if="competition.registrationURL || competition.links?.length" class="space-y-2">
      <a
        v-if="competition.registrationURL"
        :href="formatExternalURL(competition.registrationURL)"
        target="_blank"
        rel="noopener"
        :aria-disabled="!registrationOpen"
        class="bg-primary text-primary-foreground flex h-12 items-center justify-center gap-2 rounded-xl text-base font-bold aria-disabled:pointer-events-none aria-disabled:opacity-50"
      >
        Register <ExternalLink class="size-4" />
      </a>
      <p v-for="line in registrationLines" :key="line" class="text-muted-foreground text-sm">{{ line }}</p>
      <div v-if="competition.links?.length" class="flex flex-wrap gap-2 pt-1">
        <a
          v-for="link in competition.links"
          :key="link.url"
          :href="formatExternalURL(link.url)"
          target="_blank"
          rel="noopener"
          class="bg-card border-strong inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[0.9375rem] font-bold"
        >
          {{ link.name || formatHumanURL(link.url) }} <ExternalLink class="size-4" />
        </a>
      </div>
    </section>

    <section
      v-if="competition.description"
      class="text-base leading-relaxed [&_a]:text-primary [&_a]:underline [&_p+p]:mt-3"
      v-html="sanitizeRichText(competition.description)"
    />

    <!-- Judges, pipers, and other staff -->
    <section v-for="g in staffGroups" :key="g.type" class="space-y-3">
      <h2 class="text-heading">{{ g.type }}s <span class="text-muted-foreground text-sm font-semibold">{{ g.members.length }}</span></h2>
      <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
        <li v-for="m in g.members" :key="m.id">
          <button
            type="button"
            class="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent"
            @click="(activeStaff = m), staffSheet.show($event)"
          >
            <StaffAvatar :member="m" :size="36" />
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1.5 text-base font-bold">
                <span class="truncate">{{ staffMemberName(m) }}</span>
                <Star v-if="isFavoriteStaff(m)" class="text-primary size-4 shrink-0 fill-current" aria-label="Following" />
              </span>
              <span v-if="m.location" class="text-muted-foreground block truncate text-sm">{{ m.location }}</span>
            </span>
            <ChevronRight class="text-muted-foreground size-5 shrink-0" />
          </button>
        </li>
      </ul>
    </section>

    <StaffDialog :member="activeStaff" :morph="staffSheet" @close="staffSheet.hide().then(() => (activeStaff = null))" />

    <p v-if="competition.sobhd" class="text-muted-foreground flex justify-between pt-2 text-sm">
      <span>RSOBHD sanctioned</span>
      <span class="font-bold tabular-nums">{{ competition.sobhd }}</span>
    </p>
  </article>
</template>
