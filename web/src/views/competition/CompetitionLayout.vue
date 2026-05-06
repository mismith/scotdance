<script setup lang="ts">
import { computed, toRef } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { ChevronLeft } from '@lucide/vue'
import AccountMenu from '@/components/AccountMenu.vue'
import CompChip from '@/components/CompChip.vue'
import { provideCompetition } from '@/composables/useCompetition'

const route = useRoute()
const competitionId = computed(() => String(route.params.competitionId ?? ''))

const { competition, notFound, loading, error } = provideCompetition(toRef(competitionId))

// Drill-downs go back one level to their parent tab; top-level tabs use the
// bottom-nav home button instead.
const drillDownParent: Record<string, string> = {
  'competition.event': 'competition.schedule',
  'competition.group': 'competition.results',
  'competition.dancer': 'competition.dancers',
}
const backTo = computed(() => drillDownParent[String(route.name ?? '')] ?? null)
</script>

<template>
  <div class="flex flex-1 flex-col">
    <header class="bg-background sticky top-0 z-20 border-b">
      <div class="mx-auto flex max-w-3xl items-center gap-3 p-4">
        <RouterLink
          v-if="backTo"
          :to="{ name: backTo, params: { competitionId } }"
          class="hover:bg-accent text-muted-foreground hover:text-foreground rounded-md p-2"
          title="Back"
          aria-label="Back"
        >
          <ChevronLeft class="size-5" />
        </RouterLink>
        <CompChip
          :name="competition?.name"
          :image="competition?.image"
          :size="44"
          :radius="10"
        />
        <div class="min-w-0 flex-1">
          <h1
            class="font-serif truncate text-lg font-medium tracking-tight leading-[1.1]"
          >
            {{ competition?.name ?? (loading ? 'Loading…' : 'Competition') }}
          </h1>
          <p v-if="competition?.location" class="text-muted-foreground truncate text-xs">
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
