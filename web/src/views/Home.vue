<script setup lang="ts">
import LogoMark from '@/components/LogoMark.vue'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useIntervalFn, useLocalStorage } from '@vueuse/core'
import { ChevronRight, Search, Sparkles, X } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import Button from '@/components/ui/Button.vue'
import CompetitionDateRow from '@/components/CompetitionDateRow.vue'
import DancerDayCard from '@/components/DancerDayCard.vue'
import DancerCompactRow from '@/components/DancerCompactRow.vue'
import { useRoles } from '@/composables/useRoles'
import { useLiveAlertState } from '@/composables/useLiveAlerts'
import Skeleton from '@/components/Skeleton.vue'
import { useDancerCards, type DancerCard } from '@/composables/useDancerCards'
import { useFollowing } from '@/composables/useFollowing'
import { useOldFavourites } from '@/composables/useOldFavourites'
import { useRecentDancers } from '@/composables/useRecentDancers'
import { useScrolledPast } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import { useCompetitions } from '@/composables/useCompetitions'
import { useCompetitionSpans } from '@/composables/useCompetitionSpans'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'
import { useMeStore } from '@/stores/me'
import { compareDays, competitionPhase, dayStage, firstDance, nextDance } from '@/lib/dancerDay'
import { formatLongDate, formatRelative, formatShortDate, parseDate } from '@/lib/format'
import { now } from '@/lib/now'
import { getOrdinalSuffix } from '@/lib/results'
import { settle, settleDelay } from '@/lib/settle'
import { platformLabel } from '@/lib/schedule'
import type { Competition } from '@/types/competition'

usePageTitle(['Home'])

const auth = useAuthStore()
const me = useMeStore()
const favorites = useFavoritesStore()
const following = useFollowing()
const { recent, clear: clearRecent } = useRecentDancers()

const titleEl = ref<HTMLElement | null>(null)
const scrolledPast = useScrolledPast(titleEl)

const greeting = computed(() => {
  const h = now().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
})
const todayLabel = computed(() => formatLongDate(now().getTime()).replace(/,? \d{4}$/, ''))

// Followed people; if none, the dancers they've looked at lately, so Home
// is never empty for someone who hasn't signed in yet.
const followedPeople = computed(() =>
  Object.entries(favorites.dancers).map(([id, v]) => ({
    id,
    name: typeof v === 'string' ? v : 'Dancer',
  })),
)
const showingRecent = computed(() => followedPeople.value.length === 0)
const people = computed(() =>
  showingRecent.value
    ? recent.value.slice(0, 3).map((r) => ({ id: r.id, name: r.name }))
    : followedPeople.value,
)
const { cards, loading, resultsAt } = useDancerCards(people)

// Following a class, not two kids: one line each.
const roles = useRoles()
const compact = computed(
  () => !showingRecent.value && (roles.has('teacher') || followedPeople.value.length > 6),
)

// Home shows the few that matter now: everyone dancing today, most pressing
// first (dancing next, still to dance, waiting for results, done), then the
// soonest next, then the most recently danced. Everyone's on the Dancers page.
const HOME_LIMIT = 6
const dateMs = (c: Competition) => (c.date ? parseDate(c.date).getTime() : 0)
const isToday = (c: DancerCard) => c.focus?.phase === 'today'
function relevance(a: DancerCard, b: DancerCard) {
  const rank = (c: DancerCard) => (!c.focus ? 3 : c.focus.phase === 'today' ? 0 : c.focus.phase === 'before' ? 1 : 2)
  const r = rank(a) - rank(b)
  if (r || !a.focus || !b.focus) return r
  if (a.focus.phase === 'today') return compareDays(a.focus.days, b.focus.days)
  const d = dateMs(a.focus.competition) - dateMs(b.focus.competition)
  return a.focus.phase === 'after' ? -d : d
}
const ranked = computed(() => (showingRecent.value ? [] : [...cards.value].sort(relevance)))
const shownCards = computed(() => ranked.value.slice(0, HOME_LIMIT))
const moreFollowed = computed(() => !showingRecent.value && people.value.length > HOME_LIMIT)

// Today, one section per competition with its dancers underneath, the
// competition with the most pressing dancer first.
interface CompetitionGroup {
  competitionId: string
  competition: Competition
  cards: DancerCard[]
}
function byCompetition(list: DancerCard[]): CompetitionGroup[] {
  const map = new Map<string, CompetitionGroup>()
  for (const c of list) {
    const f = c.focus
    if (!f) continue
    const g = map.get(f.competitionId) ?? { competitionId: f.competitionId, competition: f.competition, cards: [] }
    g.cards.push(c)
    map.set(f.competitionId, g)
  }
  return [...map.values()]
}
const todays = computed(() => byCompetition(shownCards.value.filter(isToday)))
const others = computed(() => shownCards.value.filter((c) => !isToday(c)))
// A teacher's class, grouped by where they're dancing next (or last).
const otherGroups = computed(() => byCompetition(others.value))
const unplaced = computed(() => others.value.filter((c) => !c.focus))

// Finished dancers fold to a line of rosettes, so the ones still dancing
// lead (and a past competition is just its placings).
const folded = (c: DancerCard) => !!c.focus?.days.length && dayStage(c.focus.days) === 'done'

// The live dot pulses only while results are arriving (one in the last 20
// minutes), and only once on the page.
const tick = ref(Date.now())
useIntervalFn(() => (tick.value = Date.now()), 60_000)
const pulsing = computed(() => {
  const g = todays.value.find((t) => tick.value - (resultsAt.value[t.competitionId] ?? 0) < 20 * 60_000)
  return g?.competitionId ?? null
})
function todayKicker(g: CompetitionGroup) {
  const f = g.cards[0].focus
  return ['Today', f?.dayOf && `Day ${f.dayOf.n} of ${f.dayOf.of}`, g.competition.location].filter(Boolean).join(' · ')
}
function groupKicker(g: CompetitionGroup) {
  const f = g.cards[0].focus!
  const when = g.competition.date ? formatShortDate(g.competition.date) : null
  return [f.phase === 'before' ? 'Next' : 'Last', when, g.competition.location].filter(Boolean).join(' · ')
}

// One line under the greeting that answers "what now?", always in the same
// place: who dances next, the night before where they start, then when
// results are in.
const firstName = (c: DancerCard) => c.name.split(' ')[0]
function names(list: DancerCard[]) {
  const n = list.map(firstName)
  if (n.length > 3) return `${n.slice(0, 2).join(', ')} and ${n.length - 2} more`
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} and ${n.at(-1)}` : (n[0] ?? '')
}
const looksLikeTime = (s: string | null | undefined) => !!s && /\d(:\d\d)?\s*(am|pm)|\d:\d\d/i.test(s)
const context = computed(() => {
  if (showingRecent.value) return null
  const today = ranked.value.filter((c) => isToday(c) && c.focus!.days.length)
  if (today.length) {
    const lead = today[0]
    const stage = dayStage(lead.focus!.days)
    if (stage === 'next') {
      const plat = platformLabel(nextDance(lead.focus!.days)?.slot?.platformName)
      return `${firstName(lead)} dances next${plat ? ` on ${plat}` : ''}.`
    }
    if (stage === 'upcoming') return `${names(today.filter((c) => dayStage(c.focus!.days) === 'upcoming'))} dancing today.`
    const waiting = today.filter((c) => dayStage(c.focus!.days) === 'waiting')
    return waiting.length ? `Waiting on results for ${names(waiting)}.` : `Results are in for ${names(today)}.`
  }
  const tomorrow = ranked.value.filter((c) => c.focus?.phase === 'before' && c.focus.daysAway === 1)
  if (tomorrow.length) {
    const comp = tomorrow[0].focus!.competition
    const starts = tomorrow
      .filter((c) => c.focus!.competitionId === tomorrow[0].focus!.competitionId)
      .map((c) => ({ c, s: firstDance(c.focus!.days) }))
      .filter((x) => x.s)
      .sort((a, b) => a.s!.slot!.seq - b.s!.slot!.seq)
    const first = starts[0]
    const plat = first ? platformLabel(first.s!.slot!.platformName) : ''
    const on = plat ? ` on ${plat}` : ''
    let line = ''
    if (first && looksLikeTime(first.s!.slot!.blockTime)) line = ` ${firstName(first.c)} starts at ${first.s!.slot!.blockTime}${on}.`
    else if (first?.s!.drawPos) line = ` ${firstName(first.c)} is ${first.s!.drawPos}${getOrdinalSuffix(first.s!.drawPos)} to dance${on}.`
    return `Tomorrow: ${comp.name ?? 'a competition'}.${line}`
  }
  const next = ranked.value.find((c) => c.focus?.phase === 'before')
  if (next?.focus?.competition.date) return `Next up: ${next.focus.competition.name}, ${formatRelative(next.focus.competition.date)}.`
  return null
})

// Coming up: competitions your dancers are entered in, plus competitions you
// follow, soonest first.
const { competitions: recentCompetitions, loading: competitionsLoading } = useCompetitions(ref(false))
const comingUp = computed(() => {
  const map = new Map<string, { id: string; competition: Competition; dancers: Map<string, string>; followed: boolean }>()
  if (!showingRecent.value) {
    for (const c of cards.value) {
      const list = [...c.upcoming]
      if (c.focus && c.focus.phase === 'before') {
        list.unshift({ competitionId: c.focus.competitionId, competition: c.focus.competition })
      }
      for (const u of list) {
        const e = map.get(u.competitionId) ?? { id: u.competitionId, competition: u.competition, dancers: new Map(), followed: false }
        e.dancers.set(c.id, firstName(c))
        map.set(u.competitionId, e)
      }
    }
  }
  for (const comp of recentCompetitions.value) {
    if (!favorites.isFavorite('competitions', comp.id)) continue
    if (competitionPhase(comp.date) !== 'before') continue
    const e = map.get(comp.id) ?? { id: comp.id, competition: comp, dancers: new Map(), followed: true }
    e.followed = true
    map.set(comp.id, e)
  }
  return [...map.values()]
    .sort((a, b) => parseDate(a.competition.date ?? 0).getTime() - parseDate(b.competition.date ?? 0).getTime())
    .slice(0, 4)
})

// A competition that started in the last fortnight may still be on.
const { phase: phaseOf, span } = useCompetitionSpans(recentCompetitions)
const dayNote = (c: Competition & { id: string }) => {
  const s = span(c)
  return s && s.first <= 0 && s.last > s.first ? `Day ${1 - s.first} of ${s.last - s.first + 1}` : null
}

// If nothing personal is coming up, show what's next anywhere.
const nextAnywhere = computed(() => recentCompetitions.value.filter((c) => phaseOf(c) !== 'after').slice(0, 3))

// With nothing personal to show, the latest finished competitions keep Home
// alive between competition days.
const latestResults = computed(() =>
  recentCompetitions.value.filter((c) => phaseOf(c) === 'after').slice(-3).reverse(),
)

// For organisers: the competitions they run that are on or coming up.
const yours = computed(() =>
  recentCompetitions.value
    .filter((c) => me.managedCompetitionIds.includes(c.id) && phaseOf(c) !== 'after')
    .slice(0, 3),
)

const cardColor = (card: DancerCard) => (showingRecent.value ? null : following.colorFor(card.id))
// A dancer without a day card: where they're entered, if anywhere listed
// (that competition's details may not have loaded).
function cardLine(card: DancerCard) {
  const f = card.focus
  if (!f) return 'Not entered in any listed competitions'
  if (f.phase === 'today') return `Today: ${f.competition.name}`
  if (f.phase === 'after') return `Last: ${f.competition.name}`
  return `Next: ${f.competition.name}${f.competition.date ? ` · ${formatShortDate(f.competition.date)}` : ''}`
}

// The new look, for people who used the old app: only when their old
// favourites were carried over, never on competition day, and only for
// their first few visits.
const whatsNewDismissed = useLocalStorage('home:whatsNew:v4', false)
const oldFavourites = useOldFavourites()
const showWhatsNew = computed(
  () => !whatsNewDismissed.value && oldFavourites.copied && oldFavourites.launches <= 3 && !todays.value.length,
)

const { freshKey: liveFresh } = useLiveAlertState()
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar title="Home" :scrolled="scrolledPast" :back="false">
      <template #leading>
        <RouterLink to="/" class="flex min-w-0 items-center gap-2 rounded-xl" aria-label="ScotDance.app, Home">
          <span class="flex size-8 shrink-0 overflow-hidden rounded-lg bg-[#0065bd] text-white">
            <LogoMark class="size-8" />
          </span>
          <span class="truncate text-[1.0625rem] font-bold">ScotDance.app</span>
        </RouterLink>
      </template>
    </AppBar>

    <main
      class="mx-auto grid w-full max-w-3xl gap-x-8 gap-y-5 px-4 pt-[calc(var(--chrome-top)+0.25rem)] lg:max-w-6xl lg:grid-cols-3 lg:px-8"
    >
      <header ref="titleEl" class="lg:col-span-3">
        <p class="text-muted-foreground text-sm font-medium">{{ todayLabel }}</p>
        <h1 class="text-display">{{ greeting }}</h1>
        <p v-if="context" :class="['text-callout mt-1 font-medium', settle]">{{ context }}</p>
      </header>

      <div class="min-w-0 space-y-5 lg:col-span-2">
        <!-- Dismissed, it folds away rather than jumping the page up. -->
        <Transition
          leave-active-class="transition-[grid-template-rows,opacity] duration-(--dur-base) ease-standard motion-reduce:transition-opacity"
          leave-from-class="grid-rows-[1fr]"
          leave-to-class="grid-rows-[0fr] opacity-0"
        >
          <div v-if="showWhatsNew" class="grid mb-0!">
            <div class="min-h-0 overflow-hidden">
              <div class="bg-blue-paper relative mb-5 flex gap-3 rounded-2xl p-4 pr-12" role="note">
                <Sparkles class="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <p class="text-callout">
                  <span class="font-semibold">ScotDance has a new look.</span> The dancers you follow now appear here,
                  with their day at a glance. Competitions work the way they always have.
                </p>
                <button
                  type="button"
                  class="press absolute top-1.5 right-1.5 flex size-11 items-center justify-center rounded-full"
                  aria-label="Dismiss"
                  @click="whatsNewDismissed = true"
                >
                  <X class="size-5" />
                </button>
              </div>
            </div>
          </div>
        </Transition>

        <button
          v-if="auth.isSignedIn && roles.pending.value && !roles.answered.value"
          type="button"
          class="surface press-row focus-inset flex w-full items-center gap-3 rounded-2xl p-4 text-left"
          @click="roles.open()"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-base font-semibold">How do you use ScotDance?</span>
            <span class="text-muted-foreground block text-sm">Dancer, parent, teacher, organiser: it helps fit the app to you.</span>
          </span>
          <ChevronRight class="text-muted-foreground size-5 shrink-0" />
        </button>

        <!-- Today: each competition, with its dancers underneath -->
        <section
          v-for="(g, i) in todays"
          :key="g.competitionId"
          :aria-labelledby="`today-${g.competitionId}`"
          :class="['space-y-2.5', settle]"
          :style="settleDelay(i)"
        >
          <h2 :id="`today-${g.competitionId}`">
            <RouterLink
              :to="{ name: 'competition.info', params: { competitionId: g.competitionId } }"
              class="press-row -mx-2 flex items-center gap-2 rounded-xl px-2 py-1"
            >
              <span class="min-w-0 flex-1">
                <span class="text-live flex items-center gap-1.5 text-footnote font-semibold">
                  <span
                    :class="[
                      'bg-live size-2 shrink-0 rounded-full',
                      pulsing === g.competitionId && 'motion-safe:animate-[live-pulse_2s_infinite]',
                    ]"
                    aria-hidden="true"
                  />
                  <span class="truncate">{{ todayKicker(g) }}</span>
                </span>
                <span class="text-title block truncate">{{ g.competition.name }}</span>
              </span>
              <ChevronRight class="text-muted-foreground size-5 shrink-0" />
            </RouterLink>
          </h2>
          <ul v-if="compact" class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
            <DancerCompactRow v-for="card in g.cards" :key="card.id" :card="card" :color="cardColor(card)" />
          </ul>
          <template v-for="card in compact ? [] : g.cards" :key="card.id">
            <DancerDayCard
              v-if="card.focus?.days.length"
              :days="card.focus.days"
              :fresh="liveFresh"
              :competition-id="card.focus.competitionId"
              :color="cardColor(card)"
              :folded="folded(card)"
            />
            <Skeleton v-else-if="card.loading" class="h-40 w-full rounded-2xl!" />
          </template>
        </section>

        <!-- Nobody followed yet: the pitch, then something to look at -->
        <section
          v-if="!followedPeople.length"
          class="bg-primary-fill text-primary-foreground relative overflow-hidden rounded-3xl p-5 shadow-sm"
        >
          <LogoMark class="pointer-events-none absolute -right-6 -bottom-10 size-48 rotate-[-8deg] opacity-[0.13]" />
          <h2 class="text-title relative">See your dancer’s day at a glance</h2>
          <p class="text-callout relative mt-1.5 opacity-90">
            Follow your dancers to see their platform, dancing order and placings here, and get an alert when results
            are posted.
          </p>
          <div class="relative mt-4 flex flex-wrap gap-2">
            <RouterLink
              :to="{ name: 'search' }"
              class="bg-primary-foreground text-primary-fill press flex h-12 items-center gap-2 rounded-full px-5 text-base font-semibold"
            >
              <Search class="size-5" /> Find a dancer
            </RouterLink>
            <button
              v-if="!auth.isSignedIn"
              type="button"
              class="press flex h-12 items-center rounded-full px-5 text-base font-semibold shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.6)]"
              @click="auth.openLogin({ reason: 'account' })"
            >
              Sign in
            </button>
          </div>
        </section>

        <!-- Your dancers (the rest), or the ones looked at lately -->
        <section v-if="people.length && (others.length || showingRecent || !todays.length)" class="space-y-2.5">
          <h2 class="text-heading flex min-h-6 items-center justify-between">
            {{ showingRecent ? 'Recently viewed' : 'Your dancers' }}
            <RouterLink
              v-if="moreFollowed"
              :to="{ name: 'dancers' }"
              class="text-primary press -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-callout font-semibold"
            >
              See all {{ people.length }}
            </RouterLink>
            <span v-else-if="!showingRecent" class="text-muted-foreground text-sm font-normal">
              {{ people.length }} followed
            </span>
            <button
              v-else
              type="button"
              aria-label="Clear recently viewed"
              class="text-primary press -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-callout font-semibold"
              @click="clearRecent()"
            >
              Clear
            </button>
          </h2>

          <template v-if="loading && !cards.length">
            <Skeleton
              v-for="i in Math.min(people.length, 2)"
              :key="i"
              :class="[showingRecent || compact ? 'h-16' : 'h-52', 'w-full rounded-2xl!']"
            />
          </template>

          <ul v-if="showingRecent && cards.length" :class="['surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]', settle]">
            <DancerCompactRow v-for="card in cards" :key="card.id" :card="card" :color="null" follow show-competition />
          </ul>

          <template v-else-if="compact">
            <div v-for="(g, i) in otherGroups" :key="g.competitionId" :class="['space-y-1.5', settle]" :style="settleDelay(i)">
              <RouterLink
                :to="{ name: 'competition.info', params: { competitionId: g.competitionId } }"
                class="press-row -mx-2 flex items-center gap-2 rounded-xl px-2 py-1"
              >
                <span class="min-w-0 flex-1">
                  <span class="text-muted-foreground block truncate text-footnote">{{ groupKicker(g) }}</span>
                  <span class="block truncate text-base font-semibold">{{ g.competition.name }}</span>
                </span>
                <ChevronRight class="text-muted-foreground size-5 shrink-0" />
              </RouterLink>
              <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
                <DancerCompactRow v-for="card in g.cards" :key="card.id" :card="card" :color="cardColor(card)" />
              </ul>
            </div>
            <ul v-if="unplaced.length" class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
              <DancerCompactRow v-for="card in unplaced" :key="card.id" :card="card" :color="cardColor(card)" />
            </ul>
          </template>

          <template v-for="(card, i) in compact || showingRecent ? [] : others" :key="card.id">
            <DancerDayCard
              v-if="card.focus && card.focus.days.length"
              :class="settle"
              :style="settleDelay(i)"
              :days="card.focus.days"
              :fresh="liveFresh"
              :competition-id="card.focus.competitionId"
              :color="cardColor(card)"
              :competition-name="`${card.focus.phase === 'before' ? 'Next' : 'Last'}: ${card.focus.competition.name}`"
              :folded="card.focus.phase === 'after'"
            />
            <Skeleton v-else-if="card.loading" class="h-40 w-full rounded-2xl!" />
            <RouterLink
              v-else
              :to="{ name: 'dancer.info', params: { dancerId: card.id } }"
              class="surface press-row focus-inset relative flex items-center gap-3 overflow-hidden rounded-2xl p-4"
              :style="following.paint(card.id)"
            >
              <span v-if="cardColor(card)" class="sash absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[1.0625rem] font-semibold">{{ card.name }}</span>
                <span class="text-muted-foreground block truncate text-sm">{{ cardLine(card) }}</span>
              </span>
              <ChevronRight class="text-muted-foreground size-5" />
            </RouterLink>
          </template>
        </section>
        <div v-else-if="moreFollowed" class="flex justify-center">
          <Button variant="plain" :to="{ name: 'dancers' }">See all {{ people.length }} dancers</Button>
        </div>
      </div>

      <aside class="min-w-0 space-y-5">
        <!-- For organisers -->
        <section v-if="yours.length" class="space-y-2.5">
          <h2 class="text-heading flex min-h-6 items-center justify-between">
            Your competitions
            <RouterLink
              :to="{ name: 'manage.competitions' }"
              class="text-primary press -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-callout font-semibold"
            >
              Manage
            </RouterLink>
          </h2>
          <ul :class="['surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]', settle]">
            <CompetitionDateRow
              v-for="c in yours"
              :key="c.id"
              :competition="c"
              :to="{ name: 'manage', params: { competitionId: c.id } }"
              :today="phaseOf(c) === 'today'"
              :mark-managed="false"
              :note="c.published ? 'Published' : c.listed ? 'Listed' : 'Private'"
            />
          </ul>
        </section>

        <!-- Coming up -->
        <section v-if="comingUp.length || nextAnywhere.length || competitionsLoading" class="space-y-2.5">
          <h2 class="text-heading flex min-h-6 items-center justify-between">
            {{ comingUp.length ? 'Coming up' : 'Next competitions' }}
            <RouterLink
              :to="{ name: 'competitions' }"
              aria-label="See all competitions"
              class="text-primary press -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-callout font-semibold"
            >
              See all
            </RouterLink>
          </h2>
          <div v-if="competitionsLoading && !comingUp.length && !nextAnywhere.length" class="space-y-2" aria-busy="true">
            <Skeleton v-for="i in 3" :key="i" class="h-16 w-full rounded-2xl!" />
          </div>
          <ul v-else :class="['surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]', settle]">
            <template v-if="comingUp.length">
              <CompetitionDateRow
                v-for="c in comingUp"
                :key="c.id"
                :competition="c.competition"
                :competition-id="c.id"
                :to="{ name: 'competition.info', params: { competitionId: c.id } }"
                :dancers="[...c.dancers].map(([id, name]) => ({ id, name }))"
                :followed="c.followed"
              />
            </template>
            <template v-else>
              <CompetitionDateRow
                v-for="c in nextAnywhere"
                :key="c.id"
                :competition="c"
                :to="{ name: 'competition.info', params: { competitionId: c.id } }"
                :followed="favorites.isFavorite('competitions', c.id)"
                :today="phaseOf(c) === 'today'"
                :note="dayNote(c)"
              />
            </template>
          </ul>
        </section>

        <!-- Latest results, when nothing personal is on -->
        <section v-if="showingRecent && latestResults.length" class="space-y-2.5">
          <h2 class="text-heading">Latest results</h2>
          <ul :class="['surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]', settle]">
            <CompetitionDateRow
              v-for="c in latestResults"
              :key="c.id"
              :competition="c"
              :to="{ name: 'competition.results', params: { competitionId: c.id } }"
            />
          </ul>
        </section>

        <!-- For organisers who haven't added theirs yet. -->
        <p class="text-muted-foreground px-1 text-center text-sm lg:text-left">
          Running a competition?
          <RouterLink :to="{ name: 'competitions.submit' }" class="text-primary font-semibold underline-offset-2 hover:underline">
            Add it to ScotDance
          </RouterLink>
        </p>
      </aside>
    </main>
  </div>
</template>
