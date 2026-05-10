<script setup lang="ts">
import { computed, onMounted, toRef } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { ChevronLeft } from '@lucide/vue'
import CompChip from '@/components/CompChip.vue'
import CompetitionBottomNav from '@/components/nav/CompetitionBottomNav.vue'
import FavoriteCompetitionButton from '@/components/FavoriteCompetitionButton.vue'
import ShareButton from '@/components/ShareButton.vue'
import { provideCompetition } from '@/composables/useCompetition'
import { formatShortDate } from '@/lib/format'
import { preferBackClick } from '@/lib/smartBack'

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

const { competition, notFound, loading, error, loadSchedule } = provideCompetition(
  toRef(competitionId),
)

// Trigger schedule load eagerly so the bottom nav can decide whether to show
// the Schedule tab without waiting for the user to visit it.
onMounted(loadSchedule)

const mode = computed<ChromeMode>(() => MODE_BY_ROUTE[String(route.name ?? '')] ?? 'info')
const backTo = computed(() => DRILL_DOWN_PARENT[String(route.name ?? '')] ?? null)

const dateLabel = computed(() => formatShortDate(competition.value?.date))
const locationLabel = computed(() => competition.value?.location ?? '')
</script>

<template>
  <div class="flex flex-1 flex-col">
    <nav class="pt-safe pointer-events-none fixed inset-x-0 top-0 z-30 px-3">
      <div class="mx-auto flex max-w-3xl items-center gap-2 pt-3">
        <RouterLink
          v-if="backTo"
          v-slot="{ href, navigate }"
          :to="{ name: backTo, params: { competitionId } }"
          custom
        >
          <a
            :href="href"
            class="bg-nav/90 text-nav-foreground pointer-events-auto flex size-12 shrink-0 items-center justify-center rounded-full shadow-lg backdrop-blur-xl [view-transition-name:nav-back] hover:opacity-90"
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
          class="bg-nav/90 text-nav-foreground pointer-events-auto flex min-w-0 flex-1 items-center gap-2 rounded-full p-1 pr-4 shadow-lg backdrop-blur-xl [view-transition-name:nav-pill] hover:opacity-90"
          :title="competition?.name ?? ''"
        >
          <CompChip
            :name="competition?.name"
            :image="competition?.image"
            :size="40"
            :radius="999"
            class="[view-transition-name:nav-avatar]"
          />
          <div class="min-w-0 flex-1">
            <div
              class="truncate font-serif text-lg leading-none font-medium tracking-tight [view-transition-class:fit] [view-transition-name:nav-name]"
            >
              {{ competition?.name ?? (loading ? 'Loading…' : 'Competition') }}
            </div>
            <div
              v-if="dateLabel || locationLabel"
              class="mt-1 truncate text-xs leading-none opacity-70"
            >
              <span v-if="dateLabel" class="[view-transition-name:nav-date]">{{
                dateLabel
              }}</span>
              <span v-if="locationLabel" class="[view-transition-name:nav-location]">
                <template v-if="dateLabel"> · </template>{{ locationLabel }}
              </span>
            </div>
          </div>
        </RouterLink>

        <div v-else class="min-w-0 flex-1" />

        <div
          class="bg-nav/90 text-nav-foreground pointer-events-auto flex h-12 shrink-0 items-center gap-0.5 rounded-full px-1.5 shadow-lg backdrop-blur-xl [view-transition-class:fixed-height] [view-transition-name:nav-actions]"
        >
          <FavoriteCompetitionButton
            v-if="mode === 'info'"
            :competition-id="competitionId"
            class="hover:bg-nav-foreground/10! flex! size-9! items-center justify-center rounded-full! p-0! [view-transition-name:match-element]"
          />
          <ShareButton
            :title="competition?.name ?? undefined"
            :text="competition?.name ?? undefined"
            class="hover:bg-nav-foreground/10! flex! size-9! items-center justify-center rounded-full! p-0! [view-transition-name:match-element]"
          />
        </div>
      </div>
    </nav>

    <main class="pt-safe-nav mx-auto w-full max-w-3xl flex-1 px-4 pb-4">
      <div v-if="loading" class="text-muted-foreground font-serif text-lg italic">
        Loading…
      </div>
      <div v-else-if="notFound" class="text-muted-foreground text-lg">
        No competition found.
      </div>
      <div v-else-if="error" class="text-destructive text-lg">{{ error.message }}</div>
      <RouterView v-else />
    </main>

    <CompetitionBottomNav />
  </div>
</template>
