<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import type { RouteLocationRaw } from 'vue-router'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import CompetitionRow from '@/components/CompetitionRow.vue'
import CompetitionsCalendar from '@/components/CompetitionsCalendar.vue'
import CompetitionsMap from '@/views/competitions/CompetitionsMap.vue'
import DatePill, { type DateFilter } from '@/components/DatePill.vue'
import LocationPill from '@/components/LocationPill.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import Skeleton from '@/components/Skeleton.vue'
import ViewModePill, { type ViewMode } from '@/components/ViewModePill.vue'
import { providePillRow } from '@/composables/usePillRow'
import { useLocationFilter } from '@/composables/useLocationFilter'
import { daysFromToday, parseDate } from '@/lib/format'

// Shared subtab body for entity profiles that surface a list of competitions
// (dancer.results, judge/piper/venue.competitions). Owns the filter pills
// (ViewMode / Location / Date), date/location filtering, month grouping,
// and the three render modes (list / calendar / map). Per-entity wrappers
// just normalize their appearance data into AppearanceItem and supply a
// destination resolver.

export interface AppearanceItem {
  competition: CompetitionListItem
  /** Per-comp dancer bib number (dancer subtab only). */
  number?: number | null
  /** True when the comp falls on today. */
  isLive?: boolean
  /** Eyebrow badge when isLive (e.g. 'Dancing now', 'Judging now'). */
  liveLabel?: string
}

const CURRENT_PAST_DAYS = -7
const CURRENT_FUTURE_DAYS = 30

const props = withDefaults(
  defineProps<{
    items: AppearanceItem[]
    /** Per-item destination route (list rows, calendar links, map pins). */
    toResolver: (item: AppearanceItem) => RouteLocationRaw
    /** localStorage prefix: drives '{prefix}:view' + '{prefix}:filter' keys. */
    storagePrefix: string
    /** Set false for venue subtab (every comp is at the same venue, so a
     *  location filter is either no-op or empty). */
    showLocationPill?: boolean
    loading?: boolean
    emptyMessage?: string
  }>(),
  {
    showLocationPill: true,
    loading: false,
    emptyMessage: 'No appearances on record.',
  },
)

const view = useLocalStorage<ViewMode>(`${props.storagePrefix}:view`, 'list')
const filter = useLocalStorage<DateFilter>(`${props.storagePrefix}:filter`, 'all')

// ExpandingPill popovers anchor to this row (matches CompetitionsList).
const pillRowEl = ref<HTMLElement | null>(null)
providePillRow(pillRowEl)
function setPillRow(el: unknown) {
  pillRowEl.value = (el as HTMLElement | null) ?? null
}

const { filterFor: locationFilterFor } = useLocationFilter()

// Competitions list (drives LocationPill's country quick-picks).
const competitions = computed<CompetitionListItem[]>(() =>
  props.items.map((i) => i.competition),
)
const effectiveLocationFilter = computed(() => locationFilterFor(competitions.value))

const itemByCompId = computed(() => {
  const map = new Map<string, AppearanceItem>()
  for (const item of props.items) map.set(item.competition.id, item)
  return map
})

const locationFiltered = computed<AppearanceItem[]>(() => {
  const ef = effectiveLocationFilter.value
  if (!props.showLocationPill || !ef.isActive) return props.items
  return props.items.filter((i) => ef.predicate(i.competition))
})

function dateMs(c: CompetitionListItem) {
  return c.date ? parseDate(c.date).getTime() : 0
}

const filteredItems = computed<AppearanceItem[]>(() => {
  let list = locationFiltered.value.slice()
  if (filter.value === 'current') {
    list = list.filter((i) => {
      const d = daysFromToday(i.competition.date)
      return d !== null && d >= CURRENT_PAST_DAYS && d <= CURRENT_FUTURE_DAYS
    })
  } else if (filter.value === 'archived') {
    list = list.filter((i) => {
      const d = daysFromToday(i.competition.date)
      return d !== null && d < CURRENT_PAST_DAYS
    })
  }
  // 'current' is a tight window around today → ascending puts next-up first.
  // 'archived' and 'all' are history-leaning views → descending puts the most
  // recent at the top (profile-feed convention).
  list.sort((a, b) =>
    filter.value === 'current'
      ? dateMs(a.competition) - dateMs(b.competition)
      : dateMs(b.competition) - dateMs(a.competition),
  )
  return list
})

interface MonthGroup {
  key: string
  label: string
  members: AppearanceItem[]
}

const monthGroups = computed<MonthGroup[]>(() => {
  const groups = new Map<string, MonthGroup>()
  for (const item of filteredItems.value) {
    const d = item.competition.date ? parseDate(item.competition.date) : null
    const key = d
      ? `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
      : 'undated'
    const label = d
      ? `${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`
      : 'Undated'
    let g = groups.get(key)
    if (!g) {
      g = { key, label, members: [] }
      groups.set(key, g)
    }
    g.members.push(item)
  }
  return [...groups.values()]
})

// Calendar/Map link helpers — receive a CompetitionListItem, look the item
// back up, defer to the caller's toResolver. Falls back to competition.info
// when an item isn't found (defensive — shouldn't happen since the lists
// are built from items).
function linkToFromComp(c: CompetitionListItem): RouteLocationRaw {
  const item = itemByCompId.value.get(c.id)
  return item
    ? props.toResolver(item)
    : { name: 'competition.info', params: { competitionId: c.id } }
}

const calendarCompetitions = computed<CompetitionListItem[]>(() =>
  locationFiltered.value.map((i) => i.competition),
)

// Map view ignores the location filter — the map IS the geographic browser,
// narrowing it by Nearby/Region would collapse the very thing it's for.
const mapCompetitions = computed<CompetitionListItem[]>(() => {
  const all = props.items.map((i) => i.competition)
  if (filter.value === 'current') {
    return all.filter((c) => {
      const d = daysFromToday(c.date)
      return d !== null && d >= CURRENT_PAST_DAYS && d <= CURRENT_FUTURE_DAYS
    })
  }
  if (filter.value === 'archived') {
    return all.filter((c) => {
      const d = daysFromToday(c.date)
      return d !== null && d < CURRENT_PAST_DAYS
    })
  }
  return all
})

const emptyStateMessage = computed(() => {
  if (props.loading) return null
  if (!props.items.length) return props.emptyMessage
  if (!filteredItems.value.length) {
    if (effectiveLocationFilter.value.isActive)
      return 'No appearances match this location.'
    if (filter.value === 'current') return 'Nothing current. Try All.'
    if (filter.value === 'archived') return 'No archived appearances on record.'
    return 'No appearances match.'
  }
  return null
})
</script>

<template>
  <div class="space-y-5">
    <div :ref="setPillRow" class="relative flex">
      <div class="floating-nav flex items-center rounded-3xl p-1">
        <ViewModePill v-model="view" />
        <LocationPill
          v-if="showLocationPill && view !== 'map'"
          :competitions="competitions"
        />
        <DatePill v-if="view !== 'calendar'" v-model="filter" />
      </div>
    </div>

    <CompetitionsCalendar
      v-if="view === 'calendar'"
      :competitions="calendarCompetitions"
      :link-to="linkToFromComp"
    />

    <CompetitionsMap
      v-else-if="view === 'map'"
      :competitions="mapCompetitions"
      :link-to="linkToFromComp"
      :fullscreen="false"
      class="h-[60vh] rounded-2xl border"
    />

    <template v-else>
      <div
        v-if="loading && !items.length"
        class="space-y-3"
        aria-busy="true"
        aria-live="polite"
      >
        <span class="sr-only">Loading…</span>
        <div v-for="i in 4" :key="i" class="flex items-start gap-3 py-3">
          <Skeleton class="size-12 shrink-0 rounded-xl!" />
          <div class="flex-1 space-y-2 pt-1">
            <Skeleton class="h-5 w-3/4" />
            <Skeleton class="h-4 w-1/2" />
          </div>
        </div>
      </div>

      <div v-else-if="emptyStateMessage" class="text-muted-foreground text-lg italic">
        {{ emptyStateMessage }}
      </div>

      <section v-for="group in monthGroups" :key="group.key" class="space-y-2">
        <SectionHeader :label="group.label" :count="group.members.length" />
        <ul>
          <CompetitionRow
            v-for="item in group.members"
            :key="item.competition.id"
            :competition="item.competition"
            :to="toResolver(item)"
          >
            <template #meta>
              <div
                v-if="item.number != null || (item.isLive && item.liveLabel)"
                class="text-item-subtitle text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2"
              >
                <span v-if="item.number != null" class="tabular-nums not-italic">
                  #{{ item.number }}
                </span>
                <span
                  v-if="item.isLive && item.liveLabel"
                  class="text-secondary font-sans text-sm font-bold not-italic tracking-[0.12em] uppercase"
                >
                  {{ item.liveLabel }}
                </span>
              </div>
            </template>
          </CompetitionRow>
        </ul>
      </section>
    </template>
  </div>
</template>
