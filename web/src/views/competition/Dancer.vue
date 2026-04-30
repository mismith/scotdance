<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useCompetition } from '@/composables/useCompetition';

const route = useRoute();
const { competitionId, dancers, loadDancers } = useCompetition();

onMounted(loadDancers);

const dancerId = computed(() => String(route.params.dancerId ?? ''));
const dancer = computed(() => dancers.value.find((d) => d.id === dancerId.value) ?? null);
</script>

<template>
  <article class="space-y-6">
    <RouterLink
      :to="{ name: 'competition.dancers', params: { competitionId } }"
      class="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
    >
      ← All dancers
    </RouterLink>

    <div v-if="!dancers.length" class="text-muted-foreground text-sm">Loading…</div>

    <div v-else-if="!dancer" class="text-muted-foreground text-sm">
      Dancer not found.
    </div>

    <header v-else class="flex flex-wrap gap-6">
      <img
        v-if="dancer.image"
        :src="dancer.image"
        :alt="dancer.fullName"
        class="size-32 rounded-full object-cover bg-muted shadow"
      />
      <div v-else class="size-32 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-mono text-2xl">
        {{ dancer.number ?? '–' }}
      </div>

      <div class="flex-1 min-w-0 space-y-2">
        <div class="text-xs uppercase tracking-wide text-muted-foreground">
          #{{ dancer.number ?? '?' }}
        </div>
        <h2 class="text-2xl font-semibold">{{ dancer.fullName || '?' }}</h2>
        <div v-if="dancer.group" class="text-sm">
          {{ dancer.group.fullName }}
        </div>
        <div v-if="dancer.location" class="text-sm text-muted-foreground">
          {{ dancer.location }}
        </div>
      </div>
    </header>

    <p v-if="dancer" class="text-xs text-muted-foreground">
      Cross-competition results report coming in a follow-up port.
    </p>
  </article>
</template>
