<script setup lang="ts">
import { useMorph } from '@/lib/morph'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useIntervalFn } from '@vueuse/core'
import { Check, ChevronRight, Clock, Copy, ExternalLink, Hourglass, Map as MapIcon, MapPin, Navigation, Search, Star, Users, X } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useCompetitionDays } from '@/composables/useCompetitionDays'
import { useCompetitionProgress } from '@/composables/useCompetitionProgress'
import { useCompetitionSearch } from '@/composables/useCompetitionSearch'
import { useFreshPlacings } from '@/composables/useCompetitionPlacings'
import DateTile from '@/components/DateTile.vue'
import Dialog from '@/components/Dialog.vue'
import MapPreview from '@/components/MapPreview.vue'
import DancerDayCard from '@/components/DancerDayCard.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import FollowButton from '@/components/FollowButton.vue'
import LiveDot from '@/components/LiveDot.vue'
import NumberCard from '@/components/NumberCard.vue'
import StaffAvatar from '@/components/StaffAvatar.vue'
import StaffDialog from '@/components/StaffDialog.vue'
import Button from '@/components/ui/Button.vue'
import { staffEntityRef, staffMemberName, type StaffMember } from '@/types/competition'
import type { DancerDay } from '@/lib/dancerDay'
import { useFavoritesStore } from '@/stores/favorites'
import { useMeStore } from '@/stores/me'
import AdminMark from '@/components/AdminMark.vue'
import { blocks, dances as eventDances, days, events } from '@/lib/schedule'
import { competitionSpan } from '@/lib/dancerDay'
import { formatExternalURL, formatLongDate, formatRelative } from '@/lib/format'
import { sanitizeRichText } from '@/lib/sanitize'
import { anchorTo } from '@/lib/anchor'
import {
  competitionLinks,
  directions as competitionDirections,
  linkLabel,
  registrationLines as competitionRegistrationLines,
  registrationOpen as isRegistrationOpen,
  staffHeading,
} from '@/lib/competitionInfo'
import { useDancerNumberVt } from '@/composables/useCompetitionDancerVt'
import { injectInfoHeaderScrolledPast, injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { nowMs } from '@/lib/now'

const setHeader = injectInfoHeaderSetter()
// Owns the shared title name until it scrolls under the bar (AppBar `titleVt`).
const scrolledPast = injectInfoHeaderScrolledPast()

const {
  competitionId,
  competition,
  restricted,
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
const favorites = useFavoritesStore()
const me = useMeStore()
const isFresh = useFreshPlacings()
const progress = useCompetitionProgress()
const numberVt = useDancerNumberVt()

const ready = ref(false)
onMounted(async () => {
  loadStaff()
  await Promise.all([loadDancers(), loadResults(), loadSchedule()])
  ready.value = true
})

// Minutes since the last result came in, refreshed each minute.
const tick = ref(nowMs())
useIntervalFn(() => (tick.value = nowMs()), 60_000)
const sinceResult = computed(() => {
  void tick.value
  if (!isLive.value || !liveResultsAt.value) return null
  return Math.max(0, Math.round((nowMs() - liveResultsAt.value) / 60_000))
})

// The kicker says when and where: "In 6 days · Calgary, AB", or on the day
// "Live · Day 1 of 2 · Calgary, AB" with the one live dot (pulsing only
// while results are coming in).
const live = computed(() => phase.value === 'today')
const kicker = computed(() => {
  const c = competition.value
  if (!c) return ''
  let when = ''
  if (live.value) {
    const span = competitionSpan(c.date, schedule.value)
    const total = span ? span.last - span.first + 1 : 1
    when = total > 1 && span ? `Live · Day ${1 - span.first} of ${total}` : 'Live'
  } else if (c.date != null) {
    const rel = formatRelative(c.date)
    when = rel.charAt(0).toUpperCase() + rel.slice(1)
  }
  return [when, c.location].filter(Boolean).join(' · ')
})

// Directions in the map app you use, and the map itself, full size.
const where = computed(() => competitionDirections(competition.value))
const hasMap = computed(() => Number.isFinite(competition.value?.lat) && Number.isFinite(competition.value?.lng))
const directionsMenu = useMorph()
const directionsPlace = ref<Record<string, string>>({})
function openDirections(e: MouseEvent) {
  directionsPlace.value = anchorTo(e.currentTarget as Element, 180)
  copied.value = false
  directionsMenu.show(e)
}
const mapSheet = useMorph()
const copied = ref(false)
async function copyAddress(closeMenu: boolean) {
  if (!where.value) return
  try {
    await navigator.clipboard.writeText(where.value.address)
  } catch {
    return
  }
  copied.value = true
  setTimeout(() => {
    if (closeMenu) directionsMenu.hide()
    else copied.value = false
  }, 900)
}

// Links and registration, as the Manage › Details preview shows them.
const registrationLines = computed(() => competitionRegistrationLines(competition.value))
const links = computed(() => competitionLinks(competition.value))
const registrationOpen = computed(() => isRegistrationOpen(competition.value))

// Sessions: the schedule's blocks, with the time organisers put in their
// description ("8:00 am"), and on the day which one's on now.
const sessions = computed(() =>
  days(schedule.value).flatMap((day, di, all) =>
    blocks(day).map((b) => {
      const states = events(b)
        .filter((e) => eventDances(e).some((sd) => sd.danceId))
        .map((e) => progress.value.events.get(e.id))
      return {
        id: `${day.id}:${b.id}`,
        day: all.length > 1 ? day.name : null,
        name: b.name || 'Session',
        time: (b.description ?? '').replace(/<[^>]*>/g, ' ').split('\n')[0]?.trim().slice(0, 40) || null,
        state: states.includes('now') ? 'now' : states.length && states.every((x) => x === 'done') ? 'done' : null,
      }
    }),
  ),
)

// Following no one here: find your dancer right on the Overview.
const find = ref('')
const matches = useCompetitionSearch(dancers, find)
const shownMatches = computed(() => (find.value.trim() ? matches.value.slice(0, 5) : []))

// A placing that just came in flips on its card.
function freshIn(days: DancerDay[]): string | null {
  for (const d of days)
    for (const s of [...d.dances, ...(d.overall ? [d.overall] : [])])
      if (s.state === 'placed' && isFresh(d.group?.id, s.dance.id, d.dancer.id)) return `${d.dancer.id}:${s.dance.id}`
  return null
}

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

const MENU_ROW = 'press-row focus-inset flex min-h-12 w-full items-center gap-3 px-4 text-left text-base font-medium'
</script>

<template>
  <article v-if="competition" class="space-y-6">
    <header :ref="setHeader" class="space-y-3">
      <div class="flex items-start gap-3">
        <span v-if="competition.image" class="relative shrink-0">
          <img :src="competition.image" alt="" class="size-14 rounded-xl object-cover" />
          <AdminMark v-if="me.hasCompetitionPerm(competitionId)" size="md" ring="background" />
        </span>
        <DateTile v-else :date="competition.date" :managed="me.hasCompetitionPerm(competitionId)" class="h-14" />
        <div class="min-w-0 flex-1">
          <p :class="['flex items-center gap-1.5 text-sm font-semibold', live ? 'text-live' : 'text-muted-foreground']">
            <LiveDot v-if="live" :pulse="sinceResult != null && sinceResult < 20" />
            {{ kicker }}
          </p>
          <h1 class="text-display" :style="scrolledPast ? undefined : { viewTransitionName: 'competition-title' }">
            {{ competition.name ?? 'Competition' }}
          </h1>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FavoriteButton :id="competitionId" type="competitions" :name="competition.name" labelled variant="tonal" />
        <p v-if="sinceResult != null" class="text-muted-foreground text-sm">
          Last result {{ sinceResult < 1 ? 'just now' : `${sinceResult} min ago` }}
        </p>
      </div>
    </header>

    <Transition
      mode="out-in"
      enter-active-class="transition-[opacity,translate] duration-(--dur-base) ease-standard"
      enter-from-class="opacity-0 translate-y-1.5 motion-reduce:translate-y-0"
      leave-active-class="transition-opacity duration-(--dur-instant) ease-exit"
      leave-to-class="opacity-0"
    >
      <!-- Your dancers here -->
      <section v-if="followedHere.length" key="yours" class="space-y-3">
        <h2 class="text-heading">Your dancers here</h2>
        <DancerDayCard
          v-for="f in followedHere"
          :key="f.personId"
          :days="f.days"
          :fresh="freshIn(f.days)"
          :competition-id="competitionId"
          :color="f.color"
        />
      </section>

      <!-- Not following anyone here: find them -->
      <section v-else-if="ready && dancers.length" key="find" class="surface space-y-3 rounded-2xl p-4">
        <p class="text-callout">
          <span class="font-semibold">Is your dancer here?</span>
          Follow them to see their day at a glance.
        </p>
        <label class="field flex h-12 items-center gap-2 rounded-xl pr-1 pl-3">
          <Search class="text-muted-foreground size-5 shrink-0" />
          <input
            v-model="find"
            type="search"
            placeholder="Name or number"
            aria-label="Find your dancer by name or number"
            autocomplete="off"
            enterkeyhint="search"
            class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none"
          />
          <button
            v-if="find"
            type="button"
            class="press text-muted-foreground flex size-10 items-center justify-center rounded-full"
            aria-label="Clear"
            @click="find = ''"
          >
            <X class="size-5" />
          </button>
        </label>
        <TransitionGroup
          v-if="shownMatches.length"
          tag="ul"
          class="rows-inset -mx-4 -mb-2 [--inset:4.75rem]"
          enter-active-class="transition-opacity duration-(--dur-quick) ease-standard"
          enter-from-class="opacity-0"
        >
          <li v-for="d in shownMatches" :key="d.id" class="flex items-center gap-1 pr-2">
            <RouterLink
              :to="{ name: 'competition.dancer', params: { competitionId, dancerId: d.id } }"
              class="press-row focus-inset flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl py-2 pl-4"
              @click="numberVt.tap(d.id, 'find')"
            >
              <NumberCard :number="d.number" size="xs" :style="{ viewTransitionName: numberVt.row(d.id, 'find') }" />
              <span class="min-w-0">
                <span class="block truncate text-base font-semibold">{{ d.fullName }}</span>
                <span class="text-muted-foreground block truncate text-sm">{{ d.group?.fullName }}</span>
              </span>
            </RouterLink>
            <FollowButton :dancer="d" />
          </li>
        </TransitionGroup>
        <p v-else-if="find.trim()" class="text-muted-foreground text-callout">
          No dancer matches “{{ find.trim() }}”. Check the number on their card, or try part of their name.
        </p>
        <RouterLink
          v-if="matches.length > shownMatches.length && find.trim()"
          :to="{ name: 'competition.dancers', params: { competitionId }, query: { q: find.trim() } }"
          class="press text-primary text-callout inline-flex h-11 items-center font-semibold"
        >
          See all {{ matches.length }} matches
        </RouterLink>
      </section>

      <p
        v-else-if="restricted"
        key="restricted"
        class="surface text-muted-foreground text-callout flex items-center gap-3 rounded-2xl p-4"
      >
        <Hourglass class="text-primary size-5 shrink-0" />
        Dancers, the schedule and results show here once they’re published.
      </p>
    </Transition>

    <!-- When and where -->
    <section class="surface rows-inset overflow-hidden rounded-2xl [--inset:3rem]">
      <div v-if="competition.date" class="flex items-center gap-3 p-4">
        <Clock class="text-primary size-5 shrink-0" />
        <div>
          <p class="text-base font-semibold">{{ formatLongDate(competition.date) }}</p>
          <p v-if="sessions[0]?.time" class="text-muted-foreground text-sm">Starts {{ sessions[0].time }}</p>
        </div>
      </div>
      <div v-if="competition.venue || competition.address || competition.location" class="space-y-3 p-4">
        <div class="flex items-center gap-3">
          <MapPin class="text-primary size-5 shrink-0" />
          <div class="min-w-0 flex-1">
            <p v-if="competition.venue" class="text-base font-semibold">{{ competition.venue }}</p>
            <p class="text-muted-foreground text-sm">
              {{ [competition.address, competition.location].filter(Boolean).join(', ') }}
            </p>
          </div>
          <Button
            v-if="where"
            variant="tonal"
            size="sm"
            aria-haspopup="dialog"
            :aria-expanded="directionsMenu.open"
            @click="openDirections"
          >
            <Navigation /> Directions
          </Button>
        </div>
        <MapPreview
          v-if="hasMap"
          :lat="competition.lat!"
          :lng="competition.lng!"
          expandable
          class="h-40 rounded-xl"
          @click="mapSheet.show($event)"
        />
      </div>
      <RouterLink
        v-if="dancers.length"
        :to="{ name: 'competition.dancers', params: { competitionId } }"
        class="press-row focus-inset flex items-center gap-3 p-4"
      >
        <Users class="text-primary size-5 shrink-0" />
        <span class="flex-1 text-base font-semibold">
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
          class="press text-primary text-callout font-semibold"
        >
          Full schedule
        </RouterLink>
      </h2>
      <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:6rem]">
        <li
          v-for="s in sessions"
          :key="s.id"
          :class="['flex items-center gap-3 px-4 py-3 transition-opacity duration-(--dur-slow)', s.state === 'done' && 'opacity-60']"
        >
          <span class="bg-muted text-callout flex min-w-16 shrink-0 justify-center rounded-lg px-2 py-1 font-semibold tabular-nums">
            {{ s.time ?? '—' }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-base font-semibold">{{ s.name }}</span>
            <span v-if="s.day" class="text-muted-foreground block text-sm">{{ s.day }}</span>
          </span>
          <span v-if="s.state === 'now'" class="bg-live-paper text-live text-footnote rounded-full px-2 py-0.5 font-semibold">Now</span>
        </li>
      </ul>
    </section>

    <!-- Registration + links -->
    <section v-if="competition.registrationURL || links.length" class="space-y-2">
      <Button
        v-if="competition.registrationURL"
        variant="primary"
        size="lg"
        block
        :href="formatExternalURL(competition.registrationURL)"
        target="_blank"
        rel="noopener"
        :disabled="!registrationOpen"
      >
        Register <ExternalLink />
      </Button>
      <p v-for="line in registrationLines" :key="line" class="text-muted-foreground text-center text-sm">{{ line }}</p>
      <div v-if="links.length" class="flex flex-wrap gap-2 pt-1">
        <Button
          v-for="link in links"
          :key="link.id"
          :href="formatExternalURL(link.url)"
          target="_blank"
          rel="noopener"
          class="max-w-full"
        >
          <span class="truncate">{{ linkLabel(link) }}</span> <ExternalLink />
        </Button>
      </div>
    </section>

    <section
      v-if="competition.description"
      class="text-base leading-relaxed [&_a]:text-primary [&_a]:underline [&_p+p]:mt-3"
      v-html="sanitizeRichText(competition.description)"
    />

    <!-- Judges, pipers, and other staff -->
    <section v-for="g in staffGroups" :key="g.type" class="space-y-3">
      <h2 class="text-heading">
        {{ staffHeading(g.type, g.members.length) }}
        <span v-if="g.members.length > 1" class="text-muted-foreground text-sm font-medium tabular-nums">{{ g.members.length }}</span>
      </h2>
      <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4rem]">
        <li v-for="m in g.members" :key="m.id">
          <button
            type="button"
            class="press-row focus-inset flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left"
            @click="(activeStaff = m), staffSheet.show($event)"
          >
            <StaffAvatar :member="m" :size="36" />
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1.5 text-base font-semibold">
                <span class="truncate">{{ staffMemberName(m) }}</span>
                <Star v-if="isFavoriteStaff(m)" class="text-primary size-4 shrink-0 fill-current" aria-label="Following" />
              </span>
              <span v-if="m.location" class="text-muted-foreground block truncate text-sm">{{ m.location }}</span>
            </span>
          </button>
        </li>
      </ul>
    </section>

    <StaffDialog :member="activeStaff" :morph="staffSheet" @close="staffSheet.hide().then(() => (activeStaff = null))" />

    <!-- Directions: a small menu under the button -->
    <Dialog
      :open="directionsMenu.open"
      :morph="directionsMenu"
      variant="dropdown"
      aria-label="Directions"
      :style="directionsPlace"
      @close="directionsMenu.hide()"
    >
      <nav v-if="where" aria-label="Directions" class="py-1.5">
        <a v-if="where.apple" :href="where.apple" target="_blank" rel="noopener" :class="MENU_ROW" @click="directionsMenu.dismiss()">
          <Navigation class="text-primary size-5 shrink-0" /> Apple Maps
        </a>
        <a :href="where.google" target="_blank" rel="noopener" :class="MENU_ROW" @click="directionsMenu.dismiss()">
          <MapIcon class="text-primary size-5 shrink-0" /> Google Maps
        </a>
        <button type="button" :class="MENU_ROW" @click="copyAddress(true)">
          <component :is="copied ? Check : Copy" class="text-primary size-5 shrink-0" />
          {{ copied ? 'Address copied' : 'Copy address' }}
        </button>
      </nav>
    </Dialog>

    <!-- The map, full size -->
    <Dialog
      v-if="hasMap"
      :open="mapSheet.open"
      :morph="mapSheet"
      variant="sheet"
      size="md"
      @close="mapSheet.hide().then(() => (copied = false))"
    >
      <template #header>
        <h2 class="text-title">{{ competition.venue || competition.location || 'Venue' }}</h2>
        <p class="text-muted-foreground text-sm">{{ [competition.address, competition.location].filter(Boolean).join(', ') }}</p>
      </template>
      <MapPreview
        v-if="mapSheet.open"
        :lat="competition.lat!"
        :lng="competition.lng!"
        interactive
        class="h-[min(55svh,28rem)]"
      />
      <div v-if="where" class="flex flex-wrap gap-2 p-4 pb-[calc(1rem+var(--safe-bottom))]">
        <Button v-if="where.apple" variant="tonal" :href="where.apple" target="_blank" rel="noopener">
          <Navigation /> Apple Maps
        </Button>
        <Button variant="tonal" :href="where.google" target="_blank" rel="noopener"><MapIcon /> Google Maps</Button>
        <Button variant="tonal" @click="copyAddress(false)">
          <component :is="copied ? Check : Copy" /> {{ copied ? 'Address copied' : 'Copy address' }}
        </Button>
      </div>
    </Dialog>

    <p v-if="competition.sobhd" class="text-muted-foreground flex justify-between pt-2 text-sm">
      <span>RSOBHD sanctioned</span>
      <span class="font-medium tabular-nums">{{ competition.sobhd }}</span>
    </p>
  </article>
</template>
