<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight, Clock, Hash } from '@lucide/vue'
import DateTile from '@/components/DateTile.vue'
import { useRecentEntities } from '@/composables/useRecentEntities'
import { useRecentSearches } from '@/composables/useRecentSearches'
import { initialsOf, isBeforeToday } from '@/lib/format'
import { sectionMeta } from '@/lib/sectionMeta'
import type { CompetitionChoice } from './choices'

// Search before anything's typed: your recent searches, a way to look up a
// number (at today's competition, when one's on), who and where you looked
// at lately, and every list to browse.
defineProps<{
  /** The likeliest competition on today, if any. */
  today: CompetitionChoice | null
}>()
const emit = defineEmits<{ search: [q: string]; number: [competitionId?: string] }>()

const recentSearches = useRecentSearches()

// Competitions, people and venues you've opened, newest first, whichever
// list they're from. Clear empties every kind, so the Recently viewed on Home
// and on each list empties too.
const kinds = [
  { ns: 'competitions', label: 'Competition', route: 'competition.info', param: 'competitionId' },
  { ns: 'dancers', label: 'Dancer', route: 'dancer.info', param: 'dancerId' },
  { ns: 'judges', label: 'Judge', route: 'judge.info', param: 'judgeId' },
  { ns: 'pipers', label: 'Piper', route: 'piper.info', param: 'piperId' },
  { ns: 'venues', label: 'Venue', route: 'venue.info', param: 'venueId' },
].map((k) => ({ ...k, icon: sectionMeta(k.ns).icon, store: useRecentEntities(k.ns) }))
const viewed = computed(() =>
  kinds
    .flatMap((k) => k.store.recent.value.map((r) => ({ ...r, kind: k })))
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, 5),
)
const clearViewed = () => kinds.forEach((k) => k.store.clear())

// Competitions across the top; the people lists and venues as tiles.
const competitions = sectionMeta('competitions')
const lists = ['dancers', 'judges', 'pipers', 'venues'].map(sectionMeta)
</script>

<template>
  <section v-if="recentSearches.recent.value.length" class="space-y-2">
    <h2 class="text-heading flex min-h-6 items-center justify-between pt-1">
      Recent searches
      <button
        type="button"
        aria-label="Clear recent searches"
        class="text-primary -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-[0.9375rem] font-bold"
        @click="recentSearches.clear()"
      >
        Clear
      </button>
    </h2>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="r in recentSearches.recent.value"
        :key="r"
        type="button"
        class="bg-card hover:bg-accent flex h-11 max-w-full items-center gap-2 rounded-full border px-4 text-[0.9375rem] font-semibold shadow-sm"
        @click="emit('search', r)"
      >
        <Clock class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        <span class="truncate">{{ r }}</span>
      </button>
    </div>
  </section>

  <button
    type="button"
    class="bg-card hover:bg-accent flex w-full items-center gap-3 rounded-2xl border p-4 text-left shadow-sm"
    @click="emit('number', today?.id)"
  >
    <span
      :class="[
        'flex size-11 shrink-0 items-center justify-center rounded-full',
        today ? 'bg-live-paper text-live' : 'bg-blue-paper text-primary',
      ]"
    >
      <Hash class="size-5" />
    </span>
    <span v-if="today" class="min-w-0 flex-1">
      <span class="text-live flex items-center gap-1.5 text-sm font-bold">
        <span class="bg-live size-2 shrink-0 rounded-full motion-safe:animate-[live-pulse_2s_infinite]" />
        <span class="truncate">Today<template v-if="today.competition.location"> · {{ today.competition.location }}</template></span>
      </span>
      <span class="block text-base leading-snug font-bold">{{ today.competition.name ?? 'Competition' }}</span>
      <span class="text-muted-foreground block text-sm">Find a dancer by the number on their card.</span>
    </span>
    <span v-else class="min-w-0 flex-1">
      <span class="block text-base leading-snug font-bold">Know the number on their card?</span>
      <span class="text-muted-foreground block text-sm">Search by number instead.</span>
    </span>
    <ChevronRight class="text-muted-foreground size-5 shrink-0" />
  </button>

  <section v-if="viewed.length" class="space-y-2">
    <h2 class="text-heading flex min-h-6 items-center justify-between pt-1">
      Recently viewed
      <button
        type="button"
        aria-label="Clear recently viewed"
        class="text-primary -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-[0.9375rem] font-bold"
        @click="clearViewed"
      >
        Clear
      </button>
    </h2>
    <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
      <li v-for="v in viewed" :key="`${v.kind.ns}:${v.id}`">
        <RouterLink
          :to="{ name: v.kind.route, params: { [v.kind.param]: v.id } }"
          class="flex min-h-14 items-center gap-3 py-2 pr-4 pl-3 hover:bg-accent"
        >
          <span class="flex w-12 shrink-0 justify-center">
            <DateTile v-if="v.kind.ns === 'competitions'" :date="v.date" :below="isBeforeToday(v.date) ? 'year' : 'weekday'" />
            <span v-else class="bg-blue-paper text-primary flex size-10 items-center justify-center rounded-full text-sm font-extrabold">
              <component :is="v.kind.icon" v-if="v.kind.ns !== 'dancers'" class="size-5" />
              <template v-else>{{ initialsOf(v.name) }}</template>
            </span>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base font-bold">{{ v.name }}</span>
            <span class="text-muted-foreground block truncate text-sm">{{ v.kind.label }}</span>
          </span>
          <ChevronRight class="text-muted-foreground size-5 shrink-0" />
        </RouterLink>
      </li>
    </ul>
  </section>

  <section class="space-y-2">
    <h2 class="text-heading pt-1">Browse</h2>
    <RouterLink
      :to="competitions.to"
      class="bg-card hover:bg-accent flex min-h-16 items-center gap-3 rounded-2xl border p-3 shadow-sm"
    >
      <span class="bg-blue-paper text-primary flex size-11 shrink-0 items-center justify-center rounded-full">
        <component :is="competitions.icon" class="size-5" />
      </span>
      <span class="flex-1 text-base font-bold">{{ competitions.label }}</span>
      <ChevronRight class="text-muted-foreground size-5 shrink-0" />
    </RouterLink>
    <ul class="grid grid-cols-2 gap-2 md:grid-cols-4">
      <li v-for="b in lists" :key="b.path">
        <RouterLink
          :to="b.to"
          class="bg-card hover:bg-accent flex h-full min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center shadow-sm"
        >
          <span class="bg-blue-paper text-primary flex size-11 items-center justify-center rounded-full">
            <component :is="b.icon" class="size-5" />
          </span>
          <span class="text-[0.9375rem] leading-tight font-bold">{{ b.label }}</span>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
