<script setup lang="ts">
import { computed, nextTick, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { refDebounced, useEventListener } from '@vueuse/core'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Gavel,
  History,
  MapPin,
  MapPinned,
  Music,
  School,
  User,
  X,
} from '@lucide/vue'
import SectionHeader from '@/components/SectionHeader.vue'
import DisclosureHeader from '@/components/DisclosureHeader.vue'
import SmoothCollapse from '@/components/SmoothCollapse.vue'
import Skeleton from '@/components/Skeleton.vue'
import CompetitionRow from '@/components/CompetitionRow.vue'
import AccountAvatarButton from '@/components/AccountAvatarButton.vue'
import TopBackButton from '@/components/nav/TopBackButton.vue'
import {
  searchAll,
  type SearchAllResults,
  type SearchEntityType,
  type SearchCompetitionHit,
  type SearchPlaceGroup,
  type SearchPersonGroup,
} from '@/lib/searchAll'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import { useLocationFilter } from '@/composables/useLocationFilter'
import { useRecentSearches } from '@/composables/useRecentSearches'
import { useSearchExamples } from '@/composables/useSearchExamples'
import { useGlobalSearch } from '@/composables/useGlobalSearch'
import { isIos } from '@/lib/platform'
import { startViewTransition } from '@/lib/transition'
import { lookupEntityId, lookupVenueId } from '@/lib/entityIndex'
import { useEntityIdMap, useVenueIdMap } from '@/composables/useEntityIdMap'
import { focusVt, useVtScope } from '@/lib/viewTransitionFocus'

const route = useRoute()
const router = useRouter()

// q + the underlying input live in GlobalBottomNav so the element persists
// across route changes (required for iOS to keep the keyboard up on entry).
const { q } = useGlobalSearch()
q.value = String(route.query.q ?? '')

const qDebounced = refDebounced(q, 250)
// Longer idle than the search debounce so partial keystrokes don't all
// land in Recent — only what the user actually pauses on.
const qForRecent = refDebounced(q, 2000)

const DEFAULT_PER_GROUP = 5
const EXPANDED_PER_GROUP = 50

const empty: SearchAllResults = {
  competitions: { hits: [], total: 0 },
  dancers: { groups: [], total: 0 },
  judges: { groups: [], total: 0 },
  pipers: { groups: [], total: 0 },
  places: { groups: [], total: 0 },
}

const results = shallowRef<SearchAllResults>(empty)
const searching = ref(false)
const error = ref<Error | null>(null)
const expanded = reactive<Record<SearchEntityType, boolean>>({
  competitions: false,
  dancers: false,
  judges: false,
  pipers: false,
  places: false,
})

const locationFilter = useLocationFilter()
const recentSearches = useRecentSearches()
const searchExamples = useSearchExamples()

interface ExampleCardConfig {
  key: 'competitions' | 'venues' | 'places' | 'dancers' | 'judges' | 'pipers'
  label: string
  icon: typeof Calendar
  iconClass: string
}

const exampleCards: ExampleCardConfig[] = [
  {
    key: 'competitions',
    label: 'Competitions',
    icon: Calendar,
    iconClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  },
  {
    key: 'dancers',
    label: 'Dancers',
    icon: User,
    iconClass: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  },
  {
    key: 'judges',
    label: 'Judges',
    icon: Gavel,
    iconClass: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  },
  {
    key: 'pipers',
    label: 'Pipers',
    icon: Music,
    iconClass: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  },
  {
    key: 'venues',
    label: 'Venues',
    icon: School,
    iconClass: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  },
  {
    key: 'places',
    label: 'Places',
    icon: MapPin,
    iconClass: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  },
]

const hasExamples = computed(() =>
  exampleCards.some((c) => searchExamples.examples.value[c.key].length > 0),
)

const suggestionExpanded = reactive<Record<ExampleCardConfig['key'] | 'recent', boolean>>(
  {
    recent: true,
    competitions: true,
    venues: true,
    places: true,
    dancers: true,
    judges: true,
    pipers: true,
  },
)

const hasRecent = computed(() => recentSearches.recent.value.length > 0)
const showSuggestions = computed(
  () => hasRecent.value || hasExamples.value || searchExamples.loading.value,
)

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
  // any change to the typed query resets expansion
  expanded.competitions = false
  expanded.dancers = false
  expanded.judges = false
  expanded.pipers = false
  expanded.places = false
})

// Dedupes back-to-back searches for the same term (e.g. a click fires the
// search instantly, then the debounce watcher fires 250ms later with the
// same value). Reset on error so retries still work.
let lastQueried = ''

async function runSearch(text: string) {
  const trimmed = text.trim()
  if (!trimmed) {
    results.value = empty
    error.value = null
    lastQueried = ''
    return
  }
  if (trimmed === lastQueried) return
  lastQueried = trimmed
  searching.value = true
  error.value = null
  try {
    const out = await searchAll({ q: trimmed, perGroup: DEFAULT_PER_GROUP })
    if (q.value.trim() !== trimmed) return
    results.value = out
  } catch (e) {
    if (q.value.trim() !== trimmed) return
    error.value = e as Error
    results.value = empty
    lastQueried = ''
  } finally {
    if (q.value.trim() === trimmed) searching.value = false
  }
}

watch(qDebounced, (value) => runSearch(value), { immediate: true })

// Suggestion taps shouldn't wait on the typing debounce — fire the search now.
// Wrapped in startViewTransition so the title and back button morph from the
// suggestions state to the results state. (Router replace fires too via the
// `q` watcher, but the router skips VTs on query-only nav, so we drive it
// from here.)
//
// runSearch is called *inside* the VT callback after q.value is set, so its
// internal staleness check (`q.value.trim() !== trimmed`) doesn't trip on a
// stale read. Doing it outside races the VT's deferred mutation and leaves
// `searching = true` if the check bails.
function selectTerm(term: string) {
  startViewTransition(async () => {
    q.value = term
    await nextTick()
    void runSearch(term)
  })
}

async function expandGroup(type: SearchEntityType) {
  const trimmed = q.value.trim()
  if (!trimmed) return
  expanded[type] = true
  try {
    const out = await searchAll({
      q: trimmed,
      perGroup: EXPANDED_PER_GROUP,
      types: [type],
    })
    if (q.value.trim() !== trimmed) return
    results.value = {
      ...results.value,
      [type]: out[type],
    }
  } catch (e) {
    error.value = e as Error
  }
}

// ─── View-transition setup ──────────────────────────────────────────────────
// Each scope's name → aggregate-id map is pre-resolved as results arrive so
// the row's `:style="vt.name(...)"` has a real ID to morph from at click time.
const judgeVt = useVtScope('judge')
const piperVt = useVtScope('piper')
const dancerVt = useVtScope('dancer')
const venueVt = useVtScope('venue')
const judgeIds = useEntityIdMap('judges')
const piperIds = useEntityIdMap('pipers')
const dancerIds = useEntityIdMap('dancers')
const venueIds = useVenueIdMap()

async function handleDancerTap(name: string) {
  const id = dancerIds.get(name) ?? (await lookupEntityId('dancers', name))
  if (!id) return
  dancerIds.map[name] = id
  focusVt('dancer', id)
  await nextTick()
  router.push({ name: 'dancer.info', params: { dancerId: id } })
}

function competitionListItem(hit: SearchCompetitionHit): CompetitionListItem {
  return {
    id: hit.id,
    name: hit.name,
    venue: hit.venue,
    location: hit.location,
    date: hit.date,
    image: hit.image,
  }
}

function placeIcon(kind: SearchPlaceGroup['kind']) {
  if (kind === 'venue') return School
  if (kind === 'region') return MapPinned
  return MapPin
}

function placeCountLabel(count: number) {
  return count === 1 ? '1 competition' : `${count} competitions`
}

async function handleJudgeTap(group: SearchPersonGroup) {
  const id = judgeIds.get(group.name) ?? (await lookupEntityId('judges', group.name))
  if (!id) return
  judgeIds.map[group.name] = id
  focusVt('judge', id)
  await nextTick()
  router.push({ name: 'judge.info', params: { judgeId: id } })
}

async function handlePiperTap(group: SearchPersonGroup) {
  const id = piperIds.get(group.name) ?? (await lookupEntityId('pipers', group.name))
  if (!id) return
  piperIds.map[group.name] = id
  focusVt('piper', id)
  await nextTick()
  router.push({ name: 'piper.info', params: { piperId: id } })
}

async function handlePlaceTap(group: SearchPlaceGroup) {
  if (group.kind === 'venue') {
    const locality = group.locality ?? null
    const id =
      venueIds.get(group.name, locality) ?? (await lookupVenueId(group.name, locality))
    if (!id) return
    focusVt('venue', id)
    await nextTick()
    router.push({ name: 'venue.info', params: { venueId: id } })
    return
  }
  locationFilter.setRegion({
    country: group.country ?? null,
    region: group.region ?? null,
    locality: group.kind === 'locality' ? (group.locality ?? group.name) : null,
  })
  router.push({ name: 'competitions' })
}

// Top-left back: clears the search (mirrors the X in the bottom search bar).
// Only shown when there's a query, so dismissing /search entirely is left to
// the bottom-nav left pill. Wrapped in startViewTransition so the title and
// back button morph between the suggestions/results states.
function onTopBackClick() {
  startViewTransition(async () => {
    q.value = ''
    await nextTick()
  })
}

const hasQuery = computed(() => q.value.trim().length > 0)
// Covers the debounce gap so clicking a suggestion doesn't flash "No matches"
// before the search fires.
const isLoading = computed(
  () => searching.value || (hasQuery.value && q.value.trim() !== qDebounced.value.trim()),
)
const competitions = computed(() => results.value.competitions)
const dancers = computed(() => results.value.dancers)
const judges = computed(() => results.value.judges)
const pipers = computed(() => results.value.pipers)
const places = computed(() => results.value.places)

// Pre-resolve aggregate IDs for visible groups so list rows can render with
// view-transition-names ready at click time (no async gap during morph).
watch(judges, (r) => r.groups.forEach((g) => judgeIds.resolve(g.name)))
watch(pipers, (r) => r.groups.forEach((g) => piperIds.resolve(g.name)))
watch(dancers, (r) => r.groups.forEach((g) => dancerIds.resolve(g.name)))
watch(places, (r) => {
  r.groups.forEach((g) => {
    if (g.kind === 'venue') venueIds.resolve(g.name, g.locality ?? null)
  })
})

const hasAnyResults = computed(
  () =>
    competitions.value.hits.length > 0 ||
    places.value.groups.length > 0 ||
    dancers.value.groups.length > 0 ||
    judges.value.groups.length > 0 ||
    pipers.value.groups.length > 0,
)

// Save to Recent only after the user idles for 2s on a query that yielded
// results — keeps garbage and mid-typing partials out of the list.
watch(qForRecent, (value) => {
  if (!hasAnyResults.value) return
  recentSearches.record(value)
})

// iOS-only workarounds: every other platform respects `position: fixed`
// when the keyboard is up. data-ios on <html> gates the sized-container
// CSS rule below; the listeners drive --vv-height, --nav-bottom, and the
// documentElement scroll lock.
if (isIos) {
  document.documentElement.dataset.ios = ''

  // Mirror visualViewport.height to --vv-height so html tracks the
  // visible area as the keyboard slides in/out.
  const updateVvHeight = () => {
    const vv = window.visualViewport
    if (!vv) return
    document.documentElement.style.setProperty('--vv-height', `${vv.height}px`)
  }
  if (window.visualViewport) {
    useEventListener(window.visualViewport, 'resize', updateVvHeight)
  }
  updateVvHeight()

  // Keyboard up = an input is focused. Collapse --nav-bottom to 0 so the
  // nav sits flush against the keyboard top; restore on blur. Also check
  // initial state — the input is often focused before Search.vue mounts
  // (label-induced focus on home → router.push), so the first focusin
  // event has already fired by the time we subscribe.
  const ae = document.activeElement
  if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement) {
    document.documentElement.style.setProperty('--nav-bottom', '0px')
  }
  useEventListener(
    document,
    'focusin',
    (e) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        document.documentElement.style.setProperty('--nav-bottom', '0px')
      }
    },
    true,
  )
  useEventListener(
    document,
    'focusout',
    (e) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        document.documentElement.style.removeProperty('--nav-bottom')
      }
    },
    true,
  )

  // iOS scrolls documentElement on focus to "reveal" the input even
  // though our input is in fixed bottom chrome. Revert any scroll.
  useEventListener(
    window,
    'scroll',
    () => {
      if (document.documentElement.scrollTop !== 0) {
        document.documentElement.scrollTop = 0
      }
    },
    { passive: true },
  )
}
</script>

<template>
  <div
    data-route="search"
    class="flex flex-1 flex-col pt-2 pb-[calc(var(--chrome-bottom)+1rem)]"
  >
    <nav class="pointer-events-none fixed inset-x-0 top-0 z-30 px-4 pt-(--nav-top)">
      <div class="pointer-events-auto mx-auto flex max-w-3xl justify-between">
        <button
          v-if="hasQuery"
          type="button"
          class="floating-nav flex size-12 shrink-0 items-center justify-center rounded-full transition-opacity [view-transition-name:nav-back] hover:opacity-90"
          title="Clear search"
          aria-label="Clear search"
          @click="onTopBackClick"
        >
          <ChevronLeft class="size-5" />
        </button>
        <TopBackButton v-else />
        <AccountAvatarButton />
      </div>
    </nav>
    <main class="mx-auto flex w-full max-w-3xl flex-1 flex-col space-y-6 p-4">
      <div v-if="error" class="text-destructive text-lg">{{ error.message }}</div>

      <template v-if="hasQuery">
        <div class="px-14">
          <h2
            class="font-serif text-3xl font-medium tracking-tight [view-transition-class:fit] [view-transition-name:search-title]"
          >
            Search results
          </h2>
          <p class="text-muted-foreground truncate text-sm">for “{{ q }}”</p>
        </div>

        <div
          v-if="isLoading && !hasAnyResults"
          class="space-y-6"
          aria-busy="true"
          aria-live="polite"
        >
          <span class="sr-only">Searching…</span>
          <section v-for="i in 3" :key="i" class="space-y-2">
            <Skeleton class="h-4 w-32" />
            <div v-for="j in 3" :key="j" class="flex items-center gap-3 py-3">
              <Skeleton class="size-9 shrink-0 rounded-full!" />
              <div class="flex-1 space-y-2">
                <Skeleton class="h-5 w-2/3" />
                <Skeleton class="h-4 w-1/3" />
              </div>
            </div>
          </section>
        </div>

        <template v-else>
          <div
            v-if="!hasAnyResults && !isLoading"
            class="text-muted-foreground text-lg italic"
          >
            No matches.
          </div>

          <section v-if="competitions.hits.length" class="space-y-2">
            <SectionHeader label="Competitions" :count="competitions.total" />
            <ul>
              <CompetitionRow
                v-for="hit in competitions.hits"
                :key="hit.id"
                :competition="competitionListItem(hit)"
                :to="{ name: 'competition.info', params: { competitionId: hit.id } }"
              />
            </ul>
            <button
              v-if="
                !expanded.competitions && competitions.total > competitions.hits.length
              "
              type="button"
              class="text-primary hover:text-primary/80 px-1 py-2 text-sm font-medium"
              @click="expandGroup('competitions')"
            >
              See all {{ competitions.total }} →
            </button>
          </section>

          <section v-if="places.groups.length" class="space-y-2">
            <SectionHeader label="Places" :count="places.total" />
            <ul>
              <li v-for="group in places.groups" :key="`${group.kind}:${group.name}`">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 px-1 py-3 text-left"
                  @click="handlePlaceTap(group)"
                >
                  <span
                    :class="[
                      'flex size-9 shrink-0 items-center justify-center rounded-full [view-transition-class:nav-avatar]',
                      group.kind === 'venue' &&
                        'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
                      group.kind === 'locality' &&
                        'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
                      group.kind === 'region' &&
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
                    ]"
                    :style="
                      group.kind === 'venue'
                        ? {
                            viewTransitionName: venueVt.name(
                              venueIds.get(group.name, group.locality ?? null),
                              'avatar',
                            ),
                          }
                        : undefined
                    "
                  >
                    <component :is="placeIcon(group.kind)" class="size-4" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <div
                      class="text-item-title truncate [view-transition-class:fit_nav-title]"
                      :style="
                        group.kind === 'venue'
                          ? {
                              viewTransitionName: venueVt.name(
                                venueIds.get(group.name, group.locality ?? null),
                                'name',
                              ),
                            }
                          : undefined
                      "
                    >
                      {{ group.name }}
                    </div>
                    <div class="text-item-subtitle text-muted-foreground truncate">
                      <span v-if="group.parentLabel">{{ group.parentLabel }} · </span>
                      <span>{{ placeCountLabel(group.count) }}</span>
                    </div>
                  </div>
                  <ChevronRight class="text-muted-foreground size-4 shrink-0" />
                </button>
              </li>
            </ul>
            <button
              v-if="!expanded.places && places.total > places.groups.length"
              type="button"
              class="text-primary hover:text-primary/80 px-1 py-2 text-sm font-medium"
              @click="expandGroup('places')"
            >
              See all {{ places.total }} →
            </button>
          </section>

          <section v-if="dancers.groups.length" class="space-y-2">
            <SectionHeader label="Dancers" :count="dancers.total" />
            <ul>
              <li v-for="group in dancers.groups" :key="group.name">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 px-1 py-3 text-left"
                  @click="handleDancerTap(group.name)"
                >
                  <span
                    class="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-medium [view-transition-class:nav-avatar]"
                    :style="{
                      viewTransitionName: dancerVt.name(
                        dancerIds.get(group.name),
                        'avatar',
                      ),
                    }"
                  >
                    {{ group.initials }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div
                      class="text-item-title truncate [view-transition-class:fit_nav-title]"
                      :style="{
                        viewTransitionName: dancerVt.name(
                          dancerIds.get(group.name),
                          'name',
                        ),
                      }"
                    >
                      {{ group.name || '?' }}
                    </div>
                    <div
                      v-if="group.location"
                      class="text-item-subtitle text-muted-foreground truncate"
                    >
                      {{ group.location }}
                    </div>
                  </div>
                  <ChevronRight class="text-muted-foreground size-4 shrink-0" />
                </button>
              </li>
            </ul>
            <button
              v-if="!expanded.dancers && dancers.total > dancers.groups.length"
              type="button"
              class="text-primary hover:text-primary/80 px-1 py-2 text-sm font-medium"
              @click="expandGroup('dancers')"
            >
              See all {{ dancers.total }} →
            </button>
          </section>

          <section v-if="judges.groups.length" class="space-y-2">
            <SectionHeader label="Judges" :count="judges.total" />
            <ul>
              <li
                v-for="group in judges.groups"
                :key="group.name + group.competitionIds[0]"
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-3 px-1 py-3 text-left"
                  @click="handleJudgeTap(group)"
                >
                  <span
                    v-if="group.image"
                    class="size-9 shrink-0 overflow-hidden rounded-full [view-transition-class:nav-avatar]"
                    :style="{
                      viewTransitionName: judgeVt.name(
                        judgeIds.get(group.name),
                        'avatar',
                      ),
                    }"
                  >
                    <img
                      :src="group.image"
                      :alt="group.name"
                      class="size-full object-cover"
                    />
                  </span>
                  <span
                    v-else
                    class="bg-secondary text-secondary-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-medium [view-transition-class:nav-avatar]"
                    :style="{
                      viewTransitionName: judgeVt.name(
                        judgeIds.get(group.name),
                        'avatar',
                      ),
                    }"
                  >
                    {{ group.initials }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div
                      class="text-item-title truncate [view-transition-class:fit_nav-title]"
                      :style="{
                        viewTransitionName: judgeVt.name(
                          judgeIds.get(group.name),
                          'name',
                        ),
                      }"
                    >
                      {{ group.name || '?' }}
                    </div>
                    <div
                      v-if="group.location || group.competitionIds.length > 1"
                      class="text-item-subtitle text-muted-foreground truncate"
                    >
                      <span v-if="group.location">{{ group.location }}</span>
                      <span v-if="group.location && group.competitionIds.length > 1">
                        ·
                      </span>
                      <span v-if="group.competitionIds.length > 1">
                        {{ group.competitionIds.length }} competitions
                      </span>
                    </div>
                  </div>
                  <ChevronRight class="text-muted-foreground size-4 shrink-0" />
                </button>
              </li>
            </ul>
            <button
              v-if="!expanded.judges && judges.total > judges.groups.length"
              type="button"
              class="text-primary hover:text-primary/80 px-1 py-2 text-sm font-medium"
              @click="expandGroup('judges')"
            >
              See all {{ judges.total }} →
            </button>
          </section>

          <section v-if="pipers.groups.length" class="space-y-2">
            <SectionHeader label="Pipers" :count="pipers.total" />
            <ul>
              <li
                v-for="group in pipers.groups"
                :key="group.name + group.competitionIds[0]"
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-3 px-1 py-3 text-left"
                  @click="handlePiperTap(group)"
                >
                  <span
                    v-if="group.image"
                    class="size-9 shrink-0 overflow-hidden rounded-full [view-transition-class:nav-avatar]"
                    :style="{
                      viewTransitionName: piperVt.name(
                        piperIds.get(group.name),
                        'avatar',
                      ),
                    }"
                  >
                    <img
                      :src="group.image"
                      :alt="group.name"
                      class="size-full object-cover"
                    />
                  </span>
                  <span
                    v-else
                    class="bg-secondary text-secondary-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-medium [view-transition-class:nav-avatar]"
                    :style="{
                      viewTransitionName: piperVt.name(
                        piperIds.get(group.name),
                        'avatar',
                      ),
                    }"
                  >
                    {{ group.initials }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div
                      class="text-item-title truncate [view-transition-class:fit_nav-title]"
                      :style="{
                        viewTransitionName: piperVt.name(
                          piperIds.get(group.name),
                          'name',
                        ),
                      }"
                    >
                      {{ group.name || '?' }}
                    </div>
                    <div
                      v-if="group.location || group.competitionIds.length > 1"
                      class="text-item-subtitle text-muted-foreground truncate"
                    >
                      <span v-if="group.location">{{ group.location }}</span>
                      <span v-if="group.location && group.competitionIds.length > 1">
                        ·
                      </span>
                      <span v-if="group.competitionIds.length > 1">
                        {{ group.competitionIds.length }} competitions
                      </span>
                    </div>
                  </div>
                  <ChevronRight class="text-muted-foreground size-4 shrink-0" />
                </button>
              </li>
            </ul>
            <button
              v-if="!expanded.pipers && pipers.total > pipers.groups.length"
              type="button"
              class="text-primary hover:text-primary/80 px-1 py-2 text-sm font-medium"
              @click="expandGroup('pipers')"
            >
              See all {{ pipers.total }} →
            </button>
          </section>
        </template>
      </template>

      <template v-else>
        <div class="flex flex-1 flex-col gap-6">
          <section v-if="showSuggestions" class="space-y-2">
            <h2
              class="px-14 font-serif text-3xl font-medium tracking-tight [view-transition-class:fit] [view-transition-name:search-title]"
            >
              Suggestions
            </h2>

            <section v-if="hasRecent" class="space-y-1">
              <DisclosureHeader
                label="Recent"
                :expanded="suggestionExpanded.recent"
                @toggle="suggestionExpanded.recent = !suggestionExpanded.recent"
              >
                <button
                  type="button"
                  class="text-muted-foreground hover:text-foreground font-sans text-sm font-normal tracking-normal normal-case"
                  @click.stop="recentSearches.clear()"
                >
                  Clear
                </button>
              </DisclosureHeader>
              <SmoothCollapse :open="suggestionExpanded.recent">
                <ul>
                  <li
                    v-for="term in recentSearches.recent.value"
                    :key="term"
                    class="flex items-center"
                  >
                    <button
                      type="button"
                      class="hover:bg-accent flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1.5 text-left"
                      @click="selectTerm(term)"
                    >
                      <span
                        class="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300"
                      >
                        <History class="size-3.5" />
                      </span>
                      <div class="text-item-title min-w-0 flex-1 truncate">
                        “{{ term }}”
                      </div>
                    </button>
                    <button
                      type="button"
                      class="text-muted-foreground hover:bg-accent hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-full"
                      :aria-label="`Remove ${term} from recent`"
                      @click="recentSearches.remove(term)"
                    >
                      <X class="size-4" />
                    </button>
                  </li>
                </ul>
              </SmoothCollapse>
            </section>

            <template v-for="card in exampleCards" :key="card.key">
              <section
                v-if="
                  searchExamples.examples.value[card.key].length ||
                  searchExamples.loading.value
                "
                class="space-y-1"
              >
                <DisclosureHeader
                  :label="card.label"
                  :expanded="suggestionExpanded[card.key]"
                  @toggle="suggestionExpanded[card.key] = !suggestionExpanded[card.key]"
                />
                <SmoothCollapse :open="suggestionExpanded[card.key]">
                  <ul
                    v-if="
                      searchExamples.examples.value[card.key].length &&
                      !searchExamples.loading.value
                    "
                  >
                    <li
                      v-for="term in searchExamples.examples.value[card.key]"
                      :key="term"
                    >
                      <button
                        type="button"
                        class="hover:bg-accent flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left"
                        @click="selectTerm(term)"
                      >
                        <span
                          :class="[
                            'flex size-8 shrink-0 items-center justify-center rounded-full',
                            card.iconClass,
                          ]"
                        >
                          <component :is="card.icon" class="size-3.5" />
                        </span>
                        <div class="text-item-title min-w-0 flex-1 truncate">
                          “{{ term }}”
                        </div>
                      </button>
                    </li>
                  </ul>
                  <ul v-else aria-hidden="true">
                    <li
                      v-for="i in 3"
                      :key="i"
                      class="flex w-full items-center gap-3 px-1 py-1.5"
                    >
                      <Skeleton class="size-8 shrink-0 rounded-full!" />
                      <Skeleton
                        :class="['h-5', i === 1 ? 'w-2/3' : i === 2 ? 'w-1/2' : 'w-3/5']"
                      />
                    </li>
                  </ul>
                </SmoothCollapse>
              </section>
            </template>
          </section>
        </div>
      </template>
    </main>
  </div>
</template>

<style>
@reference '../style.css';

html[data-ios]:has([data-route='search']) {
  position: relative;
  height: var(--vv-height);
  overflow: hidden;
}
html[data-ios]:has([data-route='search']) body {
  height: 100%;
  overflow-y: auto;
}
</style>
