<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { ArrowDownUp, Check, ChevronDown, Search, Star, Users, X } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useCompetitionSearch } from '@/composables/useCompetitionSearch'
import { useDancerNumberVt } from '@/composables/useCompetitionDancerVt'
import { useFollowing } from '@/composables/useFollowing'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import type { EnrichedDancer } from '@/types/competition'
import Dialog from '@/components/Dialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import FollowButton from '@/components/FollowButton.vue'
import NumberCard from '@/components/NumberCard.vue'
import Skeleton from '@/components/Skeleton.vue'
import Switch from '@/components/ui/Switch.vue'
import { anchorTo } from '@/lib/anchor'
import { selectionHaptic } from '@/lib/haptics'
import { useMorph } from '@/lib/morph'

// Every dancer, open by default (v3 showed names straight away; next hid them
// behind 30 collapsed age groups). Typing digits matches competitor numbers
// from the start ("23" finds 230–239); anything else matches names. The
// Overview's search hands over what you typed (?q=).
const route = useRoute()
const setHeader = injectInfoHeaderSetter()
const { competitionId, dancers, loadDancers } = useCompetition()
const following = useFollowing()
const numberVt = useDancerNumberVt()

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

const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const sortBy = useLocalStorage<SortKey>('dancers:sort:v4', 'group')
const sortLabel = computed(() => SORTS.find((s) => s.key === sortBy.value)?.label ?? SORTS[0].label)
// Remembered across competitions; ignored where none of your dancers are entered.
const onlyMine = useLocalStorage('dancers:onlyMine', false)
const anyFollowedHere = computed(() => dancers.value.some((d) => following.isFollowing(d)))
const mineOnly = computed(() => onlyMine.value && anyFollowedHere.value)

// Sort: a small menu that grows out of its pill.
const sortMenu = useMorph()
const sortPlace = ref<Record<string, string>>({})
function openSort(e: MouseEvent) {
  sortPlace.value = anchorTo(e.currentTarget as Element, 260)
  sortMenu.show(e)
}
function pick(key: SortKey) {
  if (key !== sortBy.value) selectionHaptic()
  sortBy.value = key
  sortMenu.hide()
}

const num = (d: EnrichedDancer) => (d.number != null && Number.isFinite(d.number) ? d.number : Infinity)

const matched = useCompetitionSearch(dancers, query)
const filtered = computed(() => (mineOnly.value ? matched.value.filter((d) => following.isFollowing(d)) : matched.value))

interface Section {
  key: string
  label: string
  rows: EnrichedDancer[]
}

const sections = computed<Section[]>(() => {
  const list = [...filtered.value]
  if (sortBy.value === 'number') {
    return [{ key: 'all', label: 'By number', rows: list.sort((a, b) => num(a) - num(b)) }]
  }
  if (sortBy.value === 'lastName' || sortBy.value === 'firstName') {
    const k = sortBy.value
    list.sort((a, b) => (a[k] ?? '').localeCompare(b[k] ?? ''))
    const map = new Map<string, EnrichedDancer[]>()
    for (const d of list) {
      const letter = (d[k] ?? '?').trim().charAt(0).toUpperCase() || '?'
      map.set(letter, [...(map.get(letter) ?? []), d])
    }
    return [...map.entries()].map(([letter, rows]) => ({ key: letter, label: letter, rows }))
  }
  const map = new Map<string, Section & { order: number }>()
  for (const d of list) {
    const key = d.group?.id ?? 'none'
    let s = map.get(key)
    if (!s) {
      s = { key, label: d.group?.fullName || 'No age group', rows: [], order: d.group?._order ?? Infinity }
      map.set(key, s)
    }
    s.rows.push(d)
  }
  return [...map.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map((s) => ({ ...s, rows: s.rows.sort((a, b) => num(a) - num(b)) }))
})

const followedCount = computed(() => dancers.value.filter((d) => following.isFollowing(d)).length)

const MENU_ROW = 'press-row focus-inset flex min-h-12 w-full items-center gap-3 px-4 text-left text-base font-medium'
</script>

<template>
  <div class="space-y-3">
    <header :ref="setHeader">
      <h1 class="text-display flex items-baseline gap-2">
        Dancers
        <span v-if="dancers.length" class="text-muted-foreground text-base font-medium tabular-nums">{{ dancers.length }}</span>
      </h1>
    </header>

    <label class="field flex h-12 items-center gap-2 rounded-xl pr-1 pl-3">
      <Search class="text-muted-foreground size-5 shrink-0" />
      <input
        v-model="query"
        type="search"
        placeholder="Name or number"
        aria-label="Search dancers by name or number"
        autocomplete="off"
        enterkeyhint="search"
        class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none"
      />
      <button
        v-if="query"
        type="button"
        class="press text-muted-foreground flex size-10 items-center justify-center rounded-full"
        aria-label="Clear search"
        @click="query = ''"
      >
        <X class="size-5" />
      </button>
    </label>

    <div class="flex items-center gap-2">
      <label v-if="anyFollowedHere" class="surface flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full pr-1.5 pl-4">
        <span id="only-my-dancers" class="text-callout min-w-0 flex-1 truncate font-medium">Only my dancers</span>
        <Switch v-model="onlyMine" aria-labelledby="only-my-dancers" />
      </label>
      <button
        type="button"
        :class="[
          'glass press-glass text-callout flex h-11 shrink-0 items-center gap-1.5 rounded-full pr-3 pl-3.5 font-semibold',
          !anyFollowedHere && 'ml-auto',
        ]"
        :aria-label="`Sort by ${sortLabel}`"
        aria-haspopup="dialog"
        :aria-expanded="sortMenu.open"
        @click="openSort"
      >
        <ArrowDownUp class="text-primary size-4" />
        {{ sortLabel }}
        <ChevronDown class="text-muted-foreground size-4" />
      </button>
    </div>

    <Dialog
      :open="sortMenu.open"
      :morph="sortMenu"
      variant="dropdown"
      aria-label="Sort by"
      :style="sortPlace"
      @close="sortMenu.hide()"
    >
      <div role="radiogroup" aria-labelledby="sort-by-label" class="py-1.5">
        <p id="sort-by-label" class="text-muted-foreground text-footnote px-4 pt-1.5 pb-1 font-medium">Sort by</p>
        <button
          v-for="s in SORTS"
          :key="s.key"
          type="button"
          role="radio"
          :aria-checked="sortBy === s.key"
          :class="MENU_ROW"
          @click="pick(s.key)"
        >
          <Check :class="['text-primary size-5 shrink-0', sortBy !== s.key && 'invisible']" stroke-width="2.5" />
          {{ s.label }}
        </button>
      </div>
    </Dialog>

    <div v-if="!loaded" class="space-y-2" aria-busy="true">
      <Skeleton v-for="i in 6" :key="i" class="h-14 w-full rounded-xl!" />
    </div>
    <EmptyState
      v-else-if="!dancers.length"
      :icon="Users"
      title="No dancers yet"
      description="The dancer list hasn’t been posted yet."
    />

    <!-- Filtering and sorting fade through, so the list doesn't jump. -->
    <Transition
      v-else
      mode="out-in"
      enter-active-class="transition-opacity duration-(--dur-quick) ease-standard"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-(--dur-instant) ease-exit"
      leave-to-class="opacity-0"
    >
      <div :key="`${mineOnly}:${sortBy}`" class="space-y-3">
        <EmptyState
          v-if="!sections.length && mineOnly"
          :icon="Star"
          :title="followedCount ? 'No matches' : 'You’re not following anyone here'"
          description="Turn off “Only my dancers” to see everyone, then tap Follow next to your dancer."
        />
        <p v-else-if="!sections.length" class="text-muted-foreground py-6 text-center text-base">
          No dancer matches “{{ query }}”. Check the number on their card, or try part of their name.
        </p>

        <section v-for="s in sections" :key="s.key">
          <h2
            class="bg-background text-muted-foreground text-callout sticky top-(--chrome-top) z-10 flex items-baseline justify-between gap-2 py-2 font-semibold"
          >
            <span class="truncate">{{ s.label }}</span>
            <span class="shrink-0 font-medium tabular-nums">{{ s.rows.length }}</span>
          </h2>
          <!-- Off-screen sections skip rendering; their size estimate is exact
               (rows × row height) so Back restores to the same dancer. -->
          <ul
            class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.75rem] [content-visibility:auto]"
            :style="{ containIntrinsicSize: `auto calc(${s.rows.length} * 3.75rem)` }"
          >
            <li
              v-for="d in s.rows"
              :key="d.id"
              class="relative flex items-center gap-1 pr-2"
              :style="following.isFollowing(d) ? following.paint(d.dancerId) : undefined"
            >
              <span v-if="following.isFollowing(d)" class="sash absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
              <RouterLink
                :to="{ name: 'competition.dancer', params: { competitionId, dancerId: d.id } }"
                class="press-row focus-inset flex min-h-15 min-w-0 flex-1 items-center gap-3 rounded-r-xl py-2 pl-4"
                @click="numberVt.tap(d.id, 'dancers')"
              >
                <NumberCard
                  :number="d.number"
                  size="xs"
                  :color="following.isFollowing(d) ? following.colorFor(d.dancerId) : null"
                  :style="{ viewTransitionName: numberVt.row(d.id, 'dancers') }"
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
    </Transition>
  </div>
</template>
