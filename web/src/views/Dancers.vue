<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { refDebounced } from '@vueuse/core'
import { ChevronRight, CloudOff, LoaderCircle, Search, SearchX, X } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import Button from '@/components/ui/Button.vue'
import Avatar from '@/components/Avatar.vue'
import EmptyState from '@/components/EmptyState.vue'
import FollowButton from '@/components/FollowButton.vue'
import Skeleton from '@/components/Skeleton.vue'
import { useDancersStore } from '@/stores/dancers'
import { useFavoritesStore } from '@/stores/favorites'
import { useFollowing } from '@/composables/useFollowing'
import { useRecentDancers } from '@/composables/useRecentDancers'
import { useScrolledPast } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import { lookupEntityId } from '@/lib/entityIndex'
import { settle } from '@/lib/settle'

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

// Search finds dancers by name; their pages go by id. Look each up as the
// results arrive, so rows are real links by the time they're tapped; one
// tapped sooner holds its press and spins until it can go.
const ids = ref<Record<string, string | null>>({})
watch(results, (list) => {
  for (const g of list) {
    if (g.name in ids.value) continue
    void lookupEntityId('dancers', g.name).then((id) => (ids.value = { ...ids.value, [g.name]: id }))
  }
})
const opening = ref<string | null>(null)
async function openLate(name: string) {
  opening.value = name
  const id = await lookupEntityId('dancers', name)
  if (opening.value !== name) return
  opening.value = null
  if (id) router.push({ name: 'dancer.info', params: { dancerId: id } })
}
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar title="Dancers" :show-title="scrolledPast" :fallback="{ to: { name: 'home' }, label: 'Home' }" />

    <main class="mx-auto w-full max-w-3xl space-y-4 px-4 pt-[calc(var(--chrome-top)+0.25rem)]">
      <header ref="titleEl" class="space-y-3">
        <h1 class="text-display">Dancers</h1>
        <label class="field flex h-12 items-center gap-2 rounded-xl pr-1 pl-3">
          <Search class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
          <input
            v-model="q"
            type="search"
            autocomplete="off"
            placeholder="Find a dancer by name"
            aria-label="Search dancers"
            class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none"
          />
          <button
            v-if="q"
            type="button"
            class="text-muted-foreground press flex size-11 shrink-0 items-center justify-center rounded-full"
            aria-label="Clear"
            @click="q = ''"
          >
            <X class="size-5" />
          </button>
        </label>
      </header>

      <!-- Search -->
      <template v-if="q.trim()">
        <div v-if="searching && !results.length" class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]" aria-busy="true">
          <span class="sr-only">Searching…</span>
          <div v-for="i in 4" :key="i" class="flex min-h-16 items-center gap-3 py-2 pl-4">
            <Skeleton class="size-10 shrink-0 rounded-full!" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-4 w-1/2" />
              <Skeleton class="h-3.5 w-1/3" />
            </div>
          </div>
        </div>
        <EmptyState
          v-else-if="searchError"
          size="inline"
          :icon="CloudOff"
          title="Search isn’t working right now"
          description="Check your connection, then try again."
        >
          <Button variant="primary" @click="store.search(q)">Try again</Button>
        </EmptyState>
        <EmptyState
          v-else-if="!results.length"
          size="inline"
          :icon="SearchX"
          :title="`No dancer matches “${q.trim()}”.`"
          description="Try just a first or last name."
        />
        <ul v-else :class="['surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]', settle]">
          <li v-for="g in results" :key="g.name">
            <component
              :is="ids[g.name] ? RouterLink : 'button'"
              :to="ids[g.name] ? { name: 'dancer.info', params: { dancerId: ids[g.name] } } : undefined"
              :type="ids[g.name] ? undefined : 'button'"
              :data-tapping="opening === g.name || undefined"
              class="press-row focus-inset flex min-h-16 w-full items-center gap-3 py-2 pr-3 pl-4 text-left"
              @click="!ids[g.name] && openLate(g.name)"
            >
              <span class="flex w-11 shrink-0 justify-center">
                <Avatar :name="g.name" :color="following.colorFor(ids[g.name])" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-base font-semibold">{{ g.name }}</span>
                <span class="text-muted-foreground block truncate text-sm">
                  {{ [g.location, `${g.competitionIds.length} competition${g.competitionIds.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ') }}
                </span>
              </span>
              <LoaderCircle v-if="opening === g.name" class="text-muted-foreground size-5 shrink-0 animate-spin" aria-hidden="true" />
              <ChevronRight v-else class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
            </component>
          </li>
        </ul>
      </template>

      <template v-else>
        <section class="space-y-2">
          <h2 class="text-heading flex items-baseline justify-between">
            Following <span class="text-muted-foreground text-sm font-normal tabular-nums">{{ followed.length }}</span>
          </h2>
          <EmptyState
            v-if="!followed.length"
            size="inline"
            scott
            class="surface rounded-2xl"
            title="Follow your dancers"
            description="Search for a dancer above, open their page and tap Follow. Everyone you follow shows up here and on Home."
          />
          <ul v-else :class="['surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]', settle]">
            <li v-for="d in followed" :key="d.id" class="flex items-center pr-1">
              <RouterLink
                :to="{ name: 'dancer.info', params: { dancerId: d.id } }"
                class="press-row focus-inset flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 pl-4"
              >
                <span class="flex w-11 shrink-0 justify-center">
                  <Avatar :name="d.name" :color="following.colorFor(d.id)" />
                </span>
                <span class="min-w-0 flex-1 truncate text-base font-semibold">{{ d.name }}</span>
              </RouterLink>
              <FollowButton :dancer="{ dancerId: d.id, fullName: d.name }" />
            </li>
          </ul>
        </section>

        <section v-if="recentList.length" class="space-y-2">
          <h2 class="text-heading flex min-h-6 items-center justify-between">
            Recently viewed
            <button
              type="button"
              aria-label="Clear recently viewed"
              class="text-primary press -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-callout font-semibold"
              @click="clearRecent()"
            >
              Clear
            </button>
          </h2>
          <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
            <li v-for="r in recentList" :key="r.id" class="flex items-center pr-1">
              <RouterLink
                :to="{ name: 'dancer.info', params: { dancerId: r.id } }"
                class="press-row focus-inset flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 pl-4"
              >
                <span class="flex w-11 shrink-0 justify-center">
                  <Avatar :name="r.name" />
                </span>
                <span class="min-w-0 flex-1 truncate text-base font-semibold">{{ r.name }}</span>
              </RouterLink>
              <FollowButton :dancer="{ dancerId: r.id, fullName: r.name }" />
            </li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>
