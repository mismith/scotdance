<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { refDebounced } from '@vueuse/core'
import { ChevronRight, Loader2, Search, Star, X } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'
import { useRecentDancers } from '@/composables/useRecentDancers'
import SectionHeader from '@/components/SectionHeader.vue'
import { searchDancers, type SearchDancerGroup } from '@/lib/searchDancers'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const favorites = useFavoritesStore()
const recentDancers = useRecentDancers()

const q = ref(String(route.query.q ?? ''))
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

watch(q, (value) => {
  if (value !== String(route.query.q ?? '')) {
    router.replace({ query: { ...route.query, q: value || undefined } })
  }
})

watch(
  [qDebounced, () => auth.isSignedIn],
  async ([value, signedIn]) => {
    if (!signedIn || !value.trim()) {
      results.value = []
      return
    }
    searching.value = true
    error.value = null
    try {
      results.value = await searchDancers(value)
    } catch (e) {
      error.value = e as Error
      results.value = []
    } finally {
      searching.value = false
    }
  },
  { immediate: true },
)

interface FavoriteEntry {
  name: string
  initials: string
  count: number
}

const favoriteEntries = computed<FavoriteEntry[]>(() => {
  const grouped = new Map<string, number>()
  for (const value of Object.values(favorites.dancers)) {
    if (!value) continue
    const name = typeof value === 'string' ? value.trim() : '?'
    if (!name) continue
    grouped.set(name, (grouped.get(name) ?? 0) + 1)
  }
  return [...grouped.entries()]
    .map<FavoriteEntry>(([name, count]) => {
      const parts = name.split(/\s+/).filter(Boolean)
      const first = parts[0]?.charAt(0).toUpperCase() ?? '?'
      const last = parts.length > 1 ? parts.at(-1)!.charAt(0).toUpperCase() : ''
      return { name, initials: `${first}${last}` || '?', count }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
})

const locationByName = shallowRef(new Map<string, string>())

watch(
  favoriteEntries,
  async (entries) => {
    const todo = entries.filter((e) => !locationByName.value.has(e.name))
    if (!todo.length) return
    const results = await Promise.all(
      todo.map(async (e) => {
        try {
          const groups = await searchDancers(e.name)
          const match =
            groups.find((g) => g.name.toLowerCase() === e.name.toLowerCase()) ?? groups[0]
          const loc = match?.dancers.find((d) => d.location)?.location ?? ''
          return [e.name, loc] as const
        } catch {
          return [e.name, ''] as const
        }
      }),
    )
    const next = new Map(locationByName.value)
    for (const [name, loc] of results) next.set(name, loc)
    locationByName.value = next
  },
  { immediate: true },
)

function dancerSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function initialsOf(name: string) {
  const parts = name.split(/\s+/).filter(Boolean)
  const first = parts[0]?.charAt(0).toUpperCase() ?? '?'
  const last = parts.length > 1 ? parts.at(-1)!.charAt(0).toUpperCase() : ''
  return `${first}${last}` || '?'
}

const recentList = computed(() => {
  const favoriteNames = new Set(favoriteEntries.value.map((e) => e.name))
  return recentDancers.recent.value.filter((r) => !favoriteNames.has(r.name))
})

function clearSearch() {
  q.value = ''
}

const showSearch = computed(() => q.value.trim().length > 0)
</script>

<template>
  <div class="flex flex-1 flex-col">
    <header
      class="bg-background sticky top-0 z-20 mx-auto w-full max-w-3xl p-4 pt-safe pb-3"
    >
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
        <p class="font-serif text-base">
          Sign in to find and follow dancers across comps.
        </p>
        <button
          type="button"
          class="bg-primary text-primary-foreground inline-flex items-center rounded-full px-5 py-2 text-sm font-medium hover:opacity-90"
          @click="auth.openLogin"
        >
          Sign in
        </button>
      </div>

      <template v-else-if="showSearch">
        <div v-if="error" class="text-destructive text-sm">{{ error.message }}</div>

        <div
          v-if="searching"
          class="text-muted-foreground flex items-center gap-2 font-serif text-sm italic"
        >
          <Loader2 class="size-4 animate-spin" />
          Searching…
        </div>

        <div
          v-else-if="!results.length"
          class="text-muted-foreground font-serif text-sm italic"
        >
          No dancers match.
        </div>

        <ul v-else class="divide-y border-y">
          <li v-for="group in results" :key="group.name">
            <RouterLink
              :to="{
                name: 'dancer.info',
                params: { dancerId: dancerSlug(group.name) },
              }"
              class="hover:bg-accent flex w-full items-center gap-3 px-1 py-3 text-left"
            >
              <span
                class="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full font-serif text-sm font-medium"
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
              <ChevronRight class="text-muted-foreground size-4 shrink-0" />
            </RouterLink>
          </li>
        </ul>
      </template>

      <template v-else>
        <section v-if="favoriteEntries.length" class="space-y-2">
          <SectionHeader label="Favourites" :count="favoriteEntries.length" />
          <ul>
            <li v-for="entry in favoriteEntries" :key="entry.name">
              <RouterLink
                :to="{
                  name: 'dancer.info',
                  params: { dancerId: dancerSlug(entry.name) },
                }"
                class="hover:bg-accent flex w-full items-center gap-3 px-1 py-3 text-left"
              >
                <span
                  class="bg-secondary text-secondary-foreground flex size-10 shrink-0 items-center justify-center rounded-full font-serif text-sm font-medium"
                >
                  {{ entry.initials }}
                </span>
                <div class="min-w-0 flex-1">
                  <div
                    class="font-serif truncate text-base font-medium tracking-tight"
                  >
                    {{ entry.name }}
                  </div>
                  <div
                    v-if="locationByName.get(entry.name)"
                    class="text-muted-foreground font-serif truncate text-[11px] italic"
                  >
                    {{ locationByName.get(entry.name) }}
                  </div>
                </div>
                <ChevronRight class="text-muted-foreground size-4 shrink-0" />
              </RouterLink>
            </li>
          </ul>
        </section>

        <section v-else-if="!recentList.length"
          class="bg-card space-y-3 rounded-2xl border p-6 text-center"
        >
          <Star class="text-muted-foreground mx-auto size-6" />
          <div class="font-serif text-base font-medium tracking-tight">
            Follow your dancers here
          </div>
          <p class="text-muted-foreground text-sm">
            Star a dancer in any comp and they'll show up across every comp they're
            entered in. Type a name above to start.
          </p>
        </section>

        <section v-if="recentList.length" class="space-y-2">
          <SectionHeader label="Recently viewed" :count="recentList.length">
            <button
              type="button"
              class="hover:text-foreground tracking-normal normal-case text-[11px] font-normal"
              @click="recentDancers.clear()"
            >
              Clear
            </button>
          </SectionHeader>
          <ul>
            <li v-for="entry in recentList" :key="entry.slug">
              <RouterLink
                :to="{ name: 'dancer.info', params: { dancerId: entry.slug } }"
                class="hover:bg-accent flex w-full items-center gap-3 px-1 py-3 text-left"
              >
                <span
                  class="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full font-serif text-sm font-medium"
                >
                  {{ initialsOf(entry.name) }}
                </span>
                <div class="min-w-0 flex-1">
                  <div
                    class="font-serif truncate text-base font-medium tracking-tight"
                  >
                    {{ entry.name }}
                  </div>
                </div>
                <ChevronRight class="text-muted-foreground size-4 shrink-0" />
              </RouterLink>
            </li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>
