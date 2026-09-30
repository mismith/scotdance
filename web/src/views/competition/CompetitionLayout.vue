<script setup lang="ts">
import { computed, onMounted, toRef } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useVtScope } from '@/lib/viewTransitionFocus'
import { CalendarX } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import ShareButton from '@/components/ShareButton.vue'
import CompetitionBottomNav from '@/components/nav/CompetitionBottomNav.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import { provideCompetition } from '@/composables/useCompetition'
import { provideInfoHeader } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'

const TAB_LABEL_BY_ROUTE: Record<string, string> = {
  'competition.info': 'Overview',
  'competition.dancers': 'Dancers',
  'competition.schedule': 'Schedule',
  'competition.results': 'Results',
}

const route = useRoute()
const competitionId = computed(() => String(route.params.competitionId ?? ''))

useVtScope('comp').syncFocus(competitionId)

const { competition, notFound, loading, error, loadSchedule } = provideCompetition(
  toRef(competitionId),
)

onMounted(loadSchedule)

const reload = () => window.location.reload()

// Each tab registers its big in-page title; once it scrolls under the app
// bar, the competition name appears there instead.
const { scrolledPast } = provideInfoHeader()

const isTopTab = computed(() => String(route.name ?? '') in TAB_LABEL_BY_ROUTE)

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
      :show-title="scrolledPast"
      :fallback="{ to: { name: 'competitions' }, label: 'Competitions' }"
    >
      <template #actions>
        <ShareButton :title="competition?.name ?? undefined" />
      </template>
    </AppBar>

    <main class="mx-auto w-full max-w-3xl flex-1 px-4 pt-[calc(var(--chrome-top)+0.5rem)]">
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
        <button
          type="button"
          class="bg-primary text-primary-foreground h-12 rounded-xl px-6 font-bold"
          @click="reload"
        >
          Try again
        </button>
      </div>
      <RouterView v-else />
    </main>

    <CompetitionBottomNav />
  </div>
</template>
