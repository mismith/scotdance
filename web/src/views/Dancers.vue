<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { refDebounced } from '@vueuse/core'
import { ChevronRight, Search, X } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import FollowButton from '@/components/FollowButton.vue'
import Skeleton from '@/components/Skeleton.vue'
import { useDancersStore } from '@/stores/dancers'
import { useFavoritesStore } from '@/stores/favorites'
import { useFollowing } from '@/composables/useFollowing'
import { useRecentDancers } from '@/composables/useRecentDancers'
import { useScrolledPast } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import { initialsOf } from '@/lib/format'
import { lookupEntityId } from '@/lib/entityIndex'

// Everyone you follow, in one list you can manage (a teacher might follow a
// whole class), plus search and recently viewed. Following is by person, so
// these link straight to each dancer's page.
usePageTitle(['Dancers'])

const route = useRoute()
const router = useRouter()
const favorites = useFavoritesStore()
const following = useFollowing()
const store = useDancersStore()
const { recent, clear: clearRecent } = useRecentDancers()
const { results, searching, searchError } = storeToRefs(store)

const titleEl = ref<HTMLElement | null>(null)
const scrolledPast = useScrolledPast(titleEl)

const q = ref(String(route.query.q ?? ''))
const qDebounced = refDebounced(q, 250)
watch(q, (v) => router.replace({ query: { ...route.query, q: v || undefined } }))
watch(qDebounced, (v) => store.search(v), { immediate: true })

const followed = computed(() =>
  Object.entries(favorites.dancers)
    .map(([id, v]) => ({ id, name: typeof v === 'string' && v ? v : 'Dancer' }))
    .sort((a, b) => a.name.localeCompare(b.name)),
)
const recentList = computed(() => recent.value.filter((r) => !favorites.isFavorite('dancers', r.id)).slice(0, 8))

async function openByName(name: string) {
  const id = await lookupEntityId('dancers', name)
  if (id) router.push({ name: 'dancer.info', params: { dancerId: id } })
}
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar title="Dancers" :show-title="scrolledPast" :fallback="{ to: { name: 'home' }, label: 'Home' }" />

    <main class="mx-auto w-full max-w-3xl space-y-4 px-4 pt-[calc(var(--chrome-top)+0.25rem)]">
      <header ref="titleEl" class="space-y-3">
        <h1 class="text-display">Dancers</h1>
        <label class="bg-card border-strong focus-within:border-primary flex h-12 items-center gap-2 rounded-xl border-2 px-3">
          <Search class="text-muted-foreground size-5 shrink-0" />
          <input
            v-model="q"
            type="search"
            autocomplete="off"
            placeholder="Find a dancer by name"
            class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none"
          />
          <button v-if="q" type="button" class="text-muted-foreground -mr-1 flex size-10 items-center justify-center" aria-label="Clear" @click="q = ''">
            <X class="size-5" />
          </button>
        </label>
      </header>

      <!-- Search -->
      <template v-if="q.trim()">
        <div v-if="searching && !results.length" class="space-y-2">
          <Skeleton v-for="i in 4" :key="i" class="h-14 w-full rounded-xl!" />
        </div>
        <p v-else-if="searchError" class="text-base font-semibold">Search isn’t working right now. Check your connection.</p>
        <p v-else-if="!results.length" class="text-muted-foreground py-4 text-center text-base">
          No dancer matches “{{ q }}”. Try just a first or last name.
        </p>
        <ul v-else class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
          <li v-for="g in results" :key="g.name">
            <button type="button" class="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent" @click="openByName(g.name)">
              <span class="bg-blue-paper text-primary flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold">{{ initialsOf(g.name) }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-base font-bold">{{ g.name }}</span>
                <span class="text-muted-foreground block truncate text-sm">
                  {{ [g.location, `${g.competitionIds.length} competition${g.competitionIds.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ') }}
                </span>
              </span>
              <ChevronRight class="text-muted-foreground size-5" />
            </button>
          </li>
        </ul>
      </template>

      <template v-else>
        <section class="space-y-2">
          <h2 class="text-heading flex items-baseline justify-between pt-1">
            Following <span class="text-muted-foreground text-sm font-semibold">{{ followed.length }}</span>
          </h2>
          <p v-if="!followed.length" class="bg-card text-muted-foreground rounded-2xl border p-4 text-base shadow-sm">
            Search for a dancer above, then tap Follow. Everyone you follow shows up here and on Home.
          </p>
          <ul v-else class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
            <li
              v-for="d in followed"
              :key="d.id"
              class="relative flex items-center gap-2 pr-2"
              :style="following.paint(d.id)"
            >
              <span class="sash absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
              <RouterLink :to="{ name: 'dancer.info', params: { dancerId: d.id } }" class="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pl-4">
                <span class="min-w-0 flex-1 truncate text-base font-bold">{{ d.name }}</span>
              </RouterLink>
              <FollowButton :dancer="{ dancerId: d.id, fullName: d.name }" />
            </li>
          </ul>
        </section>

        <section v-if="recentList.length" class="space-y-2">
          <h2 class="text-heading flex min-h-6 items-center justify-between pt-1">
            Recently viewed
            <button
              type="button"
              aria-label="Clear recently viewed"
              class="text-primary -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-[0.9375rem] font-bold"
              @click="clearRecent()"
            >
              Clear
            </button>
          </h2>
          <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
            <li v-for="r in recentList" :key="r.id" class="flex items-center gap-2 pr-2">
              <RouterLink :to="{ name: 'dancer.info', params: { dancerId: r.id } }" class="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pl-4">
                <span class="min-w-0 flex-1 truncate text-base font-bold">{{ r.name }}</span>
              </RouterLink>
              <FollowButton :dancer="{ dancerId: r.id, fullName: r.name }" />
            </li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>
