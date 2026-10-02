<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { CloudOff, Search, SearchX, X } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import Avatar from '@/components/Avatar.vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import Skeleton from '@/components/Skeleton.vue'
import AppBar from '@/components/nav/AppBar.vue'
import { sectionMeta } from '@/lib/sectionMeta'
import { selectionHaptic } from '@/lib/haptics'
import { settle } from '@/lib/settle'
import { useVtScope } from '@/lib/viewTransitionFocus'
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
// One list; a long one gets letter headings and an A–Z strip to jump with.

const props = withDefaults(
  defineProps<{
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
    /** In the search field, e.g. "Find a judge by name". */
    placeholder: string
    /** Places, not people: an icon instead of initials, and "Nothing" not "No one". */
    places?: Component
    emptyMessage?: string
  }>(),
  { places: undefined, emptyMessage: undefined },
)

const section = computed(() => sectionMeta(props.namespace))

const entry = useEntityAggregates(props.namespace)
const aggregates = entry.data
const loading = entry.loading
const error = entry.error
// A list that didn't load loads again when asked for again.
const retry = () => useEntityAggregates(props.namespace)

const favorites = useFavoritesStore()
const recent = useRecentEntities(props.namespace)
const vt = useVtScope(props.vtScope)

const query = ref('')
const sorted = computed(() => {
  const q = query.value.trim().toLowerCase()
  return [...aggregates.value]
    .filter((r) => !q || (r.agg.name ?? '').toLowerCase().includes(q))
    .sort((a, b) => (a.agg.name ?? '').localeCompare(b.agg.name ?? ''))
})

// "Ó Briain" files under O, beside the other O names.
const letterOf = (name: string | undefined) => (name ?? '?').trim().normalize('NFD').charAt(0).toUpperCase() || '?'

// Letter headings (and the A–Z strip) only once a list is long enough to
// need them.
const LETTERS_FROM = 30
const lettered = computed(() => !query.value.trim() && sorted.value.length > LETTERS_FROM)
const rows = computed(() => {
  const out: Array<{ letter: string } | { row: (typeof sorted.value)[number] }> = []
  let last = ''
  for (const r of sorted.value) {
    const l = letterOf(r.agg.name)
    if (lettered.value && l !== last) out.push({ letter: l })
    last = l
    out.push({ row: r })
  }
  return out
})
const letters = computed(() => rows.value.flatMap((x) => ('letter' in x ? [x.letter] : [])))

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

const to = (id: string) => ({ name: `${props.routePrefix}.info`, params: { [props.idParam]: id } })
const imageOf = (agg: AggregateRow) => (typeof agg.image === 'string' ? agg.image : null)

// The A–Z strip: tap a letter, or run a finger down it, to jump there. A
// tick for each new letter.
let scrubbing = false
let at = ''
function jump(letter: string, again = false) {
  if (letter === at && !again) return
  at = letter
  selectionHaptic()
  document.getElementById(`${props.namespace}-${letter}`)?.scrollIntoView({ block: 'start' })
}
function letterAt(e: PointerEvent) {
  const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
  return el?.dataset.letter ?? null
}
function scrubStart(e: PointerEvent) {
  scrubbing = true
  at = ''
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  const l = letterAt(e)
  if (l) jump(l)
}
function scrubMove(e: PointerEvent) {
  if (!scrubbing) return
  const l = letterAt(e)
  if (l) jump(l)
}
const scrubEnd = () => (scrubbing = false)

const titleAnchor = ref<HTMLElement | null>(null)
const scrolledPastTitle = useScrolledPast(titleAnchor)
const ROW = 'press-row focus-inset flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 pl-4'
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar :title="section.label" :show-title="scrolledPastTitle" :fallback="{ to: { name: 'home' }, label: 'Home' }" />

    <main class="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 pt-[calc(var(--chrome-top)+0.25rem)]">
      <header ref="titleAnchor" class="space-y-3">
        <h1 class="text-display">{{ section.label }}</h1>
        <label class="field flex h-12 items-center gap-2 rounded-xl pr-1 pl-3">
          <Search class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
          <input
            v-model="query"
            type="search"
            autocomplete="off"
            :placeholder="placeholder"
            :aria-label="`Search ${section.label.toLowerCase()}`"
            class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none"
          />
          <button
            v-if="query"
            type="button"
            class="text-muted-foreground press flex size-11 shrink-0 items-center justify-center rounded-full"
            aria-label="Clear"
            @click="query = ''"
          >
            <X class="size-5" />
          </button>
        </label>
      </header>

      <EmptyState
        v-if="error"
        size="inline"
        :icon="CloudOff"
        title="This list didn’t load"
        description="Check your connection, then try again."
      >
        <Button variant="primary" @click="retry()">Try again</Button>
      </EmptyState>

      <template v-else>
        <div v-if="loading && !sorted.length" class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]" aria-busy="true">
          <span class="sr-only">Loading…</span>
          <div v-for="i in 6" :key="i" class="flex min-h-16 items-center gap-3 py-2 pl-4">
            <Skeleton class="size-10 shrink-0 rounded-full!" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-4 w-1/2" />
              <Skeleton class="h-3.5 w-1/3" />
            </div>
          </div>
        </div>

        <template v-if="!query">
          <section
            v-for="block in [
              { key: 'favourites', label: 'Following', rows: favoriteRows, clear: false },
              { key: 'recent', label: 'Recently viewed', rows: recentRows, clear: true },
            ]"
            v-show="block.rows.length"
            :key="block.key"
            class="space-y-2"
          >
            <h2 class="text-heading flex min-h-6 items-center justify-between">
              {{ block.label }}
              <button
                v-if="block.clear"
                type="button"
                class="text-primary press -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-callout font-semibold"
                @click="recent.clear()"
              >
                Clear
              </button>
            </h2>
            <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
              <li v-for="row in block.rows" :key="row.id" class="flex items-center pr-1">
                <RouterLink v-slot="{ href, navigate }" :to="to(row.id)" custom>
                  <a :href="href" :class="ROW" @click="vt.onNavigate($event, navigate, row.id, block.key)">
                    <span class="flex w-11 shrink-0 justify-center">
                      <component :is="places" v-if="places" class="text-muted-foreground size-5" aria-hidden="true" />
                      <Avatar v-else :name="row.agg.name || '?'" :image="imageOf(row.agg)" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-base font-semibold">{{ row.agg.name || '?' }}</span>
                      <span v-if="subtitleOf(row.agg)" class="text-muted-foreground block truncate text-sm">{{ subtitleOf(row.agg) }}</span>
                    </span>
                  </a>
                </RouterLink>
                <FavoriteButton :id="row.id" :type="(props.namespace as FavoriteType)" :name="row.agg.name" />
              </li>
            </ul>
          </section>
        </template>

        <EmptyState
          v-if="!loading && !sorted.length"
          size="inline"
          :icon="query ? SearchX : section.icon"
          :title="query ? `${places ? 'Nothing' : 'No one'} matches “${query.trim()}”.` : emptyMessage || `No ${section.label.toLowerCase()} yet.`"
        />

        <section v-if="sorted.length" :class="['space-y-2', settle]">
          <h2 class="text-heading flex items-baseline justify-between">
            {{ query ? 'Matches' : places ? `All ${section.label.toLowerCase()}` : 'Everyone' }}
            <span class="text-muted-foreground text-sm font-normal tabular-nums">{{ sorted.length }}</span>
          </h2>
          <!-- clip, not hidden: the letter headings can stick while it scrolls. -->
          <ul class="surface rows-inset overflow-clip rounded-2xl [--inset:4.5rem]">
            <template v-for="x in rows" :key="'letter' in x ? `@${x.letter}` : x.row.id">
              <li
                v-if="'letter' in x"
                :id="`${namespace}-${x.letter}`"
                class="text-muted-foreground bg-card/90 sticky top-(--chrome-top) z-10 px-4 py-1.5 text-footnote font-semibold backdrop-blur-md"
              >
                {{ x.letter }}
              </li>
              <li v-else class="flex items-center pr-1">
                <RouterLink v-slot="{ href, navigate }" :to="to(x.row.id)" custom>
                  <a :href="href" :class="ROW" @click="vt.onNavigate($event, navigate, x.row.id, 'all')">
                    <span class="flex w-11 shrink-0 justify-center">
                      <component :is="places" v-if="places" class="text-muted-foreground size-5" aria-hidden="true" />
                      <Avatar v-else :name="x.row.agg.name || '?'" :image="imageOf(x.row.agg)" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-base font-semibold">{{ x.row.agg.name || '?' }}</span>
                      <span v-if="subtitleOf(x.row.agg)" class="text-muted-foreground block truncate text-sm">{{ subtitleOf(x.row.agg) }}</span>
                    </span>
                  </a>
                </RouterLink>
                <FavoriteButton :id="x.row.id" :type="(props.namespace as FavoriteType)" :name="x.row.agg.name" />
              </li>
            </template>
          </ul>
        </section>
      </template>
    </main>

    <!-- A–Z: jump down a long list. -->
    <nav
      v-if="lettered && letters.length > 4"
      aria-label="Jump to a letter"
      class="fixed top-1/2 right-0.5 z-20 flex -translate-y-1/2 touch-none flex-col items-center py-1 select-none md:right-[max(0.25rem,calc((100vw-48rem)/2-2rem))]"
      @pointerdown="scrubStart"
      @pointermove="scrubMove"
      @pointerup="scrubEnd"
      @pointercancel="scrubEnd"
    >
      <button
        v-for="l in letters"
        :key="l"
        type="button"
        :data-letter="l"
        :aria-label="`Jump to ${l}`"
        class="text-primary flex h-4.5 w-6 items-center justify-center text-xs font-semibold"
        @click="jump(l, true)"
      >
        {{ l }}
      </button>
    </nav>
  </div>
</template>
