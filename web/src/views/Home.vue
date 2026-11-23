<script setup lang="ts">
import { connected } from '@/lib/offline'
import LogoMark from '@/components/LogoMark.vue'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useIntervalFn } from '@vueuse/core'
import { ChevronRight, Search, Sparkles, X } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import CompetitionDateRow from '@/components/CompetitionDateRow.vue'
import CompetitionHeading from '@/components/CompetitionHeading.vue'
import Wordmark from '@/components/Wordmark.vue'
import DancersPill from '@/components/DancersPill.vue'
import DancerCompactRow from '@/components/DancerCompactRow.vue'
import Skeleton from '@/components/Skeleton.vue'
import { useDancerCards, type DancerCard } from '@/composables/useDancerCards'
import { useFollowing } from '@/composables/useFollowing'
import { useOldFavourites } from '@/composables/useOldFavourites'
import { useWhatsNew } from '@/composables/useWhatsNew'
import { useRecentDancers } from '@/composables/useRecentDancers'
import { useScrolledPast } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import { useCompetitions } from '@/composables/useCompetitions'
import { useCompetitionSpans } from '@/composables/useCompetitionSpans'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'
import { useMeStore } from '@/stores/me'
import { compareDays, type Phase } from '@/lib/dancerDay'
import { parseDate } from '@/lib/format'
import { settle, settleDelay } from '@/lib/settle'
import type { Competition } from '@/types/competition'
import { useCompetitionLinks } from '@/composables/useCompetitionLinks'
import { orderLinked, railRows } from '@/lib/linked'

usePageTitle(['Home'])

const auth = useAuthStore()
const me = useMeStore()
const favorites = useFavoritesStore()
const following = useFollowing()
const { recent, clear: clearRecent } = useRecentDancers()

const titleEl = ref<HTMLElement | null>(null)
const scrolledPast = useScrolledPast(titleEl)


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

// Each competition your dancers are at, most pressing first: today's (whoever
// dances next leads), then the soonest next, then the most recently danced.
const dateMs = (c: Competition) => (c.date ? parseDate(c.date).getTime() : 0)
const firstName = (c: DancerCard) => c.name.split(' ')[0]
function relevance(a: DancerCard, b: DancerCard) {
  const rank = (c: DancerCard) => (!c.focus ? 3 : c.focus.phase === 'today' ? 0 : c.focus.phase === 'before' ? 1 : 2)
  const r = rank(a) - rank(b)
  if (r || !a.focus || !b.focus) return r
  if (a.focus.phase === 'today') return compareDays(a.focus.days, b.focus.days)
  const d = dateMs(a.focus.competition) - dateMs(b.focus.competition)
  return a.focus.phase === 'after' ? -d : d
}
const ranked = computed(() => (showingRecent.value ? [] : [...cards.value].sort(relevance)))

interface CompetitionGroup {
  competitionId: string
  competition: Competition
  cards: DancerCard[]
  today: boolean
  phase: Phase
}
// Every one of yours entered at each competition, as its own page counts
// them (not only those it's the most pressing one for).
const groups = computed<CompetitionGroup[]>(() => {
  const map = new Map<string, CompetitionGroup>()
  for (const c of ranked.value)
    for (const x of c.competitions) {
      const g = map.get(x.competitionId) ?? { competitionId: x.competitionId, competition: x.competition, cards: [], today: x.phase === 'today', phase: x.phase }
      g.cards.push(c)
      map.set(x.competitionId, g)
    }
  const order = { today: 0, before: 1, after: 2 }
  const all = [...map.values()].sort(
    (a, b) =>
      order[a.phase] - order[b.phase] ||
      (a.phase === 'after' ? dateMs(b.competition) - dateMs(a.competition) : dateMs(a.competition) - dateMs(b.competition)),
  )
  // Today's and what's coming, and only the two most recent past ones.
  let past = 0
  return all.filter((g) => g.phase !== 'after' || past++ < 2)
})
const todays = computed(() => groups.value.filter((g) => g.today))

// Finished dancers fold to a line of ribbons, so the ones still dancing
// lead (and a past competition is just its placings).

// The live dot pulses only while results are arriving (one in the last 20
// minutes), and only once on the page.
const tick = ref(Date.now())
useIntervalFn(() => (tick.value = Date.now()), 60_000)
const pulsing = computed(() => {
  const g = todays.value.find((t) => tick.value - (resultsAt.value[t.competitionId] ?? 0) < 20 * 60_000)
  return g?.competitionId ?? null
})
function todayKicker(g: CompetitionGroup) {
  const f = g.cards.find((c) => c.focus?.competitionId === g.competitionId)?.focus
  return ['Today', f?.dayOf && `Day ${f.dayOf.n} of ${f.dayOf.of}`, g.competition.location].filter(Boolean).join(' · ')
}
// "Next" for the soonest only, "Upcoming" for later ones, "Past" once over.
function groupKicker(g: CompetitionGroup) {
  const when = g.phase === 'before' ? (groups.value.find((x) => x.phase === 'before') === g ? 'Next' : 'Upcoming') : 'Past'
  return [when, g.competition.location].filter(Boolean).join(' · ')
}


// Coming up: competitions your favourite dancers are entered in, soonest
// first (ADR 0008: a competition is never pinned here by its alerts). One you
// manage is already under Competitions you manage (where it opens Manage), so it
// isn't listed twice.
const { competitions: recentCompetitions, loading: competitionsLoading } = useCompetitions(ref(false))
const { linkOf, othersLine } = useCompetitionLinks()
const comingUp = computed(() => {
  const map = new Map<string, { id: string; competition: Competition; dancers: Map<string, string> }>()
  if (!showingRecent.value) {
    for (const c of cards.value) {
      const list = [...c.upcoming]
      if (c.focus && c.focus.phase === 'before') {
        list.unshift({ competitionId: c.focus.competitionId, competition: c.focus.competition })
      }
      for (const u of list) {
        const e = map.get(u.competitionId) ?? { id: u.competitionId, competition: u.competition, dancers: new Map() }
        e.dancers.set(c.id, firstName(c))
        map.set(u.competitionId, e)
      }
    }
  }
  const managed = new Set(yours.value.map((c) => c.id))
  // Not one already above with your dancers: each competition in one place.
  const listed = new Set(groups.value.map((g) => g.competitionId))
  const entries = [...map.values()]
    .filter((e) => !managed.has(e.id) && !listed.has(e.id))
    .map((e) => ({ ...e, date: e.competition.date, name: e.competition.name }))
  // Linked ones together, on their rail; one without the rest names them.
  const at = (e: { date?: number | string }) => parseDate(e.date ?? 0).getTime()
  return railRows(orderLinked(entries, linkOf, { at }), 4).map(({ item, rail, alone }) => ({
    ...item,
    rail,
    note: alone ? othersLine({ id: item.id, date: item.date, name: item.name }) : null,
  }))
})

// A competition that started in the last fortnight may still be on.
const { phase: phaseOf, span } = useCompetitionSpans(recentCompetitions)
const dayNote = (c: Competition & { id: string }) => {
  const s = span(c)
  return s && s.first <= 0 && s.last > s.first ? `Day ${1 - s.first} of ${s.last - s.first + 1}` : null
}

// If nothing personal is coming up, show what's next anywhere (but not
// again what's under Competitions you manage, or today's, already shown with your dancers).
const nextAnywhere = computed(() => {
  // Not one already above (yours, or one your dancers are at).
  const shown = new Set([...yours.value.map((c) => c.id), ...groups.value.map((g) => g.competitionId)])
  const next = recentCompetitions.value.filter((c) => phaseOf(c) !== 'after' && !shown.has(c.id))
  const at = (c: { date?: number | string }) => parseDate(c.date ?? 0).getTime()
  return railRows(orderLinked(next, linkOf, { at }), 3).map(({ item, rail, alone }) => ({
    ...item,
    rail,
    note: dayNote(item) ?? (alone ? othersLine({ id: item.id, date: item.date, name: item.name }) : null),
  }))
})

// With nothing personal to show, the latest finished competitions keep Home
// alive between competition days (published ones: a listed one has no
// results to show).
const latestResults = computed(() =>
  recentCompetitions.value.filter((c) => phaseOf(c) === 'after' && c.published).slice(-3).reverse(),
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
// What's new, for people who used the old app: only when their old
// favourites were carried over, never on competition day, and only for
// their first few visits.
const whatsNew = useWhatsNew()
const oldFavourites = useOldFavourites()
const showWhatsNew = computed(
  () => whatsNew.unseen && oldFavourites.copied && oldFavourites.launches <= 3 && !todays.value.length,
)


</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <!-- The app's name in the bar, not a greeting taking a third of the screen:
         your competitions start right under it. -->
    <AppBar title="Home" :scrolled="scrolledPast" :back="false">
      <template #leading>
        <span class="text-heading flex items-center gap-2 pl-1 lg:hidden"><LogoMark class="text-primary size-7" /><Wordmark /></span>
      </template>
    </AppBar>

    <main
      class="mx-auto grid w-full max-w-3xl gap-y-10 px-4 pt-[calc(var(--chrome-top)+0.25rem)]"
    >
      <!-- The top edge of the page: the bar frosts once it's scrolled under. -->
      <h1 class="sr-only">Home</h1>
      <div ref="titleEl" aria-hidden="true" />

      <div class="min-w-0 space-y-10">
        <!-- Dismissed, it folds away rather than jumping the page up. -->
        <Transition
          leave-active-class="transition-[grid-template-rows,opacity] duration-(--dur-base) ease-standard motion-reduce:transition-opacity"
          leave-from-class="grid-rows-[1fr]"
          leave-to-class="grid-rows-[0fr] opacity-0"
        >
          <div v-if="showWhatsNew" class="grid mb-0!">
            <!-- Padded so the clip that folds it away doesn't cut its shadow. -->
            <div class="-mx-4 min-h-0 overflow-hidden px-4 pt-1">
              <div class="relative mb-5" role="group" aria-label="What’s new">
                <button
                  type="button"
                  class="press bg-primary-fill flex w-full items-center gap-3 rounded-[1.375rem] p-3 pr-12 text-left text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_0.5rem_1.5rem_-0.75rem_rgb(0_60_120/0.55)]"
                  @click="whatsNew.show(true)"
                >
                  <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15" aria-hidden="true">
                    <Sparkles class="size-6" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-base font-bold">Welcome to the new ScotDance.app</span>
                    <span class="flex items-center gap-0.5 text-sm opacity-85">See what’s new <ChevronRight class="size-4" /></span>
                  </span>
                </button>
                <button
                  type="button"
                  class="press absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-white/85"
                  aria-label="Dismiss"
                  @click="whatsNew.dismiss()"
                >
                  <X class="size-5" />
                </button>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Your competitions: each one your dancers are at, today's first, then
             the next, then the last. Your dancers there are one line apiece, so
             Home keeps its shape however many you follow; they're a tap away. -->
        <template v-if="!showingRecent">
          <Skeleton v-for="i in loading && !groups.length ? 2 : 0" :key="`sk${i}`" class="h-32 w-full rounded-2xl!" />
          <section
            v-for="(g, i) in groups"
            :key="g.competitionId"
            :aria-labelledby="`${g.today ? 'today' : 'comp'}-${g.competitionId}`"
            :class="['relative space-y-2.5', settle]"
            :style="settleDelay(i)"
          >
            <h2 :id="`${g.today ? 'today' : 'comp'}-${g.competitionId}`">
              <CompetitionHeading :competition-id="g.competitionId" :name="g.competition.name" :date="g.competition.date" :today="g.today">
                <template #kicker>
                  <template v-if="g.today">
                    <span :class="['text-callout flex items-center gap-1.5 font-semibold', connected ? 'text-live' : 'text-muted-foreground']">
                      <span
                        :class="[
                          'size-2 shrink-0 rounded-full',
                          connected ? 'bg-live' : 'bg-muted-foreground',
                          connected && pulsing === g.competitionId && 'motion-safe:animate-[live-pulse_2s_infinite]',
                        ]"
                        aria-hidden="true"
                      />
                      <span class="truncate">{{ todayKicker(g) }}</span>
                    </span>
                  </template>
                  <span v-else class="text-muted-foreground text-callout block truncate">{{ groupKicker(g) }}</span>
                </template>
              </CompetitionHeading>
            </h2>
            <!-- Your dancers there, as a pill in line with the name. -->
            <div class="pl-14">
              <DancersPill
                :to="{ name: 'competition.yours', params: { competitionId: g.competitionId } }"
                :colors="g.cards.map(cardColor)"
                :names="g.cards.map((c) => c.name)"
              />
            </div>
          </section>
        </template>

        <!-- No favourites yet: the pitch, then something to look at -->
        <section
          v-if="!followedPeople.length"
          class="brand-panel rounded-3xl p-5"
        >
          <LogoMark class="size-14" />
          <h2 class="text-title mt-3">See your dancer’s day at a glance</h2>
          <p class="text-callout mt-1.5">
            Favourite your dancers to see their platform, dancing order and placings here, and get an alert when results
            are posted.
          </p>
          <div class="mt-4 flex flex-wrap gap-2">
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

        <!-- No favourites yet: the dancers looked at lately -->
        <section v-if="showingRecent && people.length" class="space-y-2.5">
          <h2 class="text-section flex min-h-6 items-baseline justify-between">
            Recently viewed
            <button
              type="button"
              aria-label="Clear recently viewed"
              class="text-primary press -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-callout font-semibold"
              @click="clearRecent()"
            >
              Clear
            </button>
          </h2>
          <Skeleton v-for="i in loading && !cards.length ? Math.min(people.length, 2) : 0" :key="i" class="h-16 w-full rounded-2xl!" />
          <ul v-if="cards.length" :class="['rows-engraved -mx-4 [--inset:4.5rem] [--inset-end:1rem]', settle]">
            <DancerCompactRow v-for="card in cards" :key="card.id" :card="card" :color="null" follow show-competition />
          </ul>
        </section>
      </div>

      <aside class="min-w-0 space-y-10">
        <!-- For organisers -->
        <section v-if="yours.length" class="space-y-2.5">
          <h2 class="text-section flex min-h-6 items-baseline justify-between">
            Competitions you manage
            <RouterLink
              :to="{ name: 'manage.competitions' }"
              class="text-primary press -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-callout font-semibold"
            >
              Manage
            </RouterLink>
          </h2>
          <ul :class="['rows-engraved -mx-4 [--inset:4.5rem] [--inset-end:1rem]', settle]">
            <CompetitionDateRow
              v-for="c in yours"
              :key="c.id"
              :competition="c"
              :to="{ name: 'manage', params: { competitionId: c.id } }"
              :today="phaseOf(c) === 'today'"
              :mark-managed="false"
            />
          </ul>
        </section>

        <!-- Coming up -->
        <section v-if="comingUp.length || nextAnywhere.length || competitionsLoading" class="space-y-2.5">
          <h2 class="text-section flex min-h-6 items-baseline justify-between">
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
          <ul v-else :class="['rows-engraved -mx-4 [--inset:4.5rem] [--inset-end:1rem]', settle]">
            <template v-if="comingUp.length">
              <CompetitionDateRow
                v-for="c in comingUp"
                :key="c.id"
                :competition="c.competition"
                :competition-id="c.id"
                :to="{ name: 'competition.info', params: { competitionId: c.id } }"
                :dancers="[...c.dancers].map(([id, name]) => ({ id, name }))"
                :alerts="favorites.isFavorite('competitions', c.id)"
                :rail="c.rail"
                :note="c.note"
              />
            </template>
            <template v-else>
              <CompetitionDateRow
                v-for="c in nextAnywhere"
                :key="c.id"
                :competition="c"
                :to="{ name: 'competition.info', params: { competitionId: c.id } }"
                :alerts="favorites.isFavorite('competitions', c.id)"
                :today="phaseOf(c) === 'today'"
                :rail="c.rail"
                :note="c.note"
              />
            </template>
          </ul>
        </section>

        <!-- Latest results, when nothing personal is on -->
        <section v-if="showingRecent && latestResults.length" class="space-y-2.5">
          <h2 class="text-section">Latest results</h2>
          <ul :class="['rows-engraved -mx-4 [--inset:4.5rem] [--inset-end:1rem]', settle]">
            <CompetitionDateRow
              v-for="c in latestResults"
              :key="c.id"
              :competition="c"
              :to="{ name: 'competition.results', params: { competitionId: c.id } }"
            />
          </ul>
        </section>

        <!-- For organisers who haven't added theirs yet. -->
        <p class="text-muted-foreground px-1 text-center text-sm">
          Running a competition?
          <RouterLink :to="{ name: 'competitions.add' }" class="text-primary font-semibold underline-offset-2 hover:underline">
            Add it to ScotDance.app
          </RouterLink>
        </p>
      </aside>
    </main>
  </div>
</template>
