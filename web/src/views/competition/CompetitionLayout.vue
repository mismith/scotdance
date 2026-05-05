<script setup lang="ts">
import { computed, toRef } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { provideCompetition } from '@/composables/useCompetition'

const route = useRoute()
const competitionId = computed(() => String(route.params.competitionId ?? ''))

const { competition, notFound, loading, error } = provideCompetition(toRef(competitionId))

const tabs: Array<{ name: string; to: string; matches: string[] }> = [
  { name: 'Info', to: 'competition.info', matches: ['competition.info'] },
  {
    name: 'Dancers',
    to: 'competition.dancers',
    matches: ['competition.dancers', 'competition.dancer'],
  },
  {
    name: 'Schedule',
    to: 'competition.schedule',
    matches: ['competition.schedule', 'competition.event'],
  },
  {
    name: 'Results',
    to: 'competition.results',
    matches: ['competition.results', 'competition.group'],
  },
]

const activeTab = computed(() => {
  const name = String(route.name ?? '')
  return tabs.find((t) => t.matches.includes(name))?.to
})
</script>

<template>
  <div class="flex flex-1 flex-col">
    <header class="bg-background border-b">
      <div class="mx-auto flex max-w-3xl items-center gap-4 p-4">
        <img
          v-if="competition?.image"
          :src="competition.image"
          :alt="competition.name ?? ''"
          class="bg-muted size-14 rounded-md object-cover"
        />
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-lg font-semibold">
            {{ competition?.name ?? (loading ? 'Loading…' : 'Competition') }}
          </h1>
          <p v-if="competition?.location" class="text-muted-foreground truncate text-sm">
            {{ competition.location }}
          </p>
        </div>
      </div>
      <nav class="mx-auto flex max-w-3xl gap-1 px-4">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="{ name: tab.to, params: { competitionId } }"
          :class="[
            'text-muted-foreground hover:text-foreground border-b-2 px-3 py-2 text-sm font-medium',
            activeTab === tab.to
              ? 'border-primary text-foreground'
              : 'border-transparent',
          ]"
        >
          {{ tab.name }}
        </RouterLink>
      </nav>
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
