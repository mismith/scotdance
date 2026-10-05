<script setup lang="ts">
import { useMorph } from '@/lib/morph'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Check, ChevronRight, Clock, Copy, ExternalLink, Hourglass, Map as MapIcon, MapPin, Navigation, Search, Star, Trophy, Users, X } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useCompetitionDays } from '@/composables/useCompetitionDays'
import { useCompetitionLive } from '@/composables/useCompetitionLive'
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
import CompetitionName from '@/components/CompetitionName.vue'
import OrganisationMark from '@/components/OrganisationMark.vue'
import { useOrganisations } from '@/composables/useOrganisations'
import Button from '@/components/ui/Button.vue'
import { staffEntityRef, staffMemberName, type StaffMember } from '@/types/competition'
import type { DancerDay } from '@/lib/dancerDay'
import { resultsCount } from '@/lib/resultsCount'
import { useFavoritesStore } from '@/stores/favorites'
import { useMeStore } from '@/stores/me'
import AdminMark from '@/components/AdminMark.vue'
import { blocks, days, events } from '@/lib/schedule'
import ResultsMark from '@/components/ResultsMark.vue'
import { rowsMove } from '@/lib/settle'
import { competitionSpan } from '@/lib/dancerDay'
import { formatExternalURL, formatLongDate, formatRelative } from '@/lib/format'
import { sanitizeRichText } from '@/lib/sanitize'
import {
  competitionLinks,
  directions as competitionDirections,
  linkLabel,
  registrationLines as competitionRegistrationLines,
  registrationOpen as isRegistrationOpen,
  staffHeading,
} from '@/lib/competitionInfo'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'

const setHeader = injectInfoHeaderSetter()

const {
  competitionId,
  competition,
  restricted,
  staff,
  loadStaff,
  dancers,
  loadDancers,
  groups,
  dances,
  results,
  loadResults,
  resultsHidden,
  schedule,
  loadSchedule,
} = useCompetition()
const { phase, followedHere } = useCompetitionDays()
// A studio follows dozens: the first few, so the rest of the Overview is in
// reach, and the others on asking.
const FOLLOWED_SHOWN = 3
const allFollowed = ref(false)
const shownFollowed = computed(() => (allFollowed.value ? followedHere.value : followedHere.value.slice(0, FOLLOWED_SHOWN)))
const favorites = useFavoritesStore()
const me = useMeStore()
const isFresh = useFreshPlacings()
const progress = useCompetitionProgress()
const { pulse, lastResult } = useCompetitionLive()

const ready = ref(false)
onMounted(async () => {
  loadStaff()
  await Promise.all([loadDancers(), loadResults(), loadSchedule()])
  ready.value = true
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
function openDirections(e: MouseEvent) {
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
// description ("8:00 am"), and how many of their results are in.
const TIME = /^\d{1,2}([:.]\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?(\s|$|[-–])/i
const whenOrNote = (line: string) =>
  TIME.test(line) ? { time: line.slice(0, 12), note: null } : { time: null, note: line ? line.slice(0, 80) : null }
const sessions = computed(() =>
  days(schedule.value).flatMap((day, di, all) =>
    blocks(day).map((b) => {
      const count = { posted: 0, total: 0 }
      for (const e of events(b)) {
        const c = progress.value.counts.get(e.id)
        count.posted += c?.posted ?? 0
        count.total += c?.total ?? 0
      }
      return {
        id: `${day.id}:${b.id}`,
        day: all.length > 1 ? day.name : null,
        name: b.name || 'Session',
        // Its description's first line: the chip when it's a time ("8:30 am"),
        // a note under the name when it's anything else.
        ...whenOrNote((b.description ?? '').replace(/<[^>]*>/g, ' ').split('\n')[0]?.trim() ?? ''),
        count,
        done: count.total > 0 && count.posted >= count.total,
      }
    }),
  ),
)

// The Overview keeps its order but changes density with the day: before,
// everything for getting there (the map, Register); on the day, one venue
// row and what's on; after, the results so far instead of the map.
const mode = computed(() => phase.value)
const posted = computed(() => resultsCount(groups.value, dances.value, results.value))

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

// The organisations it's run by or part of, each with a page of its own.
const organisationsList = useOrganisations()
const organisations = computed(() =>
  Object.entries(competition.value?.organisations ?? {})
    .filter(([, on]) => on === true)
    .flatMap(([id]) => {
      const org = organisationsList.byId.value.get(id)
      return org ? [org] : []
    }),
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
// A long panel (a dozen judges) shows a few, followed ones first, and the
// rest on request, so it doesn't bury what comes after it.
const STAFF_FOLD = 5
const staffOpen = ref(new Set<string>())
function staffShown(g: { type: string; members: StaffMember[] }) {
  if (staffOpen.value.has(g.type) || g.members.length <= STAFF_FOLD) return g.members
  return [...g.members].sort((a, b) => Number(isFavoriteStaff(b)) - Number(isFavoriteStaff(a))).slice(0, STAFF_FOLD - 1)
}
const activeStaff = ref<StaffMember | null>(null)
const staffSheet = useMorph()

const MENU_ROW = 'press-row focus-inset flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-base font-medium'
</script>

<template>
  <article v-if="competition" class="space-y-6">
    <header :ref="setHeader" class="space-y-3">
      <div class="flex items-start gap-3">
        <span v-if="competition.image" class="relative shrink-0">
          <img :src="competition.image" alt="" class="size-14 rounded-xl object-cover" />
          <AdminMark v-if="me.organises(competitionId)" size="md" ring="background" />
        </span>
        <DateTile
          v-else
          :date="competition.date"
          :managed="me.organises(competitionId)"
        />
        <!-- The name leads; when and where follows it. -->
        <div class="min-w-0 flex-1">
          <h1 class="text-display">
            <CompetitionName :competition="competition" link />
          </h1>
          <p :class="['text-callout mt-0.5 flex items-center gap-1.5 font-semibold', live ? 'text-live' : 'text-muted-foreground']">
            <LiveDot v-if="live" :pulse="pulse" />
            {{ kicker }}
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FavoriteButton :id="competitionId" type="competitions" :name="competition.name" labelled variant="tonal" />
        <p v-if="lastResult" class="text-muted-foreground text-sm first-letter:uppercase">{{ lastResult }}</p>
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
        <h2 class="text-heading">
          Your dancers here
          <span v-if="followedHere.length > 1" class="text-muted-foreground text-sm font-medium tabular-nums">{{ followedHere.length }}</span>
        </h2>
        <template v-for="f in shownFollowed" :key="f.personId">
          <DancerDayCard
            :days="f.days"
            :fresh="freshIn(f.days)"
            :competition-id="competitionId"
            :color="f.color"
          />
        </template>
        <Button v-if="followedHere.length > FOLLOWED_SHOWN" block @click="allFollowed = !allFollowed">
          {{ allFollowed ? 'Show fewer' : `Show all ${followedHere.length} dancers` }}
        </Button>
      </section>

      <!-- Not following anyone here: find them -->
      <section v-else-if="ready && dancers.length" key="find" class="surface space-y-3 rounded-2xl p-4">
        <p class="text-callout">
          <span class="font-semibold">Is your dancer here?</span>
          {{ mode === 'after' ? 'Find them to see their results.' : 'Follow them to see their day at a glance.' }}
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
          class="rows-inset -mx-4 -mb-2 [interpolate-size:allow-keywords] [--inset:4.75rem]"
          v-bind="rowsMove"
        >
          <li v-for="d in shownMatches" :key="d.id" class="flex items-center gap-1 pr-2">
            <RouterLink
              :to="{ name: 'competition.dancer', params: { competitionId, dancerId: d.id } }"
              class="press-row focus-inset flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl py-2 pl-4"
            >
              <NumberCard :number="d.number" size="xs" />
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
      <div v-if="competition.date && mode !== 'today'" class="flex items-center gap-3 p-4">
        <Clock class="text-primary size-5 shrink-0" />
        <div>
          <p class="text-base font-semibold">{{ formatLongDate(competition.date) }}</p>
          <p v-if="sessions[0]?.time && mode === 'before'" class="text-muted-foreground text-sm">Starts {{ sessions[0].time }}</p>
        </div>
      </div>
      <!-- After: what's in. -->
      <RouterLink
        v-if="mode === 'after' && posted.total && !resultsHidden"
        :to="{ name: 'competition.results', params: { competitionId } }"
        class="press-row focus-inset flex items-center gap-3 p-4"
      >
        <Trophy class="text-primary size-5 shrink-0" />
        <span class="min-w-0 flex-1">
          <span class="block text-base font-semibold">Results</span>
          <span class="text-muted-foreground block text-sm tabular-nums">{{ posted.posted }} of {{ posted.total }} posted</span>
        </span>
        <ChevronRight class="text-muted-foreground size-5" />
      </RouterLink>
      <div v-if="competition.venue || competition.address || competition.location" class="space-y-3 p-4">
        <div class="flex items-center gap-3">
          <MapPin class="text-primary size-5 shrink-0" />
          <div class="min-w-0 flex-1">
            <!-- Venue and address in full: they're what you'd read out to a taxi. -->
            <p v-if="competition.venue" class="text-base font-semibold break-words">{{ competition.venue }}</p>
            <p class="text-muted-foreground text-sm break-words">
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
        <!-- The map before the day; on and after it, it's in the Directions menu. -->
        <MapPreview
          v-if="hasMap && mode === 'before'"
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
      <h2 class="text-heading flex min-h-6 items-center justify-between">
        Sessions
        <RouterLink
          :to="{ name: 'competition.schedule', params: { competitionId } }"
          class="press text-primary -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-callout font-semibold"
        >
          Full schedule
        </RouterLink>
      </h2>
      <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:6rem]">
        <li
          v-for="s in sessions"
          :key="s.id"
          class="flex items-center gap-3 px-4 py-3"
        >
          <span class="bg-muted text-callout flex min-w-16 shrink-0 justify-center rounded-lg px-2 py-1 font-semibold tabular-nums">
            {{ s.time ?? '—' }}
          </span>
          <span class="min-w-0 flex-1">
            <!-- Over: quieter by colour (opacity would take it under AA). -->
            <span :class="['block text-base', s.done ? 'text-muted-foreground font-medium' : 'font-semibold']">{{ s.name }}</span>
            <span v-if="s.day || s.note" class="text-muted-foreground block text-sm">{{ [s.day, s.note].filter(Boolean).join(' · ') }}</span>
          </span>
          <ResultsMark :posted="s.count.posted" :total="s.count.total" />
        </li>
      </ul>
    </section>

    <!-- Registration + links -->
    <section v-if="(competition.registrationURL && mode === 'before') || links.length" class="space-y-2">
      <Button
        v-if="competition.registrationURL && mode === 'before'"
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
      <template v-if="mode === 'before'">
        <p v-for="line in registrationLines" :key="line" class="text-muted-foreground text-center text-sm">{{ line }}</p>
      </template>
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
        <li v-for="m in staffShown(g)" :key="m.id">
          <button
            type="button"
            class="press-row focus-inset flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left"
            @click="(activeStaff = m), staffSheet.show($event)"
          >
            <StaffAvatar :member="m" :size="36" />
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1.5 text-base font-semibold">
                <span class="truncate">{{ staffMemberName(m) }}</span>
                <Star v-if="isFavoriteStaff(m)" class="text-secondary size-4 shrink-0 fill-current" aria-label="Following" />
              </span>
              <span v-if="m.location" class="text-muted-foreground block truncate text-sm">{{ m.location }}</span>
            </span>
          </button>
        </li>
        <li v-if="g.members.length > STAFF_FOLD && !staffOpen.has(g.type)">
          <button
            type="button"
            class="press-row focus-inset text-primary text-callout h-12 w-full font-semibold"
            @click="staffOpen = new Set([...staffOpen, g.type])"
          >
            Show all {{ g.members.length }}
          </button>
        </li>
      </ul>
    </section>

    <!-- Who runs it: last, after the people -->
    <section v-if="organisations.length" class="space-y-3">
      <h2 class="text-heading">
        {{ organisations.length === 1 ? 'Organisation' : 'Organisations' }}
        <span v-if="organisations.length > 1" class="text-muted-foreground text-sm font-medium tabular-nums">{{ organisations.length }}</span>
      </h2>
      <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.25rem]">
        <li v-for="org in organisations" :key="org.id">
          <RouterLink :to="{ name: 'organisation.info', params: { organisationId: org.id } }" class="press-row focus-inset flex min-h-14 items-center gap-3 px-4 py-2">
            <OrganisationMark :organisation="org" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base font-semibold">{{ org.name }}</span>
              <span v-if="org.shortName || org.location" class="text-muted-foreground block truncate text-sm">{{ [org.shortName, org.location].filter(Boolean).join(' · ') }}</span>
            </span>
            <ChevronRight class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
          </RouterLink>
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
      @close="directionsMenu.hide()"
    >
      <nav v-if="where" aria-label="Directions">
        <a v-if="where.apple" :href="where.apple" target="_blank" rel="noopener" :class="MENU_ROW" @click="directionsMenu.dismiss()">
          <Navigation class="text-muted-foreground size-5 shrink-0" /> Apple Maps
        </a>
        <a :href="where.google" target="_blank" rel="noopener" :class="MENU_ROW" @click="directionsMenu.dismiss()">
          <MapIcon class="text-muted-foreground size-5 shrink-0" /> Google Maps
        </a>
        <button
          v-if="hasMap && mode !== 'before'"
          type="button"
          :class="MENU_ROW"
          @click="directionsMenu.dismiss(), mapSheet.show(directionsMenu.trigger)"
        >
          <MapPin class="text-muted-foreground size-5 shrink-0" /> Show the map
        </button>
        <button type="button" :class="MENU_ROW" @click="copyAddress(true)">
          <component :is="copied ? Check : Copy" :class="['size-5 shrink-0', copied ? 'text-done-foreground' : 'text-muted-foreground']" />
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
