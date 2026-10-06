<script setup lang="ts">
import { computed, toRef, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { CalendarX, ChevronRight, EyeOff, Hourglass, Pencil } from '@lucide/vue'
import { useMeStore } from '@/stores/me'
import AppBar from '@/components/nav/AppBar.vue'
import ShareButton from '@/components/ShareButton.vue'
import AdminMark from '@/components/AdminMark.vue'
import CompetitionBottomNav from '@/components/nav/CompetitionBottomNav.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import Button from '@/components/ui/Button.vue'
import { provideCompetition } from '@/composables/useCompetition'
import { provideInfoHeader } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import { useRecentEntities } from '@/composables/useRecentEntities'
import { competitionEntry, historyPosition } from '@/lib/competitionExit'
import { backLabelFor } from '@/lib/backLabels'
import { competitionPhase } from '@/lib/dancerDay'
import { formatShortDate } from '@/lib/format'
import { VISIBILITY, visibilityOf } from '@/lib/visibility'

const TAB_LABEL_BY_ROUTE: Record<string, string> = {
  'competition.info': 'Overview',
  'competition.dancers': 'Dancers',
  'competition.schedule': 'Schedule',
  'competition.results': 'Results',
}

const route = useRoute()
const me = useMeStore()
const competitionId = computed(() => String(route.params.competitionId ?? ''))


const { competition, notFound, restricted, loading, error, loadSchedule, loadResults, schedule, scheduleHidden, resultsHidden } =
  provideCompetition(toRef(competitionId))

// The schedule says how many days the competition runs, and whether the
// organisers hid the Schedule or Results tab.
watch(
  competition,
  (c) => {
    if (!c) return
    void loadSchedule()
    void loadResults()
  },
  { immediate: true },
)

// Search lists the competitions you've opened under Recently viewed.
const recentCompetitions = useRecentEntities('competitions')
watch(
  () => [competitionId.value, competition.value?.name, competition.value?.date] as const,
  ([id, name, date]) => name && recentCompetitions.record(id, name, date, competition.value?.organisations),
  { immediate: true },
)

// A hidden tab is gone from the bar; a link straight to it says why.
const hiddenHere = computed(() => {
  const name = String(route.name ?? '')
  if (scheduleHidden.value && (name === 'competition.schedule' || name === 'competition.event'))
    return { title: 'No schedule here', what: 'its schedule' }
  if (resultsHidden.value && (name === 'competition.results' || name === 'competition.group'))
    return { title: 'No results here', what: 'its results' }
  return null
})

const reload = () => window.location.reload()

// Its admins see everything here, so every tab says when everyone else
// doesn't, with the way to change it.
const hidden = computed(() => {
  const c = competition.value
  if (!c || !me.hasCompetitionPerm(competitionId.value)) return null
  const v = visibilityOf(c)
  return v === 'published' ? null : v
})

// Not published yet: before the day it's still coming; on or after it,
// the organisers just haven't put it here.
const unpublishedNote = computed(() =>
  competitionPhase(competition.value?.date) === 'before'
    ? 'Dancers, the schedule and results show here once they’re published. Check back closer to the day.'
    : 'Dancers, the schedule and results show here once they’re published. The organisers haven’t published these here yet.',
)

// Each page registers its big in-page title (for the bar's border once it
// scrolls under). The competition name and date sit in the bar on every page
// but Overview, whose own big title shrinks into the bar as you leave it
// (shared view-transition name) or scroll past it.
const { scrolledPast } = provideInfoHeader()

const isTopTab = computed(() => String(route.name ?? '') in TAB_LABEL_BY_ROUTE)
const isOverview = computed(() => route.name === 'competition.info')
const subtitle = computed(() => {
  const c = competition.value
  if (!c) return null
  const when = competitionPhase(c.date, schedule.value) === 'today' ? 'Today' : formatShortDate(c.date)
  return [when, c.location].filter(Boolean).join(' · ') || null
})

// On a tab, Back leaves the competition in one tap: to wherever you came
// from, or the competitions list for a deep link. Deeper pages step back
// normally (a group back to Results).
const exit = computed(() => {
  void route.fullPath
  if (!isTopTab.value) return null
  const e = competitionEntry.value
  const delta = e && e.competitionId === competitionId.value && e.back ? e.position - 1 - historyPosition() : 0
  if (e?.back && delta < 0) return { delta, label: backLabelFor(e.back), compact: true }
  return { to: { name: 'competitions' }, label: 'Competitions', compact: true }
})

// Drill-down pages (a group, a dancer, an event) set their own title; the
// top-level tabs are titled "Tab • Competition" so Back reads e.g. "Results".
usePageTitle(() => [
  isTopTab.value ? TAB_LABEL_BY_ROUTE[String(route.name)] : null,
  notFound.value ? 'Not found' : competition.value?.name,
])
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar
      :title="competition?.name"
      :subtitle="subtitle"
      :show-title="!isOverview || scrolledPast"
      :scrolled="scrolledPast"
      :fallback="{ to: { name: 'competitions' }, label: 'Competitions' }"
      :exit="exit"
      compact-back
      :competition-id="competitionId"
    >
      <template #actions>
        <RouterLink
          v-if="me.hasCompetitionPerm(competitionId)"
          :to="{ name: 'manage', params: { competitionId } }"
          aria-label="Manage this competition"
          title="Manage"
          class="press hover:bg-accent text-primary flex size-9 items-center justify-center rounded-full"
        >
          <span class="relative flex"><Pencil class="size-5" /><AdminMark ring="background" /></span>
        </RouterLink>
        <ShareButton :title="competition?.name ?? undefined" />
      </template>
    </AppBar>

    <main class="mx-auto w-full max-w-3xl flex-1 px-4 pt-[calc(var(--chrome-top)+0.5rem)]">
      <RouterLink
        v-if="hidden && !loading"
        :to="{ name: 'manage', params: { competitionId } }"
        :class="[
          'press-row focus-inset mb-4 flex min-h-12 items-center gap-3 rounded-2xl px-4 py-2.5 text-sm',
          hidden === 'unlisted' ? 'bg-foreground text-background' : 'bg-card border-foreground/40 border',
        ]"
      >
        <component :is="VISIBILITY[hidden].icon" class="size-5 shrink-0" aria-hidden="true" />
        <span class="min-w-0 flex-1"><span class="font-semibold">{{ VISIBILITY[hidden].label }}:</span> {{ VISIBILITY[hidden].line }}</span>
        <span :class="['flex shrink-0 items-center font-semibold', hidden === 'unpublished' && 'text-primary']">
          Manage<ChevronRight class="size-4" aria-hidden="true" />
        </span>
      </RouterLink>
      <div v-if="loading" class="space-y-4" aria-busy="true" aria-live="polite">
        <span class="sr-only">Loading competition…</span>
        <Skeleton class="h-5 w-1/3" />
        <Skeleton class="h-8 w-3/4" />
        <Skeleton class="h-40 w-full rounded-2xl!" />
      </div>
      <EmptyState
        v-else-if="notFound"
        :icon="CalendarX"
        title="Competition not found"
        description="It may not be public yet, or the link has changed. Try finding it under Competitions."
      />
      <div v-else-if="error" class="space-y-3 py-8 text-center">
        <p class="text-base font-semibold">This competition didn’t load. Check your connection.</p>
        <Button variant="primary" size="lg" @click="reload">Try again</Button>
      </div>
      <EmptyState
        v-else-if="restricted && !isOverview"
        :icon="Hourglass"
        title="Not published yet"
        :description="unpublishedNote"
      />
      <EmptyState
        v-else-if="hiddenHere"
        :icon="EyeOff"
        :title="hiddenHere.title"
        :description="`This competition doesn’t share ${hiddenHere.what} in ScotDance.app. Check with the organisers.`"
      />
      <!-- Keyed: an alert can jump to another competition's same page, which must load afresh. -->
      <RouterView v-else :key="competitionId" />
    </main>

    <CompetitionBottomNav />
  </div>
</template>
