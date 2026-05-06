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
    <!-- Hero band — gradient + giant letter watermark. Scrolls away under
         the floating chrome below. -->
    <div
      class="relative h-32 shrink-0 overflow-hidden text-white"
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
        class="font-serif pointer-events-none absolute -right-6 -top-6 select-none font-medium leading-none text-white/10"
        style="font-size: 14rem; letter-spacing: -0.5rem"
      >
        {{ mark }}
      </span>
    </div>

    <!-- Floating chrome — three sticky pills sitting over the hero, then
         over content as the page scrolls. Backdrop blur means content
         shows through when the hero is gone. -->
    <div
      class="sticky top-3 z-30 -mt-20 mx-auto flex w-full max-w-3xl items-center gap-2 px-3"
    >
      <RouterLink
        v-if="backTo"
        :to="{ name: backTo, params: { competitionId } }"
        class="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-zinc-950/55 text-white shadow-md backdrop-blur-xl hover:bg-zinc-950/70"
        title="Back"
        aria-label="Back"
      >
        <ChevronLeft class="size-5" />
      </RouterLink>
      <div
        class="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-white/15 bg-zinc-950/55 pr-3.5 pl-1.5 text-white shadow-md backdrop-blur-xl"
      >
        <div
          class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15"
        >
          <img
            v-if="competition?.image"
            :src="competition.image"
            :alt="competition.name ?? ''"
            class="size-full object-cover"
          />
          <span v-else class="font-serif text-sm font-medium leading-none">
            {{ mark }}
          </span>
        </div>
        <h1
          class="font-serif min-w-0 flex-1 truncate text-sm font-medium tracking-tight leading-tight"
        >
          {{ competition?.name ?? (loading ? 'Loading…' : 'Competition') }}
        </h1>
      </div>
      <div
        class="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-zinc-950/55 text-white shadow-md backdrop-blur-xl"
      >
        <AccountMenu />
      </div>
    </div>

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
