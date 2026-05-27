<script setup lang="ts">
import { computed, onMounted, toRef } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useVtScope } from '@/lib/viewTransitionFocus'
import { CalendarX } from '@lucide/vue'
import CompChip from '@/components/CompChip.vue'
import CompetitionBottomNav from '@/components/nav/CompetitionBottomNav.vue'
import TopBackButton from '@/components/nav/TopBackButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import FavoriteCompetitionButton from '@/components/FavoriteCompetitionButton.vue'
import ShareButton from '@/components/ShareButton.vue'
import Skeleton from '@/components/Skeleton.vue'
import { provideCompetition } from '@/composables/useCompetition'
import { provideInfoHeader } from '@/composables/useScrolledPast'
import { useFavoritesStore } from '@/stores/favorites'
import { usePageTitle } from '@/composables/usePageTitle'

const TAB_LABEL_BY_ROUTE: Record<string, string> = {
  'competition.info': 'Info',
  'competition.dancers': 'Dancers',
  'competition.schedule': 'Schedule',
  'competition.results': 'Results',
  'competition.dancer': 'Dancers',
  'competition.event': 'Schedule',
  'competition.group': 'Results',
}

type ChromeMode = 'info' | 'top-level' | 'drill-down'

const MODE_BY_ROUTE: Record<string, ChromeMode> = {
  'competition.info': 'info',
  'competition.dancers': 'top-level',
  'competition.schedule': 'top-level',
  'competition.results': 'top-level',
  'competition.dancer': 'drill-down',
  'competition.event': 'drill-down',
  'competition.group': 'drill-down',
}

const route = useRoute()
const competitionId = computed(() => String(route.params.competitionId ?? ''))

// Tag the current competition as the view-transition source for the list so
// back-nav re-tags the right row before it remounts.
useVtScope('comp').syncFocus(competitionId)

const { competition, notFound, loading, error, loadSchedule } = provideCompetition(
  toRef(competitionId),
)

const favorites = useFavoritesStore()
const isFavorite = computed(() =>
  favorites.isFavorite('competitions', competitionId.value),
)

// Trigger schedule load eagerly so the bottom nav can decide whether to show
// the Schedule tab without waiting for the user to visit it.
onMounted(loadSchedule)

const mode = computed<ChromeMode>(() => MODE_BY_ROUTE[String(route.name ?? '')] ?? 'info')

// Child Info component registers its <header> ref via this provide; once the
// header scrolls past the fixed nav, the small-title name pill fades in.
// The child reads `scrolledPast` to drop its own VT name classes while the
// pill is the visible representation, so only one element ever owns a given
// view-transition-name at VT capture time.
const { scrolledPast: scrolledPastInfoHeader } = provideInfoHeader()
const showNamePill = computed(() => mode.value !== 'info' || scrolledPastInfoHeader.value)

usePageTitle(() => [
  TAB_LABEL_BY_ROUTE[String(route.name ?? '')],
  notFound.value ? 'Not found' : competition.value?.name,
  'Competitions',
])
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1rem)]">
    <nav class="pointer-events-none fixed inset-x-0 top-0 z-30 px-4 pt-(--nav-top)">
      <div class="mx-auto flex h-12 max-w-3xl items-center gap-2">
        <TopBackButton />

        <div class="min-w-0 flex-1">
          <RouterLink
            v-tap-feedback
            :to="{ name: 'competition.info', params: { competitionId } }"
            :class="[
              'floating-nav flex w-full items-center gap-2 rounded-full p-1 pr-4 [view-transition-class:fixed-height_fit] transition ease-rubber-band',
              showNamePill
                ? 'pointer-events-auto translate-y-0 opacity-100 [view-transition-name:nav-pill] hover:opacity-90'
                : 'pointer-events-none -translate-y-full opacity-0',
            ]"
            :title="competition?.name ?? ''"
          >
            <CompChip
              :name="competition?.name"
              :image="competition?.image"
              :favorite="isFavorite"
              :class="[
                'size-10 rounded-full [view-transition-class:nav-avatar]',
                showNamePill && '[view-transition-name:comp-avatar]',
              ]"
            />
            <div class="min-w-0 flex-1">
              <div
                :class="[
                  'truncate text-lg leading-none font-medium tracking-tight [view-transition-class:fit_nav-title]',
                  showNamePill && '[view-transition-name:comp-name]',
                ]"
              >
                {{ competition?.name ?? (loading ? 'Loading…' : 'Competition') }}
              </div>
              <div class="mt-1 truncate text-xs leading-none opacity-70">
                Competition
              </div>
            </div>
          </RouterLink>
        </div>

        <div
          class="floating-nav pointer-events-auto flex h-12 shrink-0 items-center gap-0.5 rounded-full px-1.5 [view-transition-class:fixed-height] [view-transition-name:nav-actions]"
        >
          <FavoriteCompetitionButton
            v-if="mode === 'info'"
            :competition-id="competitionId"
            class="hover:bg-card-foreground/10! flex! size-9! items-center justify-center rounded-full! p-0! [view-transition-name:match-element]"
          />
          <ShareButton
            :title="competition?.name ?? undefined"
            class="hover:bg-card-foreground/10! flex! size-9! items-center justify-center rounded-full! p-0! [view-transition-name:match-element]"
          />
        </div>
      </div>
    </nav>

    <main
      class="mx-auto w-full max-w-3xl flex-1 px-4 pt-[calc(var(--chrome-top)+1rem)] pb-4"
    >
      <div v-if="loading" class="space-y-5" aria-busy="true" aria-live="polite">
        <span class="sr-only">Loading competition…</span>
        <header class="space-y-3 pr-16">
          <Skeleton class="size-18 rounded-2xl!" />
          <Skeleton class="h-9 w-3/4" />
        </header>
        <Skeleton class="h-24 w-full rounded-2xl!" />
        <div class="grid grid-cols-3 gap-2">
          <Skeleton v-for="i in 3" :key="i" class="h-16 rounded-xl!" />
        </div>
      </div>
      <EmptyState
        v-else-if="notFound"
        :icon="CalendarX"
        title="No competition found"
        description="This competition may not be public yet, or the link is no longer valid."
      />
      <div v-else-if="error" class="text-destructive text-lg">{{ error.message }}</div>
      <RouterView v-else />
    </main>

    <CompetitionBottomNav />
  </div>
</template>
