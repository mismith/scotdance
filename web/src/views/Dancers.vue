<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { refDebounced } from '@vueuse/core'
import { ArrowRight, ChevronRight, Loader2, Search, Star, X } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'
import AccountMenu from '@/components/AccountMenu.vue'
import {
  searchDancers,
  type SearchDancerGroup,
  type SearchDancerHit,
} from '@/lib/searchDancers'
import { fetchCompetitionMeta } from '@/lib/competitionMeta'
import type { Competition } from '@/types/competition'
import { formatShortDate } from '@/lib/format'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const favorites = useFavoritesStore()

const q = ref(String(route.query.q ?? ''))
const selectedName = ref(String(route.query.s ?? ''))
const qDebounced = refDebounced(q, 250)

const searching = ref(false)
const results = shallowRef<SearchDancerGroup[]>([])
const error = ref<Error | null>(null)

watch(
  () => route.query.q,
  (next) => {
    const value = String(next ?? '')
    if (value !== q.value) q.value = value
  },
)
watch(
  () => route.query.s,
  (next) => {
    const value = String(next ?? '')
    if (value !== selectedName.value) selectedName.value = value
  },
)

watch(q, (value) => {
  if (value !== String(route.query.q ?? '')) {
    router.replace({ query: { ...route.query, q: value || undefined } })
  }
  if (!value && selectedName.value) {
    selectedName.value = ''
  }
})

watch(selectedName, (value) => {
  if (value !== String(route.query.s ?? '')) {
    router.replace({ query: { ...route.query, s: value || undefined } })
  }
})

watch(
  [qDebounced, () => auth.isSignedIn],
  async ([value, signedIn]) => {
    if (!signedIn) {
      results.value = []
      return
    }
    if (!value.trim()) {
      results.value = []
      return
    }
    searching.value = true
    error.value = null
    try {
      const groups = await searchDancers(value)
      results.value = groups
    } catch (e) {
      error.value = e as Error
      results.value = []
    } finally {
      searching.value = false
    }
  },
  { immediate: true },
)

const selectedGroup = computed<SearchDancerGroup | null>(
  () => results.value.find((g) => g.name === selectedName.value) ?? null,
)

const compMeta = ref<Record<string, Competition | null>>({})

watch(
  selectedGroup,
  async (group) => {
    if (!group) return
    const ids = [...new Set(group.dancers.map((d) => d.competitionId))].filter(
      (id) => !(id in compMeta.value),
    )
    if (!ids.length) return
    const fetched = await Promise.all(ids.map((id) => fetchCompetitionMeta(id)))
    const next = { ...compMeta.value }
    ids.forEach((id, i) => {
      next[id] = fetched[i]
    })
    compMeta.value = next
  },
  { immediate: true },
)

interface CompetitionGroup {
  competitionId: string
  competition: Competition | null
  dancers: SearchDancerHit[]
}

const dancersByCompetition = computed<CompetitionGroup[]>(() => {
  if (!selectedGroup.value) return []
  const map = new Map<string, SearchDancerHit[]>()
  for (const dancer of selectedGroup.value.dancers) {
    const list = map.get(dancer.competitionId) ?? []
    list.push(dancer)
    map.set(dancer.competitionId, list)
  }
  return [...map.entries()]
    .map<CompetitionGroup>(([competitionId, list]) => ({
      competitionId,
      competition: compMeta.value[competitionId] ?? null,
      dancers: list,
    }))
    .sort((a, b) => {
      const dateA = a.competition?.date ?? 0
      const dateB = b.competition?.date ?? 0
      return dateB - dateA
    })
})

const allSelectedFavorited = computed(() => {
  if (!selectedGroup.value?.dancers.length) return false
  return selectedGroup.value.dancers.every((d) => favorites.isFavoriteDancer(d.id))
})

async function favoriteAllSelected() {
  if (!selectedGroup.value) return
  const target = !allSelectedFavorited.value
  const items = selectedGroup.value.dancers.slice()
  const apply = async () => {
    await Promise.all(
      items.map((d) =>
        favorites.setDancer(d.id, target, target ? d.fullName : undefined),
      ),
    )
  }
  if (!auth.isSignedIn) {
    auth.enqueueAfterLogin(apply)
    auth.openLogin()
    return
  }
  await apply()
}

function selectName(name: string) {
  selectedName.value = selectedName.value === name ? '' : name
}

// Provisional: slug-by-name until cross-comp dancer identity is settled.
function dancerSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function clearSearch() {
  q.value = ''
  selectedName.value = ''
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <header
      class="bg-background sticky top-0 z-20 mx-auto flex w-full max-w-3xl items-end justify-between gap-3 p-4 pt-safe pb-3"
    >
      <div class="min-w-0 flex-1">
        <div
          class="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase"
        >
          Across every comp
        </div>
        <h1
          class="font-serif text-3xl font-medium tracking-tight leading-[1.04]"
        >
          Dancers
        </h1>
      </div>
      <AccountMenu />
    </header>
    <main class="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 pt-6">
      <div
        class="bg-card flex h-12 items-center gap-3 rounded-full border px-4 shadow-sm"
      >
        <Search class="text-muted-foreground size-4 shrink-0" />
        <input
          v-model="q"
          type="search"
          placeholder="Search by name…"
          :disabled="!auth.isSignedIn"
          class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm focus:outline-none disabled:opacity-50"
        />
        <button
          v-if="q"
          type="button"
          class="text-muted-foreground hover:text-foreground -mr-1 rounded-full p-1"
          title="Clear"
          @click="clearSearch"
        >
          <X class="size-4" />
        </button>
      </div>

      <div
        v-if="!auth.isSignedIn"
        class="bg-card space-y-3 rounded-2xl border p-6 text-center"
      >
        <p class="font-serif text-base">Sign in to search dancers across competitions.</p>
        <button
          type="button"
          class="bg-primary text-primary-foreground inline-flex items-center rounded-full px-5 py-2 text-sm font-medium hover:opacity-90"
          @click="auth.openLogin"
        >
          Sign in
        </button>
      </div>

      <template v-else>
        <div v-if="error" class="text-destructive text-sm">{{ error.message }}</div>

        <div
          v-if="searching"
          class="text-muted-foreground flex items-center gap-2 font-serif text-sm italic"
        >
          <Loader2 class="size-4 animate-spin" />
          Searching…
        </div>

        <div
          v-else-if="q.trim() && !results.length"
          class="text-muted-foreground font-serif text-sm italic"
        >
          No dancers match.
        </div>

        <ul v-if="results.length" class="divide-y border-y">
          <li v-for="group in results" :key="group.name">
            <button
              type="button"
              class="hover:bg-accent flex w-full items-center gap-3 px-1 py-3 text-left"
              @click="selectName(group.name)"
            >
              <span
                :class="[
                  'flex size-10 shrink-0 items-center justify-center rounded-full font-serif text-sm font-medium',
                  group.dancers.some((d) => favorites.isFavoriteDancer(d.id))
                    ? 'bg-secondary text-secondary-foreground'
                    : 'bg-muted text-muted-foreground',
                ]"
              >
                {{ group.initials }}
              </span>
              <div class="min-w-0 flex-1">
                <div
                  class="font-serif truncate text-base font-medium tracking-tight"
                >
                  {{ group.name || '?' }}
                </div>
                <div
                  class="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase"
                >
                  <span class="tabular-nums">{{ group.dancers.length }}</span>
                  <span>{{ group.dancers.length === 1 ? 'comp' : 'comps' }}</span>
                </div>
              </div>
              <ChevronRight
                :class="[
                  'text-muted-foreground size-4 shrink-0 transition-transform',
                  selectedName === group.name ? 'rotate-90' : '',
                ]"
              />
            </button>

            <div
              v-if="selectedName === group.name"
              class="bg-muted/40 space-y-4 rounded-xl px-3 pt-3 pb-4 mb-3"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <RouterLink
                  :to="{ name: 'dancer.info', params: { dancerId: dancerSlug(group.name) } }"
                  class="bg-card hover:bg-accent inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
                >
                  View profile
                  <span
                    class="text-muted-foreground text-[10px] tracking-[0.14em] uppercase"
                    >(stub)</span
                  >
                  <ArrowRight class="size-3.5" />
                </RouterLink>
                <button
                  v-if="group.dancers.length > 1"
                  type="button"
                  class="bg-card hover:bg-accent inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
                  @click="favoriteAllSelected"
                >
                  <Star
                    :class="[
                      'size-3.5',
                      allSelectedFavorited
                        ? 'text-secondary fill-current'
                        : 'text-muted-foreground',
                    ]"
                  />
                  {{ allSelectedFavorited ? 'Unfavourite all' : 'Favourite all' }}
                </button>
              </div>

              <div
                v-for="comp in dancersByCompetition"
                :key="comp.competitionId"
                class="space-y-1.5"
              >
                <div
                  class="text-muted-foreground flex items-baseline gap-2 px-1 text-[10px] font-bold tracking-[0.14em] uppercase"
                >
                  <span class="truncate">
                    {{ comp.competition?.name ?? 'Loading…' }}
                  </span>
                  <span
                    v-if="comp.competition?.date"
                    class="text-muted-foreground/60 text-[10px] tabular-nums tracking-normal normal-case"
                  >
                    {{ formatShortDate(comp.competition.date) }}
                  </span>
                </div>
                <ul class="bg-card divide-y rounded-xl border">
                  <li v-for="dancer in comp.dancers" :key="dancer.id">
                    <RouterLink
                      :to="{
                        name: 'competition.dancer',
                        params: {
                          competitionId: dancer.competitionId,
                          dancerId: dancer.id,
                        },
                      }"
                      class="hover:bg-accent flex items-center gap-3 p-3"
                    >
                      <div
                        class="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full font-serif text-xs font-medium tabular-nums"
                      >
                        {{ dancer.number ?? '–' }}
                      </div>
                      <div class="min-w-0 flex-1">
                        <div
                          class="font-serif truncate text-sm font-medium tracking-tight"
                        >
                          {{ dancer.fullName || '?' }}
                        </div>
                        <div
                          v-if="dancer.location"
                          class="text-muted-foreground truncate text-xs"
                        >
                          {{ dancer.location }}
                        </div>
                      </div>
                      <Star
                        v-if="favorites.isFavoriteDancer(dancer.id)"
                        class="text-secondary size-4 shrink-0 fill-current"
                      />
                      <ChevronRight class="text-muted-foreground size-4 shrink-0" />
                    </RouterLink>
                  </li>
                </ul>
              </div>
            </div>
          </li>
        </ul>

        <div
          v-else-if="!q.trim()"
          class="text-muted-foreground font-serif text-sm italic"
        >
          Start typing to search.
        </div>
      </template>
    </main>
  </div>
</template>
