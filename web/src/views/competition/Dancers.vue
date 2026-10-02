<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import Fuse from 'fuse.js'
import { ChevronDown, Search, Star, Users, X } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useFollowing } from '@/composables/useFollowing'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import type { EnrichedDancer } from '@/types/competition'
import EmptyState from '@/components/EmptyState.vue'
import FollowButton from '@/components/FollowButton.vue'
import NumberCard from '@/components/NumberCard.vue'
import Skeleton from '@/components/Skeleton.vue'

// Every dancer, open by default (v3 showed names straight away; next hid them
// behind 30 collapsed age groups). Typing digits matches competitor numbers
// from the start ("23" finds 230–239); anything else matches names.
const setHeader = injectInfoHeaderSetter()
const { competitionId, dancers, loadDancers } = useCompetition()
const following = useFollowing()

const loaded = ref(false)
onMounted(async () => {
  await loadDancers()
  loaded.value = true
})

type SortKey = 'group' | 'number' | 'lastName' | 'firstName'
const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'group', label: 'Age group' },
  { key: 'number', label: 'Number' },
  { key: 'lastName', label: 'Last name' },
  { key: 'firstName', label: 'First name' },
]

const query = ref('')
const sortBy = useLocalStorage<SortKey>('dancers:sort:v4', 'group')
// Remembered across competitions; ignored where none of your dancers are entered.
const onlyMine = useLocalStorage('dancers:onlyMine', false)
const anyFollowedHere = computed(() => dancers.value.some((d) => following.isFollowing(d)))

const num = (d: EnrichedDancer) => (d.number != null && Number.isFinite(d.number) ? d.number : Infinity)

const fuse = computed(
  () =>
    new Fuse(dancers.value, {
      keys: ['fullName', 'firstName', 'lastName', 'location'],
      threshold: 0.3,
      ignoreLocation: true,
    }),
)

const filtered = computed(() => {
  let list = dancers.value
  const q = query.value.trim()
  if (/^\d+$/.test(q)) {
    list = list.filter((d) => d.number != null && String(d.number).startsWith(q))
  } else if (q) {
    const hit = new Set(fuse.value.search(q).map((r) => r.item.id))
    list = list.filter((d) => hit.has(d.id))
  }
  if (onlyMine.value && anyFollowedHere.value) list = list.filter((d) => following.isFollowing(d))
  return list
})

interface Section {
  key: string
  label: string
  meta: string | null
  rows: EnrichedDancer[]
}

const sections = computed<Section[]>(() => {
  const list = [...filtered.value]
  if (sortBy.value === 'number') {
    return [{ key: 'all', label: 'By number', meta: null, rows: list.sort((a, b) => num(a) - num(b)) }]
  }
  if (sortBy.value === 'lastName' || sortBy.value === 'firstName') {
    const k = sortBy.value
    list.sort((a, b) => (a[k] ?? '').localeCompare(b[k] ?? ''))
    const map = new Map<string, EnrichedDancer[]>()
    for (const d of list) {
      const letter = (d[k] ?? '?').trim().charAt(0).toUpperCase() || '?'
      map.set(letter, [...(map.get(letter) ?? []), d])
    }
    return [...map.entries()].map(([letter, rows]) => ({ key: letter, label: letter, meta: null, rows }))
  }
  const map = new Map<string, Section & { order: number }>()
  for (const d of list) {
    const key = d.group?.id ?? 'none'
    let s = map.get(key)
    if (!s) {
      s = { key, label: d.group?.fullName || 'No age group', meta: null, rows: [], order: d.group?._order ?? Infinity }
      map.set(key, s)
    }
    s.rows.push(d)
  }
  return [...map.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map((s) => ({ ...s, rows: s.rows.sort((a, b) => num(a) - num(b)) }))
})

const followedCount = computed(() => dancers.value.filter((d) => following.isFollowing(d)).length)
</script>

<template>
  <div class="space-y-3">
    <header :ref="setHeader">
      <h1 class="text-display flex items-baseline gap-2">
        Dancers
        <span v-if="dancers.length" class="text-muted-foreground text-base font-semibold">{{ dancers.length }}</span>
      </h1>
    </header>

    <div class="bg-card border-strong focus-within:border-primary flex h-12 items-center gap-2 rounded-xl border-2 px-3">
      <Search class="text-muted-foreground size-5 shrink-0" />
      <input
        v-model="query"
        type="search"
        placeholder="Name or number"
        aria-label="Search dancers by name or number"
        autocomplete="off"
        class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none"
      />
      <button
        v-if="query"
        type="button"
        class="text-muted-foreground -mr-1 flex size-10 items-center justify-center rounded-full"
        aria-label="Clear search"
        @click="query = ''"
      >
        <X class="size-5" />
      </button>
    </div>

    <div class="flex items-center gap-2">
      <button
        v-if="anyFollowedHere"
        type="button"
        role="switch"
        :aria-checked="onlyMine"
        class="bg-card flex h-11 flex-1 items-center gap-2 rounded-xl border px-3 text-left text-[0.9375rem] font-bold"
        @click="onlyMine = !onlyMine"
      >
        <Star :class="['size-4 shrink-0', onlyMine ? 'text-primary fill-current' : 'text-muted-foreground']" />
        <span class="flex-1">Only my dancers</span>
        <span
          :class="[
            'relative h-6 w-10 shrink-0 rounded-full transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform',
            onlyMine ? 'bg-primary-fill after:translate-x-4' : 'bg-strong',
          ]"
          aria-hidden="true"
        />
      </button>
      <label class="bg-card relative flex h-11 shrink-0 items-center rounded-xl border text-[0.9375rem] font-bold">
        <span class="sr-only">Sort by</span>
        <select v-model="sortBy" class="h-full appearance-none rounded-xl bg-transparent pr-9 pl-3 font-bold outline-none">
          <option v-for="s in SORTS" :key="s.key" :value="s.key">{{ s.label }}</option>
        </select>
        <ChevronDown class="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
      </label>
    </div>

    <div v-if="!loaded" class="space-y-2" aria-busy="true">
      <Skeleton v-for="i in 6" :key="i" class="h-14 w-full rounded-xl!" />
    </div>
    <EmptyState
      v-else-if="!dancers.length"
      :icon="Users"
      title="No dancers yet"
      description="The dancer list hasn’t been posted yet."
    />
    <EmptyState
      v-else-if="!sections.length && onlyMine"
      :icon="Star"
      :title="followedCount ? 'No matches' : 'You’re not following anyone here'"
      description="Turn off “Only my dancers” to see everyone, then tap Follow next to your dancer."
    />
    <p v-else-if="!sections.length" class="text-muted-foreground py-6 text-center text-base">
      No dancer matches “{{ query }}”. Check the number on their card, or try part of their name.
    </p>

    <section v-for="s in sections" :key="s.key">
      <h2
        class="bg-background sticky top-(--chrome-top) z-10 flex items-baseline justify-between gap-2 py-2 text-[1.0625rem] font-extrabold"
      >
        <span class="truncate">{{ s.label }}</span>
        <span class="text-muted-foreground shrink-0 text-sm font-semibold">{{ s.rows.length }}</span>
      </h2>
      <!-- Off-screen sections skip rendering; their size estimate is exact
           (rows × row height) so Back restores to the same dancer. -->
      <ul
        class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm [content-visibility:auto]"
        :style="{ containIntrinsicSize: `auto calc(${s.rows.length} * 3.8125rem + 2px)` }"
      >
        <li
          v-for="d in s.rows"
          :key="d.id"
          class="relative flex items-center gap-2 pr-2"
          :style="
            following.isFollowing(d)
              ? {
                  ...following.paint(d.dancerId),
                  backgroundColor: 'color-mix(in srgb, var(--dc) 9%, var(--card))',
                }
              : undefined
          "
        >
          <span v-if="following.isFollowing(d)" class="sash absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
          <RouterLink
            :to="{ name: 'competition.dancer', params: { competitionId, dancerId: d.id } }"
            class="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pl-3"
          >
            <NumberCard
              :number="d.number"
              size="xs"
              :color="following.isFollowing(d) ? following.colorFor(d.dancerId) : null"
            />
            <span class="min-w-0">
              <span class="block truncate text-base font-semibold">{{ d.fullName }}</span>
              <span class="text-muted-foreground block truncate text-sm">
                {{ sortBy === 'group' ? d.location : d.group?.fullName }}
              </span>
            </span>
          </RouterLink>
          <FollowButton :dancer="d" />
        </li>
      </ul>
    </section>
  </div>
</template>
