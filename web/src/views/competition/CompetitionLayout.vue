<script setup lang="ts">
import { computed, toRef } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { ChevronLeft } from '@lucide/vue'
import AccountMenu from '@/components/AccountMenu.vue'
import { provideCompetition } from '@/composables/useCompetition'
import { provideChromeTitle } from '@/composables/useChromeTitle'

const route = useRoute()
const competitionId = computed(() => String(route.params.competitionId ?? ''))

const { competition, notFound, loading, error } = provideCompetition(toRef(competitionId))

const drillDownParent: Record<string, string> = {
  'competition.event': 'competition.schedule',
  'competition.group': 'competition.results',
  'competition.dancer': 'competition.dancers',
}
const backTo = computed(() => drillDownParent[String(route.name ?? '')] ?? null)

const mark = computed(
  () => (competition.value?.name ?? '').trim().charAt(0).toUpperCase() || '?',
)

const chromeOverride = provideChromeTitle()
const chromeTitle = computed(
  () =>
    chromeOverride.value ??
    competition.value?.name ??
    (loading.value ? 'Loading…' : 'Competition'),
)
</script>

<template>
  <div class="flex flex-1 flex-col">
    <header
      class="sticky top-0 z-30 overflow-hidden pt-safe text-white"
      style="
        background-image: linear-gradient(
          135deg,
          color-mix(in oklch, var(--primary) 75%, black) 0%,
          var(--primary) 100%
        );
      "
    >
      <span
        aria-hidden="true"
        class="font-serif pointer-events-none absolute -right-4 -top-6 select-none font-medium leading-none text-white/10"
        style="font-size: 9rem; letter-spacing: -0.4rem"
      >
        {{ mark }}
      </span>
      <div class="relative mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <RouterLink
          v-if="backTo"
          :to="{ name: backTo, params: { competitionId } }"
          class="hover:bg-white/10 -ml-1 rounded-full p-2 text-white/80 hover:text-white"
          title="Back"
          aria-label="Back"
        >
          <ChevronLeft class="size-5" />
        </RouterLink>
        <div
          class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/15"
        >
          <img
            v-if="competition?.image"
            :src="competition.image"
            :alt="competition.name ?? ''"
            class="size-full object-cover"
          />
          <span v-else class="font-serif text-base font-medium leading-none">
            {{ mark }}
          </span>
        </div>
        <h1
          class="font-serif min-w-0 flex-1 truncate text-lg font-medium tracking-tight leading-tight"
        >
          {{ chromeTitle }}
        </h1>
        <div
          class="[&_button]:text-white/85 [&_button]:hover:bg-white/10! [&_button]:hover:text-white"
        >
          <AccountMenu />
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-3xl flex-1 p-4 pt-8">
      <div v-if="loading" class="text-muted-foreground font-serif italic text-sm">
        Loading…
      </div>
      <div v-else-if="notFound" class="text-muted-foreground text-sm">
        No competition found.
      </div>
      <div v-else-if="error" class="text-destructive text-sm">{{ error.message }}</div>
      <RouterView v-else />
    </main>
  </div>
</template>
