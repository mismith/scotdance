<script setup lang="ts">
import { computed, toRef } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { ChevronLeft } from '@lucide/vue'
import AccountMenu from '@/components/AccountMenu.vue'
import { provideCompetition } from '@/composables/useCompetition'

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
</script>

<template>
  <div class="flex flex-1 flex-col">
    <!-- Sticky editorial chrome — gradient blue + giant letter watermark
         all in one sticky surface. No separate hero band that could leave
         a visible stripe when scrolled. -->
    <header
      class="sticky top-0 z-20 overflow-hidden text-white"
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
          class="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
          title="Back"
          aria-label="Back"
        >
          <ChevronLeft class="size-5" />
        </RouterLink>
        <div
          class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/15 backdrop-blur-md"
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
        <div class="min-w-0 flex-1">
          <h1
            class="font-serif truncate text-base font-medium tracking-tight leading-[1.1]"
          >
            {{ competition?.name ?? (loading ? 'Loading…' : 'Competition') }}
          </h1>
          <p v-if="competition?.location" class="truncate text-[11px] text-white/70">
            {{ competition.location }}
          </p>
        </div>
        <AccountMenu />
      </div>
    </header>

    <main class="mx-auto w-full max-w-3xl flex-1 p-4">
      <div v-if="loading" class="text-muted-foreground text-sm">Loading…</div>
      <div v-else-if="notFound" class="text-muted-foreground text-sm">
        No competition found.
      </div>
      <div v-else-if="error" class="text-destructive text-sm">{{ error.message }}</div>
      <RouterView v-else />
    </main>
  </div>
</template>
