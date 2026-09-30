<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Search, X } from '@lucide/vue'
import { useRouter } from 'vue-router'
import FavoriteButton from '@/components/FavoriteButton.vue'
import Skeleton from '@/components/Skeleton.vue'
import AppBar from '@/components/nav/AppBar.vue'
import { sectionMeta } from '@/lib/sectionMeta'
import { focusVt } from '@/lib/viewTransitionFocus'
import {
  useEntityAggregates,
  type AggregateRow,
} from '@/composables/useEntityAggregates'
import { useRecentEntities } from '@/composables/useRecentEntities'
import { useScrolledPast } from '@/composables/useScrolledPast'
import { useFavoritesStore, type FavoriteType } from '@/stores/favorites'

// Generic alphabetical list of /{namespace} aggregates. Each entity's index
// page is a tiny wrapper around this — passes the namespace, route prefix,
// VT scope, and a `subtitleOf` mapper for whatever line lives under the name.

const props = defineProps<{
  /** RTDB namespace, e.g. 'judges'. Doubles as the section route name — page
   *  title + avatar icon are pulled from its title/icon meta. */
  namespace: string
  /** VT scope name used by the corresponding {Entity}Layout. */
  vtScope: string
  /** Route name prefix — `${routePrefix}.info` is the navigation target. */
  routePrefix: string
  /** Route param name passed to `params`, e.g. 'judgeId'. */
  idParam: string
  /** Returns the subtitle text for an aggregate row. */
  subtitleOf: (agg: AggregateRow) => string
  emptyMessage?: string
}>()

const router = useRouter()
const section = computed(() => sectionMeta(props.namespace))

const entry = useEntityAggregates(props.namespace)
const aggregates = entry.data
const loading = entry.loading
const error = entry.error

const favorites = useFavoritesStore()
const recent = useRecentEntities(props.namespace)

const query = ref('')
const sorted = computed(() => {
  const q = query.value.trim().toLowerCase()
  return [...aggregates.value]
    .filter((r) => !q || (r.agg.name ?? '').toLowerCase().includes(q))
    .sort((a, b) => (a.agg.name ?? '').localeCompare(b.agg.name ?? ''))
})

// A–Z sections with sticky letters: long lists stay scannable.
const letters = computed(() => {
  const map = new Map<string, typeof sorted.value>()
  for (const r of sorted.value) {
    const l = (r.agg.name ?? '?').trim().charAt(0).toUpperCase() || '?'
    map.set(l, [...(map.get(l) ?? []), r])
  }
  return [...map.entries()]
})

const aggCache = computed(() => new Map(aggregates.value.map((r) => [r.id, r.agg])))

// Favourites: cross-reference the slim cache for subtitle data; fall back to
// the denormed name stored alongside the favourite when the entity isn't in
// the cache yet (e.g. recently favourited but list still loading).
const favoriteRows = computed(() => {
  const map = favorites.byType(props.namespace as FavoriteType)
  const cache = aggCache.value
  return Object.entries(map)
    .filter(([, v]) => Boolean(v))
    .map(([id, v]) => ({
      id,
      agg: cache.get(id) ?? ({ name: typeof v === 'string' ? v : '' } as AggregateRow),
    }))
    .sort((a, b) => (a.agg.name ?? '').localeCompare(b.agg.name ?? ''))
})

// Recently viewed: filter out anything already starred so users don't see the
// same row twice in the top two sections.
const recentRows = computed(() => {
  const favIds = new Set(Object.keys(favorites.byType(props.namespace as FavoriteType)))
  const cache = aggCache.value
  return recent.recent.value
    .filter((r) => !favIds.has(r.id))
    .map((r) => ({
      id: r.id,
      agg: cache.get(r.id) ?? ({ name: r.name } as AggregateRow),
    }))
})


async function open(id: string, rowKey: string) {
  focusVt(props.vtScope, id, rowKey)
  await nextTick()
  router.push({ name: `${props.routePrefix}.info`, params: { [props.idParam]: id } })
}

const titleAnchor = ref<HTMLElement | null>(null)
const scrolledPastTitle = useScrolledPast(titleAnchor)
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar :title="section.label" :show-title="scrolledPastTitle" :fallback="{ to: { name: 'more' }, label: 'More' }" />

    <main class="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 pt-[calc(var(--chrome-top)+0.25rem)]">
      <header ref="titleAnchor" class="space-y-3">
        <h1 class="text-display">{{ section.label }}</h1>
        <label class="bg-card border-strong focus-within:border-primary flex h-12 items-center gap-2 rounded-xl border-2 px-3">
          <Search class="text-muted-foreground size-5 shrink-0" />
          <input
            v-model="query"
            type="search"
            autocomplete="off"
            :placeholder="`Find ${section.label.toLowerCase()} by name`"
            class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          <button v-if="query" type="button" class="text-muted-foreground -mr-1 flex size-10 items-center justify-center" aria-label="Clear" @click="query = ''">
            <X class="size-5" />
          </button>
        </label>
      </header>

      <p v-if="error" class="text-base font-semibold">This list didn’t load. Check your connection and try again.</p>

      <template v-else>
        <div v-if="loading" class="space-y-2" aria-busy="true">
          <Skeleton v-for="i in 6" :key="i" class="h-14 w-full rounded-xl!" />
        </div>

        <template v-if="!query">
          <section v-for="block in [
            { key: 'favourites', label: 'Following', rows: favoriteRows, clear: false },
            { key: 'recent', label: 'Recently viewed', rows: recentRows, clear: true },
          ]" v-show="block.rows.length" :key="block.key" class="space-y-2">
            <h2 class="text-heading flex items-baseline justify-between pt-1">
              {{ block.label }}
              <button v-if="block.clear" type="button" class="text-primary text-[0.9375rem] font-bold" @click="recent.clear()">Clear</button>
            </h2>
            <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
              <li v-for="row in block.rows" :key="row.id" class="flex items-center pr-1">
                <button type="button" class="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left" @click="open(row.id, block.key)">
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-base font-bold">{{ row.agg.name || '?' }}</span>
                    <span v-if="subtitleOf(row.agg)" class="text-muted-foreground block truncate text-sm">{{ subtitleOf(row.agg) }}</span>
                  </span>
                  </button>
                <FavoriteButton :id="row.id" :type="(props.namespace as FavoriteType)" :name="row.agg.name" class="mr-1" />
              </li>
            </ul>
          </section>
        </template>

        <p v-if="!loading && !sorted.length" class="text-muted-foreground py-4 text-center text-base">
          {{ query ? `No one matches “${query}”.` : emptyMessage || `No ${section.label.toLowerCase()} yet.` }}
        </p>

        <section v-if="sorted.length" class="space-y-1">
          <h2 class="text-heading flex items-baseline justify-between pt-1">
            {{ query ? 'Matches' : 'Everyone' }}
            <span class="text-muted-foreground text-sm font-semibold">{{ sorted.length }}</span>
          </h2>
          <div v-for="[letter, rows] in letters" :key="letter">
            <h3 class="bg-background text-muted-foreground sticky top-(--chrome-top) z-10 py-1.5 text-sm font-extrabold">{{ letter }}</h3>
            <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm [content-visibility:auto] [contain-intrinsic-size:auto_300px]">
              <li v-for="row in rows" :key="row.id" class="flex items-center pr-1">
                <button type="button" class="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left" @click="open(row.id, 'all')">
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-base font-bold">{{ row.agg.name || '?' }}</span>
                    <span v-if="subtitleOf(row.agg)" class="text-muted-foreground block truncate text-sm">{{ subtitleOf(row.agg) }}</span>
                  </span>
                  </button>
                <FavoriteButton :id="row.id" :type="(props.namespace as FavoriteType)" :name="row.agg.name" class="mr-1" />
              </li>
            </ul>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
