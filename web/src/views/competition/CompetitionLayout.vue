<script setup lang="ts">
import { computed, onMounted, toRef } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useVtScope } from '@/lib/viewTransitionFocus'
import { ChevronLeft } from '@lucide/vue'
import CompChip from '@/components/CompChip.vue'
import CompetitionBottomNav from '@/components/nav/CompetitionBottomNav.vue'
import EmptyState from '@/components/EmptyState.vue'
import FavoriteCompetitionButton from '@/components/FavoriteCompetitionButton.vue'
import ShareButton from '@/components/ShareButton.vue'
import Skeleton from '@/components/Skeleton.vue'
import { CalendarX } from '@lucide/vue'
import { provideCompetition } from '@/composables/useCompetition'
import { useFavoritesStore } from '@/stores/favorites'
import { preferBackClick, useExternalBack } from '@/lib/back'
import { formatShortDate } from '@/lib/format'
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

const DRILL_DOWN_PARENT: Record<string, string> = {
  'competition.dancer': 'competition.dancers',
  'competition.event': 'competition.schedule',
  'competition.group': 'competition.results',
}

const route = useRoute()
const router = useRouter()
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
const backTo = computed(() => DRILL_DOWN_PARENT[String(route.name ?? '')] ?? null)

// Drill-down has its own in-comp back button, so only surface the external
// back chevron on info/top-level routes.
const externalBack = useExternalBack({ name: 'competitions' })
const showExternalBack = computed(
  () => mode.value !== 'drill-down' && externalBack.show.value,
)

const dateLabel = computed(() => formatShortDate(competition.value?.date))
const locationLabel = computed(() => competition.value?.location ?? '')

usePageTitle(() => [
  TAB_LABEL_BY_ROUTE[String(route.name ?? '')],
  notFound.value ? 'Not found' : competition.value?.name,
  'Competitions',
])
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1rem)]">
    <nav class="pointer-events-none fixed inset-x-0 top-0 z-30 px-4 pt-(--nav-top)">
      <div class="mx-auto flex max-w-3xl items-center gap-2">
        <RouterLink
          v-if="showExternalBack && externalBack.to.value"
          v-slot="{ href, navigate }"
          :to="externalBack.to.value"
          custom
        >
          <a
            :href="href"
            class="floating-nav pointer-events-auto flex size-12 shrink-0 items-center justify-center rounded-full [view-transition-name:nav-back] hover:opacity-90"
            title="Back"
            aria-label="Back"
            @click="preferBackClick(router, $event, navigate)"
          >
            <ChevronLeft class="size-5" />
          </a>
        </RouterLink>

        <RouterLink
          v-if="backTo"
          v-slot="{ href, navigate }"
          :to="{ name: backTo, params: { competitionId } }"
          custom
        >
          <a
            :href="href"
            class="floating-nav pointer-events-auto flex size-12 shrink-0 items-center justify-center rounded-full [view-transition-name:nav-back] hover:opacity-90"
            title="Back"
            aria-label="Back"
            @click="preferBackClick(router, $event, navigate)"
          >
            <ChevronLeft class="size-5" />
          </a>
        </RouterLink>

        <RouterLink
          v-if="mode !== 'info'"
          :to="{ name: 'competition.info', params: { competitionId } }"
          class="floating-nav pointer-events-auto flex min-w-0 flex-1 items-center gap-2 rounded-full p-1 pr-4 [view-transition-class:fixed-height] [view-transition-name:nav-pill] hover:opacity-90"
          :title="competition?.name ?? ''"
        >
          <CompChip
            :name="competition?.name"
            :image="competition?.image"
            :favorite="isFavorite"
            class="size-10 rounded-full [view-transition-class:nav-avatar] [view-transition-name:comp-avatar]"
          />
          <div class="min-w-0 flex-1">
            <div
              class="truncate text-lg leading-none font-medium tracking-tight [view-transition-class:fit_nav-title] [view-transition-name:comp-name]"
            >
              {{ competition?.name ?? (loading ? 'Loading…' : 'Competition') }}
            </div>
            <div
              v-if="dateLabel || locationLabel"
              class="mt-1 truncate text-xs leading-none opacity-70"
            >
              <span v-if="dateLabel">{{ dateLabel }}</span>
              <span v-if="locationLabel">
                <template v-if="dateLabel"> · </template>{{ locationLabel }}
              </span>
            </div>
          </div>
        </RouterLink>

        <div v-else class="min-w-0 flex-1" />

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

    <main class="mx-auto w-full max-w-3xl flex-1 px-4 pt-[calc(var(--chrome-top)+1rem)] pb-4">
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
