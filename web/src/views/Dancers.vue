<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { refDebounced } from '@vueuse/core'
import { ChevronRight, Search, Star, X } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'
import { useDancersStore } from '@/stores/dancers'
import { useRecentDancers } from '@/composables/useRecentDancers'
import AccountAvatarButton from '@/components/AccountAvatarButton.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import Skeleton from '@/components/Skeleton.vue'
import { initialsOf } from '@/lib/format'
import type { SearchDancerGroup } from '@/lib/searchDancers'
import { useVtScope } from '@/lib/viewTransitionFocus'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const favorites = useFavoritesStore()
const dancers = useDancersStore()
const recentDancers = useRecentDancers()

const { results, searching, searchError: error, locationByName } = storeToRefs(dancers)

const q = ref(String(route.query.q ?? ''))
const qDebounced = refDebounced(q, 250)

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
  ([value, signedIn]) => {
    if (!signedIn) {
      dancers.reset()
      return
    }
    dancers.search(value)
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
    if (typeof value !== 'string') continue
    const name = value.trim()
    if (!name) continue
    grouped.set(name, (grouped.get(name) ?? 0) + 1)
  }
  return [...grouped.entries()]
    .map<FavoriteEntry>(([name, count]) => ({ name, initials: initialsOf(name), count }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

watch(
  favoriteEntries,
  (entries) => {
    dancers.resolveLocations(entries.map((e) => e.name))
  },
  { immediate: true },
)

function dancerSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function locationOf(group: SearchDancerGroup) {
  return group.dancers.find((d) => d.location)?.location ?? ''
}

const recentList = computed(() => {
  const favoriteNames = new Set(favoriteEntries.value.map((e) => e.name))
  return recentDancers.recent.value.filter((r) => !favoriteNames.has(r.name))
})

function clearSearch() {
  q.value = ''
}

const showSearch = computed(() => q.value.trim().length > 0)

const vt = useVtScope('dancer')
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1rem)]">
    <main class="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4">
      <div class="flex items-center gap-2">
        <div
          class="bg-card flex h-12 flex-1 items-center gap-3 rounded-full border px-4 shadow-sm"
        >
          <Search class="text-muted-foreground size-4 shrink-0" />
          <input
            v-model="q"
            type="search"
            placeholder="Search by name…"
            :disabled="!auth.isSignedIn"
            class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent focus:outline-none disabled:opacity-50 [&::-webkit-search-cancel-button]:hidden"
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
        <AccountAvatarButton />
      </div>

      <div
        v-if="!auth.isSignedIn"
        class="bg-card space-y-3 rounded-2xl border p-6 text-center"
      >
        <p class="text-xl">
          Sign in to find and follow dancers across comps.
        </p>
        <button
          type="button"
          class="bg-primary text-primary-foreground inline-flex items-center rounded-full px-4 py-2 font-medium hover:opacity-90"
          @click="auth.openLogin"
        >
          Sign in
        </button>
      </div>

      <template v-else-if="showSearch">
        <div v-if="error" class="text-destructive text-lg">{{ error.message }}</div>

        <div
          v-if="searching"
          class="space-y-3"
          aria-busy="true"
          aria-live="polite"
        >
          <span class="sr-only">Searching dancers…</span>
          <div v-for="i in 4" :key="i" class="flex items-center gap-3 py-3">
            <Skeleton class="size-9 shrink-0 rounded-full!" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-5 w-2/3" />
              <Skeleton class="h-4 w-1/3" />
            </div>
          </div>
        </div>

        <div
          v-else-if="!results.length"
          class="text-muted-foreground text-lg italic"
        >
          No dancers match.
        </div>

        <section v-else class="space-y-2">
          <SectionHeader label="Results" :count="results.length" />
          <ul>
            <li v-for="group in results" :key="group.name">
              <RouterLink
                v-slot="{ href, navigate }"
                :to="{
                  name: 'dancer.info',
                  params: { dancerId: dancerSlug(group.name) },
                }"
                custom
              >
                <a
                  :href="href"
                  class="flex w-full items-center gap-3 px-1 py-3 text-left"
                  @click="vt.onNavigate($event, navigate, dancerSlug(group.name))"
                >
                  <span
                    class="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-medium [view-transition-class:nav-avatar]"
                    :style="{ viewTransitionName: vt.name(dancerSlug(group.name), 'avatar') }"
                  >
                    {{ group.initials }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div
                      class="text-item-title truncate [view-transition-class:fit_nav-title]"
                      :style="{ viewTransitionName: vt.name(dancerSlug(group.name), 'name') }"
                    >
                      {{ group.name || '?' }}
                    </div>
                    <div
                      v-if="locationOf(group)"
                      class="text-item-subtitle text-muted-foreground truncate"
                    >
                      {{ locationOf(group) }}
                    </div>
                  </div>
                  <ChevronRight class="text-muted-foreground size-4 shrink-0" />
                </a>
              </RouterLink>
            </li>
          </ul>
        </section>
      </template>

      <template v-else>
        <section v-if="favoriteEntries.length" class="space-y-2">
          <SectionHeader label="Favourites" :count="favoriteEntries.length" />
          <ul>
            <li v-for="entry in favoriteEntries" :key="entry.name">
              <RouterLink
                v-slot="{ href, navigate }"
                :to="{
                  name: 'dancer.info',
                  params: { dancerId: dancerSlug(entry.name) },
                }"
                custom
              >
                <a
                  :href="href"
                  class="flex w-full items-center gap-3 px-1 py-3 text-left"
                  @click="vt.onNavigate($event, navigate, dancerSlug(entry.name))"
                >
                  <span
                    class="bg-secondary text-secondary-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-medium [view-transition-class:nav-avatar]"
                    :style="{ viewTransitionName: vt.name(dancerSlug(entry.name), 'avatar') }"
                  >
                    {{ entry.initials }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div
                      class="text-item-title truncate [view-transition-class:fit_nav-title]"
                      :style="{ viewTransitionName: vt.name(dancerSlug(entry.name), 'name') }"
                    >
                      {{ entry.name }}
                    </div>
                    <div
                      v-if="locationByName.get(entry.name)"
                      class="text-item-subtitle text-muted-foreground truncate"
                    >
                      {{ locationByName.get(entry.name) }}
                    </div>
                    <Skeleton
                      v-else-if="!locationByName.has(entry.name)"
                      class="mt-1 h-4 w-32"
                    />
                  </div>
                  <ChevronRight class="text-muted-foreground size-4 shrink-0" />
                </a>
              </RouterLink>
            </li>
          </ul>
        </section>

        <section
          v-else-if="!recentList.length"
          class="bg-card space-y-3 rounded-2xl border p-6 text-center"
        >
          <Star class="text-muted-foreground mx-auto size-6" />
          <div class="text-xl font-medium tracking-tight">
            Follow your dancers here
          </div>
          <p class="text-muted-foreground text-lg">
            Star a dancer in any comp and they'll show up across every comp they're
            entered in. Type a name above to start.
          </p>
        </section>

        <section v-if="recentList.length" class="space-y-2">
          <SectionHeader label="Recently viewed" :count="recentList.length">
            <button
              type="button"
              class="hover:text-foreground font-normal tracking-normal normal-case"
              @click="recentDancers.clear()"
            >
              Clear
            </button>
          </SectionHeader>
          <ul>
            <li v-for="entry in recentList" :key="entry.slug">
              <RouterLink
                v-slot="{ href, navigate }"
                :to="{ name: 'dancer.info', params: { dancerId: entry.slug } }"
                custom
              >
                <a
                  :href="href"
                  class="flex w-full items-center gap-3 px-1 py-3 text-left"
                  @click="vt.onNavigate($event, navigate, entry.slug)"
                >
                  <span
                    class="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-medium [view-transition-class:nav-avatar]"
                    :style="{ viewTransitionName: vt.name(entry.slug, 'avatar') }"
                  >
                    {{ initialsOf(entry.name) }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div
                      class="text-item-title truncate [view-transition-class:fit_nav-title]"
                      :style="{ viewTransitionName: vt.name(entry.slug, 'name') }"
                    >
                      {{ entry.name }}
                    </div>
                  </div>
                  <ChevronRight class="text-muted-foreground size-4 shrink-0" />
                </a>
              </RouterLink>
            </li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>
