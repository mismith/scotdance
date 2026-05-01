<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { refDebounced } from '@vueuse/core';
import { ChevronDown, Loader2, Search, Star, X } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useFavoritesStore } from '@/stores/favorites';
import {
  searchDancers,
  type SearchDancerGroup,
  type SearchDancerHit,
} from '@/lib/searchDancers';
import { fetchCompetitionMeta } from '@/lib/competitionMeta';
import type { Competition } from '@/types/competition';
import { formatShortDate } from '@/lib/format';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const favorites = useFavoritesStore();

const q = ref(String(route.query.q ?? ''));
const selectedName = ref(String(route.query.s ?? ''));
const qDebounced = refDebounced(q, 250);

const searching = ref(false);
const results = shallowRef<SearchDancerGroup[]>([]);
const error = ref<Error | null>(null);

watch(
  () => route.query.q,
  (next) => {
    const value = String(next ?? '');
    if (value !== q.value) q.value = value;
  },
);
watch(
  () => route.query.s,
  (next) => {
    const value = String(next ?? '');
    if (value !== selectedName.value) selectedName.value = value;
  },
);

watch(q, (value) => {
  if (value !== String(route.query.q ?? '')) {
    router.replace({ query: { ...route.query, q: value || undefined } });
  }
  if (!value && selectedName.value) {
    selectedName.value = '';
  }
});

watch(selectedName, (value) => {
  if (value !== String(route.query.s ?? '')) {
    router.replace({ query: { ...route.query, s: value || undefined } });
  }
});

watch(
  [qDebounced, () => auth.isSignedIn],
  async ([value, signedIn]) => {
    if (!signedIn) {
      results.value = [];
      return;
    }
    if (!value.trim()) {
      results.value = [];
      return;
    }
    searching.value = true;
    error.value = null;
    try {
      const groups = await searchDancers(value);
      results.value = groups;
    } catch (e) {
      error.value = e as Error;
      results.value = [];
    } finally {
      searching.value = false;
    }
  },
  { immediate: true },
);

const selectedGroup = computed<SearchDancerGroup | null>(() =>
  results.value.find((g) => g.name === selectedName.value) ?? null,
);

const compMeta = ref<Record<string, Competition | null>>({});

watch(
  selectedGroup,
  async (group) => {
    if (!group) return;
    const ids = [...new Set(group.dancers.map((d) => d.competitionId))].filter(
      (id) => !(id in compMeta.value),
    );
    if (!ids.length) return;
    const fetched = await Promise.all(ids.map((id) => fetchCompetitionMeta(id)));
    const next = { ...compMeta.value };
    ids.forEach((id, i) => {
      next[id] = fetched[i];
    });
    compMeta.value = next;
  },
  { immediate: true },
);

interface CompetitionGroup {
  competitionId: string;
  competition: Competition | null;
  dancers: SearchDancerHit[];
}

const dancersByCompetition = computed<CompetitionGroup[]>(() => {
  if (!selectedGroup.value) return [];
  const map = new Map<string, SearchDancerHit[]>();
  for (const dancer of selectedGroup.value.dancers) {
    const list = map.get(dancer.competitionId) ?? [];
    list.push(dancer);
    map.set(dancer.competitionId, list);
  }
  return [...map.entries()]
    .map<CompetitionGroup>(([competitionId, list]) => ({
      competitionId,
      competition: compMeta.value[competitionId] ?? null,
      dancers: list,
    }))
    .sort((a, b) => {
      const dateA = a.competition?.date ?? 0;
      const dateB = b.competition?.date ?? 0;
      return dateB - dateA;
    });
});

const allSelectedFavorited = computed(() => {
  if (!selectedGroup.value?.dancers.length) return false;
  return selectedGroup.value.dancers.every((d) => favorites.isFavoriteDancer(d.id));
});

async function favoriteAllSelected() {
  if (!selectedGroup.value) return;
  const target = !allSelectedFavorited.value;
  const items = selectedGroup.value.dancers.slice();
  const apply = () =>
    Promise.all(
      items.map((d) => favorites.setDancer(d.id, target, target ? d.fullName : undefined)),
    );
  if (!auth.isSignedIn) {
    auth.enqueueAfterLogin(apply);
    auth.openLogin();
    return;
  }
  await apply();
}

function selectName(name: string) {
  selectedName.value = selectedName.value === name ? '' : name;
}

function clearSearch() {
  q.value = '';
  selectedName.value = '';
}
</script>

<template>
  <main class="flex-1 max-w-3xl w-full mx-auto p-4 space-y-4">
    <header class="space-y-1">
      <h2 class="text-lg font-semibold">Dancers</h2>
      <p class="text-sm text-muted-foreground">
        Search across every published competition.
      </p>
    </header>

    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <input
        v-model="q"
        type="search"
        placeholder="Search by name…"
        :disabled="!auth.isSignedIn"
        class="w-full pl-9 pr-9 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      />
      <button
        v-if="q"
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-accent text-muted-foreground"
        title="Clear"
        @click="clearSearch"
      >
        <X class="size-4" />
      </button>
    </div>

    <div
      v-if="!auth.isSignedIn"
      class="border rounded-md p-6 text-center space-y-3"
    >
      <p class="text-sm text-muted-foreground">
        Sign in to search dancers across competitions.
      </p>
      <button
        type="button"
        class="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        @click="auth.openLogin"
      >
        Sign in
      </button>
    </div>

    <template v-else>
      <div v-if="error" class="text-destructive text-sm">{{ error.message }}</div>

      <div v-if="searching" class="text-muted-foreground text-sm flex items-center gap-2">
        <Loader2 class="size-4 animate-spin" />
        Searching…
      </div>

      <div
        v-else-if="q.trim() && !results.length"
        class="text-muted-foreground text-sm"
      >
        No dancers match.
      </div>

      <ul v-if="results.length" class="divide-y border rounded-md">
        <li v-for="group in results" :key="group.name">
          <button
            type="button"
            class="w-full flex items-center gap-3 p-3 text-left hover:bg-accent"
            @click="selectName(group.name)"
          >
            <span
              :class="[
                'size-9 rounded-full text-xs font-semibold flex items-center justify-center shrink-0',
                group.dancers.some((d) => favorites.isFavoriteDancer(d.id))
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-muted text-muted-foreground',
              ]"
            >
              {{ group.initials }}
            </span>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ group.name || '?' }}</div>
              <div class="text-xs text-muted-foreground">
                {{ group.dancers.length }}
                {{ group.dancers.length === 1 ? 'competition' : 'competitions' }}
              </div>
            </div>
            <ChevronDown
              :class="[
                'size-4 text-muted-foreground transition-transform shrink-0',
                selectedName === group.name ? '' : '-rotate-90',
              ]"
            />
          </button>

          <div
            v-if="selectedName === group.name"
            class="px-3 pb-3 space-y-3 border-t bg-muted/30"
          >
            <div
              v-if="group.dancers.length > 1"
              class="flex justify-end pt-3"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent"
                @click="favoriteAllSelected"
              >
                <Star
                  :class="[
                    'size-3.5',
                    allSelectedFavorited ? 'text-secondary fill-current' : 'text-muted-foreground',
                  ]"
                />
                {{ allSelectedFavorited ? 'Unfavourite all' : 'Favourite all' }}
              </button>
            </div>

            <div
              v-for="comp in dancersByCompetition"
              :key="comp.competitionId"
              class="space-y-1"
            >
              <div
                class="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-baseline gap-2"
              >
                <span class="truncate">
                  {{ comp.competition?.name ?? 'Loading…' }}
                </span>
                <span
                  v-if="comp.competition?.date"
                  class="text-[10px] text-muted-foreground/70 normal-case tracking-normal"
                >
                  {{ formatShortDate(comp.competition.date) }}
                </span>
              </div>
              <ul class="divide-y border rounded-md bg-background">
                <li v-for="dancer in comp.dancers" :key="dancer.id">
                  <RouterLink
                    :to="{
                      name: 'competition.dancer',
                      params: {
                        competitionId: dancer.competitionId,
                        dancerId: dancer.id,
                      },
                    }"
                    class="flex items-center gap-3 p-3 hover:bg-accent"
                  >
                    <div
                      class="size-8 rounded-full bg-muted text-xs font-mono flex items-center justify-center text-muted-foreground shrink-0"
                    >
                      {{ dancer.number ?? '–' }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="font-medium truncate">{{ dancer.fullName || '?' }}</div>
                      <div
                        v-if="dancer.location"
                        class="text-xs text-muted-foreground truncate"
                      >
                        {{ dancer.location }}
                      </div>
                    </div>
                    <Star
                      v-if="favorites.isFavoriteDancer(dancer.id)"
                      class="size-4 text-secondary fill-current shrink-0"
                    />
                  </RouterLink>
                </li>
              </ul>
            </div>
          </div>
        </li>
      </ul>

      <div
        v-else-if="!q.trim()"
        class="text-muted-foreground text-sm"
      >
        Start typing to search.
      </div>
    </template>
  </main>
</template>
