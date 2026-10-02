<script setup lang="ts">
import LogoMark from '@/components/LogoMark.vue'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { CalendarDays, ChevronRight, Search, Sparkles, SquarePlus, X } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import CompetitionDateRow from '@/components/CompetitionDateRow.vue'
import DancerDayCard from '@/components/DancerDayCard.vue'
import DancerCompactRow from '@/components/DancerCompactRow.vue'
import { useRoles } from '@/composables/useRoles'
import { useLiveAlertState } from '@/composables/useLiveAlerts'
import Skeleton from '@/components/Skeleton.vue'
import { useDancerCards, type DancerCard } from '@/composables/useDancerCards'
import { useFollowing } from '@/composables/useFollowing'
import { useRecentDancers } from '@/composables/useRecentDancers'
import { useScrolledPast } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import { useCompetitions } from '@/composables/useCompetitions'
import { useCompetitionSpans } from '@/composables/useCompetitionSpans'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'
import { competitionPhase } from '@/lib/dancerDay'
import { formatLongDate, formatShortDate, parseDate } from '@/lib/format'
import { now } from '@/lib/now'
import type { Competition } from '@/types/competition'

usePageTitle(['Home'])

const auth = useAuthStore()
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
const { cards, loading } = useDancerCards(people)

// Home shows the few that matter now: dancing today, then soonest next,
// then most recently danced. Everyone's on the Dancers page.
const HOME_LIMIT = 6
const dateMs = (c: Competition) => (c.date ? parseDate(c.date).getTime() : 0)
function relevance(a: DancerCard, b: DancerCard) {
  const rank = (c: DancerCard) => (!c.focus ? 3 : c.focus.phase === 'today' ? 0 : c.focus.phase === 'before' ? 1 : 2)
  const r = rank(a) - rank(b)
  if (r || !a.focus || !b.focus) return r
  const d = dateMs(a.focus.competition) - dateMs(b.focus.competition)
  return a.focus.phase === 'after' ? -d : d
}
const shownCards = computed(() => (showingRecent.value ? cards.value : [...cards.value].sort(relevance).slice(0, HOME_LIMIT)))
const moreFollowed = computed(() => !showingRecent.value && people.value.length > HOME_LIMIT)

// Competitions on today where someone you follow is dancing.
interface TodayComp {
  competitionId: string
  competition: Competition
  names: string[]
}
const todays = computed<TodayComp[]>(() => {
  if (showingRecent.value) return []
  const map = new Map<string, TodayComp>()
  for (const c of cards.value) {
    const f = c.focus
    if (!f || f.phase !== 'today') continue
    const t = map.get(f.competitionId) ?? { competitionId: f.competitionId, competition: f.competition, names: [] }
    t.names.push(c.name.split(' ')[0])
    map.set(f.competitionId, t)
  }
  return [...map.values()]
})

const whoIsDancing = (names: string[]) =>
  names.length > 1
    ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)} are dancing`
    : `${names[0]} is dancing`

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
        e.dancers.set(c.id, c.name.split(' ')[0])
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
const { phase: phaseOf } = useCompetitionSpans(recentCompetitions)

// If nothing personal is coming up, show what's next anywhere.
const nextAnywhere = computed(() => recentCompetitions.value.filter((c) => phaseOf(c) !== 'after').slice(0, 3))

// With nothing personal to show, the latest finished competitions keep Home
// alive between competition days.
const latestResults = computed(() =>
  recentCompetitions.value.filter((c) => phaseOf(c) === 'after').slice(-3).reverse(),
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

const whatsNewDismissed = useLocalStorage('home:whatsNew:v4', false)

// Following a class, not two kids: one line each.
const roles = useRoles()
const compact = computed(
  () => !showingRecent.value && (roles.has('teacher') || followedPeople.value.length > 6),
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
          <span class="truncate text-[1.0625rem] font-extrabold">ScotDance.app</span>
        </RouterLink>
      </template>
    </AppBar>

    <main class="mx-auto w-full max-w-3xl space-y-4 px-4 pt-[calc(var(--chrome-top)+0.25rem)]">
      <header ref="titleEl">
        <p class="text-muted-foreground text-sm font-bold">{{ todayLabel }}</p>
        <h1 class="text-display">{{ greeting }}</h1>
      </header>

      <div
        v-if="!whatsNewDismissed"
        class="bg-blue-paper relative flex gap-3 rounded-2xl p-4 pr-12"
        role="note"
      >
        <Sparkles class="text-primary mt-0.5 size-5 shrink-0" />
        <p class="text-[0.9375rem] leading-snug">
          <b>ScotDance has a new look.</b> The dancers you follow now appear here, with their day at a glance.
          Competitions work the way they always have.
        </p>
        <button
          type="button"
          class="hover:bg-card absolute top-2 right-2 flex size-11 items-center justify-center rounded-full"
          aria-label="Dismiss"
          @click="whatsNewDismissed = true"
        >
          <X class="size-5" />
        </button>
      </div>

      <button
        v-if="auth.isSignedIn && roles.pending.value && !roles.answered.value"
        type="button"
        class="bg-card flex w-full items-center gap-3 rounded-2xl border p-4 text-left shadow-sm"
        @click="roles.open()"
      >
        <span class="min-w-0 flex-1">
          <b class="block text-base">How do you use ScotDance?</b>
          <span class="text-muted-foreground block text-sm">Dancer, parent, teacher, organiser: it helps fit the app to you.</span>
        </span>
        <ChevronRight class="text-muted-foreground size-5 shrink-0" />
      </button>

      <!-- Today -->
      <RouterLink
        v-for="t in todays"
        :key="t.competitionId"
        :to="{ name: 'competition.info', params: { competitionId: t.competitionId } }"
        class="bg-primary text-primary-foreground relative block overflow-hidden rounded-2xl p-4 shadow-sm"
      >
        <LogoMark class="pointer-events-none absolute -right-4 -bottom-8 size-36 rotate-[-8deg] opacity-[0.13]" />
        <span class="flex items-center gap-2 text-sm font-bold">
          <span class="size-2 animate-[live-pulse_2s_infinite] rounded-full bg-current" />
          Today<template v-if="t.competition.location"> · {{ t.competition.location }}</template>
        </span>
        <span class="text-title mt-1 block">{{ t.competition.name }}</span>
        <span class="mt-0.5 block text-[0.9375rem] font-semibold">{{ whoIsDancing(t.names) }}</span>
        <span
          class="bg-primary-foreground text-primary mt-3 inline-flex h-10 items-center gap-1 rounded-full px-4 text-[0.9375rem] font-extrabold"
        >
          View competition <ChevronRight class="size-4" stroke-width="3" />
        </span>
      </RouterLink>

      <!-- Nobody followed yet: the pitch, then something to look at -->
      <section
        v-if="!followedPeople.length"
        class="bg-primary text-primary-foreground relative overflow-hidden rounded-3xl p-5 shadow-sm"
      >
        <LogoMark class="pointer-events-none absolute -right-6 -bottom-10 size-48 rotate-[-8deg] opacity-[0.13]" />
        <h2 class="text-title relative">See your dancer’s day at a glance</h2>
        <p class="relative mt-1.5 text-[0.9375rem] font-semibold opacity-90">
          Follow your dancers to see their platform, dancing order and placings here, and get an alert when results
          are posted.
        </p>
        <div class="relative mt-4 flex flex-wrap gap-2">
          <RouterLink
            :to="{ name: 'search' }"
            class="bg-primary-foreground text-primary flex h-12 items-center gap-2 rounded-full px-5 text-base font-extrabold"
          >
            <Search class="size-5" /> Find a dancer
          </RouterLink>
          <button
            v-if="!auth.isSignedIn"
            type="button"
            class="border-primary-foreground/60 flex h-12 items-center rounded-full border-2 px-5 text-base font-bold"
            @click="auth.openLogin({ reason: 'account' })"
          >
            Sign in
          </button>
        </div>
      </section>

      <!-- Your dancers -->
      <section v-if="people.length" class="space-y-3">
        <h2 class="text-heading flex items-baseline justify-between pt-2">
          {{ showingRecent ? 'Recently viewed' : 'Your dancers' }}
          <RouterLink
            v-if="moreFollowed"
            :to="{ name: 'dancers' }"
            class="text-primary -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-[0.9375rem] font-bold"
          >
            See all {{ people.length }}
          </RouterLink>
          <span v-else-if="!showingRecent" class="text-muted-foreground text-sm font-semibold">
            {{ people.length }} followed
          </span>
          <button
            v-else
            type="button"
            aria-label="Clear recently viewed"
            class="text-primary -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-[0.9375rem] font-bold"
            @click="clearRecent()"
          >
            Clear
          </button>
        </h2>

        <template v-if="loading && !cards.length">
          <Skeleton v-for="i in Math.min(people.length, 2)" :key="i" class="h-52 w-full rounded-2xl!" />
        </template>

        <ul v-if="compact && cards.length" class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
          <DancerCompactRow v-for="card in shownCards" :key="card.id" :card="card" :color="cardColor(card)" />
        </ul>
        <template v-for="card in compact ? [] : shownCards" :key="card.id">
          <template v-if="card.focus && card.focus.days.length">
            <DancerDayCard
              :days="card.focus.days"
              :fresh="liveFresh"
              :competition-id="card.focus.competitionId"
              :color="cardColor(card)"
              :competition-name="
                card.focus.phase === 'today'
                  ? null
                  : `${card.focus.phase === 'before' ? 'Next' : 'Last'}: ${card.focus.competition.name}`
              "
            />
          </template>
          <Skeleton v-else-if="card.loading" class="h-40 w-full rounded-2xl!" />
          <RouterLink
            v-else
            :to="{ name: 'dancer.info', params: { dancerId: card.id } }"
            class="bg-card flex items-center gap-3 overflow-hidden rounded-2xl border p-4 shadow-sm"
            :style="{ '--dc': cardColor(card) ?? 'var(--strong)'}"
          >
            <span class="sash h-10 w-1.5 shrink-0 rounded-full" aria-hidden="true" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[1.0625rem] font-extrabold">{{ card.name }}</span>
              <span class="text-muted-foreground block truncate text-sm">{{ cardLine(card) }}</span>
            </span>
            <ChevronRight class="text-muted-foreground size-5" />
          </RouterLink>
        </template>
      </section>

      <!-- Coming up -->
      <section v-if="comingUp.length || nextAnywhere.length || competitionsLoading" class="space-y-3">
        <h2 class="text-heading pt-2">{{ comingUp.length ? 'Coming up' : 'Next competitions' }}</h2>
        <div v-if="competitionsLoading && !comingUp.length && !nextAnywhere.length" class="space-y-2" aria-busy="true">
          <Skeleton v-for="i in 3" :key="i" class="h-16 w-full rounded-2xl!" />
        </div>
        <ul v-else class="divide-y overflow-hidden rounded-2xl border shadow-sm">
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
            />
          </template>
        </ul>
      </section>

      <!-- Latest results, when nothing personal is on -->
      <section v-if="showingRecent && latestResults.length" class="space-y-3">
        <h2 class="text-heading pt-2">Latest results</h2>
        <ul class="divide-y overflow-hidden rounded-2xl border shadow-sm">
          <CompetitionDateRow
            v-for="c in latestResults"
            :key="c.id"
            :competition="c"
            :to="{ name: 'competition.results', params: { competitionId: c.id } }"
          />
        </ul>
      </section>

      <!-- Always a way into every competition, however quiet Home is, and
           for organisers, a way to add theirs. -->
      <div class="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <RouterLink
          :to="{ name: 'competitions' }"
          class="bg-card border-strong hover:bg-accent flex h-12 items-center justify-center gap-2 rounded-xl border text-base font-bold sm:flex-1"
        >
          <CalendarDays class="size-5" /> All competitions
        </RouterLink>
        <RouterLink
          :to="{ name: 'competitions.submit' }"
          class="bg-card border-strong hover:bg-accent flex h-12 items-center justify-center gap-2 rounded-xl border text-base font-bold sm:flex-1"
        >
          <SquarePlus class="size-5" /> Submit a competition
        </RouterLink>
      </div>
    </main>
  </div>
</template>
