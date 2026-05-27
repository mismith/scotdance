<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { refDebounced } from '@vueuse/core'
import { ChevronRight, Search, Star, X } from '@lucide/vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import { useFavoritesStore } from '@/stores/favorites'
import { useDancersStore } from '@/stores/dancers'
import { useRecentDancers } from '@/composables/useRecentDancers'
import { useScrolledPast } from '@/composables/useScrolledPast'
import AccountAvatarButton from '@/components/AccountAvatarButton.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import Skeleton from '@/components/Skeleton.vue'
import TopBackButton from '@/components/nav/TopBackButton.vue'
import { initialsOf } from '@/lib/format'
import { lookupEntityId } from '@/lib/entityIndex'
import { useEntityIdMap } from '@/composables/useEntityIdMap'
import { focusVt, useVtScope } from '@/lib/viewTransitionFocus'

const route = useRoute()
const router = useRouter()
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

watch(qDebounced, (value) => dancers.search(value), { immediate: true })

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

function locationOf(group: { location?: string }) {
  return group.location ?? ''
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
const dancerIds = useEntityIdMap('dancers')

// Pre-resolve IDs for visible rows so view-transition names are ready by the
// time the user clicks.
watch(results, (list) => list.forEach((g: { name: string }) => dancerIds.resolve(g.name)))
watch(favoriteEntries, (list) => list.forEach((e) => dancerIds.resolve(e.name)))

async function navigateToDancer(id: string) {
  focusVt('dancer', id)
  await nextTick()
  router.push({ name: 'dancer.info', params: { dancerId: id } })
}

async function openDancer(name: string) {
  const id = dancerIds.get(name) ?? (await lookupEntityId('dancers', name))
  if (!id) return
  dancerIds.map[name] = id
  await navigateToDancer(id)
}

async function openDancerById(id: string) {
  await navigateToDancer(id)
}

const titleAnchor = ref<HTMLElement | null>(null)
const scrolledPastTitle = useScrolledPast(titleAnchor)

const queryPreview = computed(() => q.value.trim())

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1rem)]">
    <nav class="pointer-events-none fixed inset-x-0 top-0 z-30 px-4 pt-(--nav-top)">
      <div class="mx-auto flex h-12 max-w-3xl items-center gap-2">
        <TopBackButton />
        <div class="min-w-0 flex-1">
          <Transition
            enter-active-class="transition ease-rubber-band"
            enter-from-class="-translate-y-full opacity-0"
            leave-active-class="transition ease-out"
            leave-to-class="-translate-y-full opacity-0"
          >
            <button
              v-if="scrolledPastTitle"
              type="button"
              class="floating-nav pointer-events-auto flex h-12 w-full items-center rounded-full px-5 text-left hover:opacity-90"
              @click="scrollToTop"
            >
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate font-serif text-lg leading-none font-medium tracking-tight"
                >
                  Dancers
                </span>
                <span
                  v-if="queryPreview"
                  class="mt-1 block truncate font-serif text-xs leading-none opacity-70"
                >
                  {{ queryPreview }}
                </span>
              </span>
            </button>
          </Transition>
        </div>
        <AccountAvatarButton />
      </div>
    </nav>
    <main class="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 pt-[calc(var(--chrome-top)+1rem)] pb-4">
      <header ref="titleAnchor" class="space-y-3">
        <h1 class="text-title">Dancers</h1>
        <div
          class="floating-nav flex h-12 items-center gap-3 rounded-full px-4"
        >
          <Search class="size-4 shrink-0 opacity-70" />
          <input
            v-model="q"
            type="search"
            placeholder="Search by name…"
            class="placeholder:text-card-foreground/55 min-w-0 flex-1 bg-transparent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          <button
            v-if="q"
            type="button"
            class="text-card-foreground/70 hover:text-card-foreground -mr-1 rounded-full p-1"
            title="Clear"
            @click="clearSearch"
          >
            <X class="size-4" />
          </button>
        </div>
      </header>

      <template v-if="showSearch">
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
              <button
                type="button"
                class="flex w-full items-center gap-3 px-1 py-3 text-left"
                @click="openDancer(group.name)"
              >
                <span
                  class="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-medium [view-transition-class:nav-avatar]"
                  :style="{ viewTransitionName: vt.name(dancerIds.get(group.name), 'avatar') }"
                >
                  {{ group.initials }}
                </span>
                <div class="min-w-0 flex-1">
                  <div
                    class="text-item-title truncate [view-transition-class:fit_nav-title]"
                    :style="{ viewTransitionName: vt.name(dancerIds.get(group.name), 'name') }"
                  >{{ group.name || '?' }}</div>
                  <div
                    v-if="locationOf(group)"
                    class="text-item-subtitle text-muted-foreground truncate"
                  >
                    {{ locationOf(group) }}
                  </div>
                </div>
                <ChevronRight class="text-muted-foreground size-4 shrink-0" />
              </button>
            </li>
          </ul>
        </section>
      </template>

      <template v-else>
        <section v-if="favoriteEntries.length" class="space-y-2">
          <SectionHeader label="Favourites" :count="favoriteEntries.length" />
          <ul>
            <li v-for="entry in favoriteEntries" :key="entry.name" class="flex items-center">
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-3 px-1 py-3 text-left"
                @click="openDancer(entry.name)"
              >
                <span
                  class="bg-secondary text-secondary-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-medium [view-transition-class:nav-avatar]"
                  :style="{ viewTransitionName: vt.name(dancerIds.get(entry.name), 'avatar') }"
                >
                  {{ entry.initials }}
                </span>
                <div class="min-w-0 flex-1">
                  <div
                    class="text-item-title truncate [view-transition-class:fit_nav-title]"
                    :style="{ viewTransitionName: vt.name(dancerIds.get(entry.name), 'name') }"
                  >{{ entry.name }}</div>
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
              </button>
              <FavoriteButton
                v-if="dancerIds.get(entry.name)"
                type="dancers"
                :id="dancerIds.get(entry.name) || ''"
                :name="entry.name"
                class="mr-1"
              />
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
          <SectionHeader label="Recently viewed">
            <button
              type="button"
              class="hover:text-foreground font-normal tracking-normal normal-case"
              @click="recentDancers.clear()"
            >
              Clear
            </button>
          </SectionHeader>
          <ul>
            <li v-for="entry in recentList" :key="entry.id" class="flex items-center">
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-3 px-1 py-3 text-left"
                @click="openDancerById(entry.id)"
              >
                <span
                  class="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-medium [view-transition-class:nav-avatar]"
                  :style="{ viewTransitionName: vt.name(entry.id, 'avatar') }"
                >
                  {{ initialsOf(entry.name) }}
                </span>
                <div class="min-w-0 flex-1">
                  <div
                    class="text-item-title truncate [view-transition-class:fit_nav-title]"
                    :style="{ viewTransitionName: vt.name(entry.id, 'name') }"
                  >{{ entry.name }}</div>
                </div>
              </button>
              <FavoriteButton
                type="dancers"
                :id="entry.id"
                :name="entry.name"
                class="mr-1"
              />
            </li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>
