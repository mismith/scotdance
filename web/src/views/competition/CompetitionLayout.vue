<script setup lang="ts">
import { computed, toRef } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { provideCompetition } from '@/composables/useCompetition';

const route = useRoute();
const competitionId = computed(() => String(route.params.competitionId ?? ''));

const { competition, notFound, loading, error } = provideCompetition(toRef(competitionId));

const tabs = [
  { name: 'Info', to: 'competition.info' },
  { name: 'Dancers', to: 'competition.dancers' },
];
</script>

<template>
  <div class="min-h-svh flex flex-col">
    <header class="border-b">
      <div class="max-w-3xl mx-auto p-4 flex items-center gap-4">
        <img
          v-if="competition?.image"
          :src="competition.image"
          :alt="competition.name ?? ''"
          class="size-14 rounded-md object-cover bg-muted"
        />
        <div class="min-w-0 flex-1">
          <h1 class="text-lg font-semibold truncate">
            {{ competition?.name ?? (loading ? 'Loading…' : 'Competition') }}
          </h1>
          <p v-if="competition?.location" class="text-sm text-muted-foreground truncate">
            {{ competition.location }}
          </p>
        </div>
      </div>
      <nav class="max-w-3xl mx-auto px-4 flex gap-1">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="{ name: tab.to, params: { competitionId } }"
          class="px-3 py-2 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground"
          active-class="!border-primary !text-foreground"
        >
          {{ tab.name }}
        </RouterLink>
      </nav>
    </header>

    <main class="flex-1 max-w-3xl w-full mx-auto p-4">
      <div v-if="loading" class="text-muted-foreground text-sm">Loading…</div>
      <div v-else-if="notFound" class="text-muted-foreground text-sm">No competition found.</div>
      <div v-else-if="error" class="text-destructive text-sm">{{ error.message }}</div>
      <RouterView v-else />
    </main>
  </div>
</template>
