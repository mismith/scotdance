<script setup lang="ts">
import CompetitionName from '@/components/CompetitionName.vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight, Clock, Hash } from '@lucide/vue'
import Avatar from '@/components/Avatar.vue'
import DateTile from '@/components/DateTile.vue'
import VisibilityChip from '@/components/VisibilityChip.vue'
import { useFollowing } from '@/composables/useFollowing'
import { useHiddenAs } from '@/composables/useHiddenAs'
import { useOrganisationCompetitions } from '@/composables/useOrganisations'
import { useRecentEntities } from '@/composables/useRecentEntities'
import { useRecentSearches } from '@/composables/useRecentSearches'
import { isBeforeToday } from '@/lib/format'
import { sectionMeta } from '@/lib/sectionMeta'
import { useMeStore } from '@/stores/me'
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
const following = useFollowing()
const me = useMeStore()
const hiddenAs = useHiddenAs()

// Competitions, people and venues you've opened, newest first, whichever
// list they're from. Clear empties every kind, so the Recently viewed on Home
// and on each list empties too. A competition's admins see its shield and how
// it's hidden, as in every list.
const kinds = [
  { ns: 'competitions', label: 'Competition', route: 'competition.info', param: 'competitionId' },
  { ns: 'dancers', label: 'Dancer', route: 'dancer.info', param: 'dancerId' },
  { ns: 'judges', label: 'Judge', route: 'judge.info', param: 'judgeId' },
  { ns: 'pipers', label: 'Piper', route: 'piper.info', param: 'piperId' },
  { ns: 'venues', label: 'Venue', route: 'venue.info', param: 'venueId' },
  { ns: 'organisations', label: 'Organisation', route: 'organisation.info', param: 'organisationId' },
].map((k) => ({ ...k, icon: sectionMeta(k.ns).icon, store: useRecentEntities(k.ns) }))
const viewed = computed(() =>
  kinds
    .flatMap((k) => k.store.recent.value.map((r) => ({ ...r, kind: k })))
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, 5),
)
const clearViewed = () => kinds.forEach((k) => k.store.clear())
// A viewed competition kept only its name: its organisations from the list,
// so it leads with them as competitions do everywhere.
const { competitions: everyCompetition } = useOrganisationCompetitions()
const organisationsOf = computed(() => new Map(everyCompetition.value.map((c) => [c.id, c.organisations])))

// Competitions across the top; the people lists and venues as tiles.
const competitions = sectionMeta('competitions')
const lists = ['dancers', 'judges', 'pipers', 'venues', 'organisations'].map(sectionMeta)
</script>

<template>
  <section v-if="recentSearches.recent.value.length" class="space-y-2">
    <h2 class="text-heading flex min-h-6 items-center justify-between">
      Recent searches
      <button
        type="button"
        aria-label="Clear recent searches"
        class="text-primary press -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-callout font-semibold"
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
        class="surface press flex h-11 max-w-full items-center gap-2 rounded-full px-4 text-callout font-medium"
        @click="emit('search', r)"
      >
        <Clock class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        <span class="truncate">{{ r }}</span>
      </button>
    </div>
  </section>

  <!-- Only with a competition on today: otherwise it repeats "By number" above. -->
  <button
    v-if="today"
    type="button"
    class="surface press-row focus-inset flex w-full items-center gap-3 rounded-2xl p-4 text-left"
    @click="emit('number', today?.id)"
  >
    <span
      :class="[
        'flex size-11 shrink-0 items-center justify-center rounded-full',
        'bg-live-paper text-live',
      ]"
      aria-hidden="true"
    >
      <Hash class="size-5" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block text-base leading-snug font-semibold"><CompetitionName :competition="today.competition" /></span>
      <span class="text-live flex items-center gap-1.5 text-sm font-semibold">
        <span class="bg-live size-2 shrink-0 rounded-full" />
        <span class="truncate">Today<template v-if="today.competition.location"> · {{ today.competition.location }}</template></span>
      </span>
      <span class="text-muted-foreground block text-sm">Find a dancer by the number on their card.</span>
    </span>
    <ChevronRight class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
  </button>

  <section v-if="viewed.length" class="space-y-2">
    <h2 class="text-heading flex min-h-6 items-center justify-between">
      Recently viewed
      <button
        type="button"
        aria-label="Clear recently viewed"
        class="text-primary press -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-callout font-semibold"
        @click="clearViewed"
      >
        Clear
      </button>
    </h2>
    <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
      <li v-for="v in viewed" :key="`${v.kind.ns}:${v.id}`">
        <RouterLink
          :to="{ name: v.kind.route, params: { [v.kind.param]: v.id } }"
          class="press-row focus-inset flex min-h-16 items-center gap-3 py-2 pr-3 pl-4"
        >
          <span class="flex w-11 shrink-0 justify-center">
            <DateTile
              v-if="v.kind.ns === 'competitions'"
              :date="v.date"
              :below="isBeforeToday(v.date) ? 'year' : 'weekday'"
              :managed="me.organises(v.id)"
            />
            <Avatar v-else-if="v.kind.ns !== 'venues' && v.kind.ns !== 'organisations'" :name="v.name" :color="v.kind.ns === 'dancers' ? following.colorFor(v.id) : null" />
            <component :is="v.kind.icon" v-else class="text-muted-foreground size-5" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base font-semibold">
              <CompetitionName v-if="v.kind.ns === 'competitions'" :competition="{ name: v.name, organisations: organisationsOf.get(v.id) }" />
              <template v-else>{{ v.name }}</template>
            </span>
            <span class="text-muted-foreground block truncate text-sm">{{ v.kind.label }}</span>
            <span v-if="v.kind.ns === 'competitions' && hiddenAs(v.id)" class="mt-0.5 flex"><VisibilityChip :visibility="hiddenAs(v.id)" /></span>
          </span>
          <ChevronRight class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
        </RouterLink>
      </li>
    </ul>
  </section>

  <!-- On wide screens the sidebar already lists all of these. -->
  <section class="space-y-2 lg:hidden">
    <h2 class="text-heading">Browse</h2>
    <!-- One list, as in More: muted icons, the label, a chevron. -->
    <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:3.5rem]">
      <li v-for="b in [competitions, ...lists]" :key="b.path">
        <RouterLink :to="b.to" class="press-row focus-inset flex min-h-14 items-center gap-4 px-4 py-2">
          <component :is="b.icon" class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
          <span class="flex-1 text-base font-medium">{{ b.label }}</span>
          <ChevronRight class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
