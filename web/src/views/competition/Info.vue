<script setup lang="ts">
import { useMorph } from '@/lib/morph'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { CalendarDays, Check, ChevronDown, ChevronRight, Copy, ExternalLink, Hourglass, Map as MapIcon, MapPin, Navigation, Search, Star, X } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useCompetitionDays } from '@/composables/useCompetitionDays'
import { useCompetitionLive } from '@/composables/useCompetitionLive'
import { useCompetitionProgress } from '@/composables/useCompetitionProgress'
import { useCompetitionSearch } from '@/composables/useCompetitionSearch'
import { useFreshPlacings } from '@/composables/useCompetitionPlacings'
import DateTile from '@/components/DateTile.vue'
import CompetitionDateRow from '@/components/CompetitionDateRow.vue'
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
import { heroTitle } from '@/lib/heroTitle'
import { registrationLabel, registrations } from '@/lib/registration'
import {
  competitionLinks,
  directions as competitionDirections,
  linkLabel,
  registrationLines as competitionRegistrationLines,
  registrationOpen as isRegistrationOpen,
  staffHeading,
} from '@/lib/competitionInfo'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { useLinkedSwitcher } from '@/composables/useLinkedSwitcher'
import { useFollowedCompetitions } from '@/composables/useFollowedCompetitions'
import { memberNote } from '@/lib/linked'
import { daysFromToday } from '@/lib/format'

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
  hasSchedule,
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
// The date row, only when it adds to the tile and "Yesterday" above: the
// year once it's more than a week away, the start time, or no tile at all.
const showDateRow = computed(() => {
  const c = competition.value
  if (!c?.date || mode.value === 'today') return false
  const days = daysFromToday(c.date)
  return !!c.image || days == null || Math.abs(days) >= 7 || (!!sessions.value[0]?.time && mode.value === 'before')
})

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

// Linked with others (ADR 0007 §6): a pill beside Alerts opens the
// switcher, and a section shows the ones either side of this one.
const switcher = useLinkedSwitcher()
const { byCompetition: followedByCompetition } = useFollowedCompetitions()
const NEARBY = 2
const nearby = computed(() => {
  const members = switcher?.members.value ?? []
  const at = members.findIndex((c) => c.id === competitionId.value)
  return members
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.id !== competitionId.value)
    .sort((a, b) => Math.abs(a.i - at) - Math.abs(b.i - at) || a.i - b.i)
    .slice(0, NEARBY)
    .sort((a, b) => a.i - b.i)
    .map(({ c }) => {
      const note = memberNote(c, { days: daysFromToday(c.date), venue: competition.value?.venue })
      return { c, note }
    })
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
// The third action beside Alerts and Directions: Register while entries are
// open, or else the one link when there's just one. More links keep their row.
const actionLink = computed(() => {
  const c = competition.value
  if (c?.registrationURL && mode.value === 'before' && registrationOpen.value) {
    return { label: 'Register', href: formatExternalURL(c.registrationURL), primary: true }
  }
  const [only] = links.value
  return links.value.length === 1 ? { label: linkLabel(only), href: formatExternalURL(only.url), primary: false } : null
})
const moreLinks = computed(() => (actionLink.value && !actionLink.value.primary ? [] : links.value))

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
// What's here, in figures: each opens where it's listed.
const figures = computed(() => {
  const tab = (name: string) => ({ name, params: { competitionId: competitionId.value } })
  return [
    dancers.value.length ? { value: String(dancers.value.length), label: dancers.value.length === 1 ? 'Dancer' : 'Dancers', to: tab('competition.dancers') } : null,
    dances.value.length ? { value: String(dances.value.length), label: dances.value.length === 1 ? 'Dance' : 'Dances', to: tab(hasSchedule.value ? 'competition.schedule' : 'competition.results') } : null,
    mode.value !== 'before' && posted.value.total && !resultsHidden.value
      ? { value: `${posted.value.posted}/${posted.value.total}`, label: 'Results in', to: tab('competition.results') }
      : null,
  ].filter((f) => f != null)
})

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
          <img :src="competition.image" alt="" class="size-[3.75rem] rounded-[0.875rem] object-cover shadow-[0_0_0_0.5px_rgb(0_0_0/0.12),0_2px_6px_rgb(16_24_40/0.12)]" />
          <AdminMark v-if="me.organises(competitionId)" size="md" ring="background" />
        </span>
        <DateTile
          v-else
          :date="competition.date"
          :managed="me.organises(competitionId)"
        />
        <!-- The name leads; when and where follows it. -->
        <div class="min-w-0 flex-1 pt-0.5">
          <h1 :class="heroTitle(competition.name)">
            <CompetitionName :competition="competition" link />
          </h1>
          <p :class="['text-callout mt-1.5 flex items-center gap-1.5 font-semibold', live ? 'text-live' : 'text-muted-foreground']">
            <LiveDot v-if="live" :pulse="pulse" />
            {{ kicker }}
          </p>
        </div>
      </div>
      <!-- What you can do here, in one row of equal buttons. -->
      <div class="grid auto-cols-fr grid-flow-col gap-2 pt-2">
        <FavoriteButton :id="competitionId" type="competitions" :name="competition.name" labelled variant="tile" />
        <button
          v-if="where"
          type="button"
          class="press action-tile bg-blue-paper text-primary"
          aria-haspopup="dialog"
          :aria-expanded="directionsMenu.open"
          @click="openDirections"
        >
          <Navigation aria-hidden="true" /> Directions
        </button>
        <a
          v-if="actionLink"
          :href="actionLink.href"
          target="_blank"
          rel="noopener"
          :class="['press action-tile', actionLink.primary ? 'bg-primary-fill text-primary-foreground press-fill' : 'bg-blue-paper text-primary']"
        >
          <ExternalLink aria-hidden="true" /> <span class="max-w-full truncate">{{ actionLink.label }}</span>
        </a>
      </div>
      <template v-if="competition.registrationURL && mode === 'before'">
        <p v-for="line in registrationLines" :key="line" class="text-muted-foreground text-center text-sm">{{ line }}</p>
      </template>
      <div v-if="switcher?.linked.value || lastResult" class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          v-if="switcher?.linked.value"
          type="button"
          class="press surface text-callout flex h-11 shrink-0 items-center gap-1.5 rounded-full pr-3 pl-4 font-semibold"
          aria-haspopup="dialog"
          :aria-label="`${switcher.label.value}: switch competition`"
          @click="switcher.morph.show($event)"
        >
          {{ switcher.members.value.length }} competitions
          <ChevronDown class="text-muted-foreground size-4" stroke-width="2.4" aria-hidden="true" />
        </button>
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
        <h2 class="text-section">
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
      <section v-else-if="ready && dancers.length" key="find" class="space-y-2.5">
        <h2 class="text-section">Is your dancer here?</h2>
        <label class="search-fill">
          <Search class="text-muted-foreground size-[1.125rem] shrink-0" stroke-width="2.4" />
          <input
            v-model="find"
            type="search"
            placeholder="Name or number"
            aria-label="Find your dancer by name or number"
            autocomplete="off"
            enterkeyhint="search"
            class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-[1.0625rem] outline-none"
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
          class="surface rows-inset overflow-hidden rounded-2xl [interpolate-size:allow-keywords] [--inset:4.75rem]"
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

    <!-- What's here, in figures -->
    <div v-if="figures.length > 1" class="surface grid auto-cols-fr grid-flow-col overflow-hidden rounded-2xl">
      <RouterLink
        v-for="(f, i) in figures"
        :key="f.label"
        :to="f.to"
        :class="['press-row focus-inset flex flex-col items-center py-3', i > 0 && 'shadow-[inset_0.5px_0_0_var(--border)]']"
      >
        <span class="text-[1.625rem] leading-none font-[800] tracking-[-0.02em] tabular-nums">{{ f.value }}</span>
        <span class="text-muted-foreground mt-1 text-[0.8125rem] font-semibold">{{ f.label }}</span>
      </RouterLink>
    </div>

    <!-- The competitions it's linked with: the ones either side, and all of them -->
    <section v-if="switcher?.linked.value" class="space-y-3">
      <h2 class="text-section">{{ switcher.label.value }}</h2>
      <ul class="rows-engraved -mx-4 [--inset:4.5rem] [--inset-end:1rem]">
        <CompetitionDateRow
          v-for="r in nearby"
          :key="r.c.id"
          :competition="r.c"
          :to="{ name: 'competition.info', params: { competitionId: r.c.id } }"
          replace
          :note="r.note?.text"
          :note-tone="r.note?.tone"
          :dancers="followedByCompetition[r.c.id] ?? []"
        />
        <li v-if="switcher.members.value.length - 1 > nearby.length">
          <button
            type="button"
            class="press-row focus-inset text-primary text-callout flex min-h-12 w-full items-center justify-center font-semibold"
            @click="switcher.morph.show($event)"
          >
            All {{ switcher.members.value.length }}
          </button>
        </li>
      </ul>
    </section>

    <!-- When and where -->
    <section
      v-if="showDateRow || competition.venue || competition.address || competition.location"
      class="surface rows-inset overflow-hidden rounded-2xl [--inset:3rem]"
    >
      <div v-if="showDateRow" class="flex items-center gap-3 p-4">
        <CalendarDays class="text-primary size-5 shrink-0" />
        <div>
          <p class="text-[1.0625rem] font-semibold">{{ formatLongDate(competition.date) }}</p>
          <p v-if="sessions[0]?.time && mode === 'before'" class="text-muted-foreground text-sm">Starts {{ sessions[0].time }}</p>
        </div>
      </div>
      <div v-if="competition.venue || competition.address || competition.location" class="space-y-3 p-4">
        <div class="flex items-center gap-3">
          <MapPin class="text-primary size-5 shrink-0" />
          <div class="min-w-0 flex-1">
            <!-- Venue and address in full: they're what you'd read out to a taxi. -->
            <p v-if="competition.venue" class="text-[1.0625rem] font-semibold break-words">{{ competition.venue }}</p>
            <p v-if="competition.space" class="text-sm font-medium break-words">{{ competition.space }}</p>
            <p class="text-muted-foreground text-sm break-words">
              {{ [competition.address, competition.location].filter(Boolean).join(', ') }}
            </p>
          </div>
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
    </section>

    <!-- Sessions -->
    <section v-if="sessions.length" class="space-y-3">
      <h2 class="text-section flex min-h-6 items-center justify-between">
        Sessions
        <RouterLink
          :to="{ name: 'competition.schedule', params: { competitionId } }"
          class="press text-primary -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-callout font-semibold"
        >
          Full schedule
        </RouterLink>
      </h2>
      <ul class="rows-engraved -mx-4 [--inset:6.375rem] [--inset-end:1rem]">
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

    <!-- Links beyond the one beside Alerts -->
    <div v-if="moreLinks.length" class="flex flex-wrap gap-2">
      <Button
        v-for="link in moreLinks"
        :key="link.id"
        :href="formatExternalURL(link.url)"
        target="_blank"
        rel="noopener"
        class="max-w-full"
      >
        <span class="truncate">{{ linkLabel(link) }}</span> <ExternalLink />
      </Button>
    </div>

    <section
      v-if="competition.description"
      class="text-base leading-relaxed [&_a]:text-primary [&_a]:underline [&_p+p]:mt-3"
      v-html="sanitizeRichText(competition.description)"
    />

    <!-- Judges, pipers, and other staff -->
    <section v-for="g in staffGroups" :key="g.type" class="space-y-3">
      <h2 class="text-section">
        {{ staffHeading(g.type, g.members.length) }}
        <span v-if="g.members.length > 1" class="text-muted-foreground text-sm font-medium tabular-nums">{{ g.members.length }}</span>
      </h2>
      <ul class="rows-engraved -mx-4 [--inset:4.25rem] [--inset-end:1rem]">
        <li v-for="m in staffShown(g)" :key="m.id">
          <button
            type="button"
            class="press-row focus-inset flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left"
            @click="(activeStaff = m), staffSheet.show($event)"
          >
            <StaffAvatar :member="m" :size="40" />
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1.5 text-base font-semibold">
                <span class="truncate">{{ staffMemberName(m) }}</span>
                <Star v-if="isFavoriteStaff(m)" class="text-secondary size-4 shrink-0 fill-current" aria-label="Favourite" />
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
      <h2 class="text-section">
        {{ organisations.length === 1 ? 'Organisation' : 'Organisations' }}
        <span v-if="organisations.length > 1" class="text-muted-foreground text-sm font-medium tabular-nums">{{ organisations.length }}</span>
      </h2>
      <ul class="rows-engraved -mx-4 [--inset:4.25rem] [--inset-end:1rem]">
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

    <!-- Its registration numbers, each beside who it's registered with. -->
    <div v-if="registrations(competition.sobhd).length" class="text-muted-foreground space-y-1 pt-2 text-center text-footnote">
      <p v-for="r in registrations(competition.sobhd)" :key="r.number">
        {{ registrationLabel(r) }} · <span class="font-medium tabular-nums">{{ r.number }}</span>
      </p>
    </div>
  </article>
</template>
