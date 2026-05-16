<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { refDebounced, useEventListener } from '@vueuse/core'
import {
  Building,
  Calendar,
  ChevronRight,
  Gavel,
  History,
  Map as MapIcon,
  MapPin,
  Music,
  User,
  X,
} from '@lucide/vue'
import SectionHeader from '@/components/SectionHeader.vue'
import DisclosureHeader from '@/components/DisclosureHeader.vue'
import SmoothCollapse from '@/components/SmoothCollapse.vue'
import Skeleton from '@/components/Skeleton.vue'
import CompetitionRow from '@/components/CompetitionRow.vue'
import CompetitionPickerSheet from '@/components/CompetitionPickerSheet.vue'
import AccountAvatarButton from '@/components/AccountAvatarButton.vue'
import {
  searchAll,
  type SearchAllResults,
  type SearchEntityType,
  type SearchCompetitionHit,
  type SearchLocationGroup,
  type SearchPersonGroup,
} from '@/lib/searchAll'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import { useVtScope } from '@/lib/viewTransitionFocus'
import { useLocationFilter } from '@/composables/useLocationFilter'
import { useRecentSearches } from '@/composables/useRecentSearches'
import { useSearchExamples } from '@/composables/useSearchExamples'
import { useGlobalSearch } from '@/composables/useGlobalSearch'
import { isIos } from '@/lib/platform'

const vt = useVtScope('dancer')

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
  locations: { groups: [], total: 0 },
}

const results = shallowRef<SearchAllResults>(empty)
const searching = ref(false)
const error = ref<Error | null>(null)
const expanded = reactive<Record<SearchEntityType, boolean>>({
  competitions: false,
  dancers: false,
  judges: false,
  pipers: false,
  locations: false,
})

const locationFilter = useLocationFilter()
const recentSearches = useRecentSearches()
const searchExamples = useSearchExamples()

interface ExampleCardConfig {
  key: 'competitions' | 'places' | 'dancers' | 'judges' | 'pipers'
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
    key: 'places',
    label: 'Places',
    icon: MapPin,
    iconClass: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
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
]

const hasExamples = computed(() =>
  exampleCards.some((c) => searchExamples.examples.value[c.key].length > 0),
)

const suggestionExpanded = reactive<Record<ExampleCardConfig['key'] | 'recent', boolean>>(
  {
    recent: true,
    competitions: true,
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
  expanded.locations = false
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
function selectTerm(term: string) {
  q.value = term
  runSearch(term)
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

function dancerSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
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

function locationIcon(kind: SearchLocationGroup['kind']) {
  if (kind === 'venue') return Building
  if (kind === 'region') return MapIcon
  return MapPin
}

function locationCountLabel(count: number) {
  return count === 1 ? '1 competition' : `${count} competitions`
}

interface PickerState {
  title: string
  subtitle: string
  icon: typeof Gavel | typeof Building | typeof Music
  competitionIds: string[]
}
const picker = ref<PickerState | null>(null)

function handleJudgeTap(group: SearchPersonGroup) {
  const ids = group.competitionIds
  if (ids.length === 1) {
    router.push({ name: 'competition.info', params: { competitionId: ids[0] } })
    return
  }
  picker.value = {
    title: group.name || 'Judge',
    subtitle: `${ids.length} competitions`,
    icon: Gavel,
    competitionIds: ids,
  }
}

function handlePiperTap(group: SearchPersonGroup) {
  const ids = group.competitionIds
  if (ids.length === 1) {
    router.push({ name: 'competition.info', params: { competitionId: ids[0] } })
    return
  }
  picker.value = {
    title: group.name || 'Piper',
    subtitle: `${ids.length} competitions`,
    icon: Music,
    competitionIds: ids,
  }
}

function handleLocationTap(group: SearchLocationGroup) {
  if (group.kind === 'venue') {
    const ids = group.competitionIds.length
      ? group.competitionIds
      : [group.sampleCompId]
    if (ids.length === 1) {
      router.push({ name: 'competition.info', params: { competitionId: ids[0] } })
      return
    }
    picker.value = {
      title: group.name,
      subtitle: `${ids.length} competitions`,
      icon: Building,
      competitionIds: ids,
    }
    return
  }
  locationFilter.setRegion({
    country: group.country ?? null,
    region: group.region ?? null,
    locality: group.kind === 'locality' ? (group.locality ?? group.name) : null,
  })
  router.push({ name: 'competitions' })
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
const locations = computed(() => results.value.locations)

const hasAnyResults = computed(
  () =>
    competitions.value.hits.length > 0 ||
    locations.value.groups.length > 0 ||
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        document.documentElement.style.setProperty('--nav-bottom', '0px')
      }
    },
    true,
  )
  useEventListener(
    document,
    'focusout',
    (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
      <div class="pointer-events-auto mx-auto flex max-w-3xl justify-end">
        <AccountAvatarButton />
      </div>
    </nav>
    <main class="mx-auto flex w-full max-w-3xl flex-1 flex-col space-y-6 p-4">
      <div v-if="error" class="text-destructive text-lg">{{ error.message }}</div>

      <template v-if="hasQuery">
        <div class="pr-14">
          <h2 class="font-serif text-3xl font-medium tracking-tight">Search results</h2>
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

          <section v-if="locations.groups.length" class="space-y-2">
            <SectionHeader label="Locations" :count="locations.total" />
            <ul>
              <li v-for="group in locations.groups" :key="`${group.kind}:${group.name}`">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 px-1 py-3 text-left"
                  @click="handleLocationTap(group)"
                >
                  <span
                    :class="[
                      'flex size-9 shrink-0 items-center justify-center rounded-full',
                      group.kind === 'venue' &&
                        'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
                      group.kind === 'locality' &&
                        'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
                      group.kind === 'region' &&
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
                    ]"
                  >
                    <component :is="locationIcon(group.kind)" class="size-4" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="text-item-title truncate">
                      {{ group.name }}
                    </div>
                    <div class="text-item-subtitle text-muted-foreground truncate">
                      <span v-if="group.parentLabel">{{ group.parentLabel }} · </span>
                      <span>{{ locationCountLabel(group.count) }}</span>
                    </div>
                  </div>
                  <ChevronRight class="text-muted-foreground size-4 shrink-0" />
                </button>
              </li>
            </ul>
            <button
              v-if="!expanded.locations && locations.total > locations.groups.length"
              type="button"
              class="text-primary hover:text-primary/80 px-1 py-2 text-sm font-medium"
              @click="expandGroup('locations')"
            >
              See all {{ locations.total }} →
            </button>
          </section>

          <section v-if="dancers.groups.length" class="space-y-2">
            <SectionHeader label="Dancers" :count="dancers.total" />
            <ul>
              <li v-for="group in dancers.groups" :key="group.name">
                <RouterLink
                  v-slot="{ href, navigate }"
                  :to="{
                    name: 'dancer.info',
                    params: { dancerId: dancerSlug(group.name) },
                  }"
                  custom
                >
                  <a
                    :href="href"
                    class="flex w-full items-center gap-3 px-1 py-3 text-left"
                    @click="vt.onNavigate($event, navigate, dancerSlug(group.name))"
                  >
                    <span
                      class="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-medium [view-transition-class:nav-avatar]"
                      :style="{
                        viewTransitionName: vt.name(dancerSlug(group.name), 'avatar'),
                      }"
                    >
                      {{ group.initials }}
                    </span>
                    <div class="min-w-0 flex-1">
                      <div
                        class="text-item-title truncate [view-transition-class:fit_nav-title]"
                        :style="{
                          viewTransitionName: vt.name(dancerSlug(group.name), 'name'),
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
                  </a>
                </RouterLink>
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
                    class="size-9 shrink-0 overflow-hidden rounded-full"
                  >
                    <img
                      :src="group.image"
                      :alt="group.name"
                      class="size-full object-cover"
                    />
                  </span>
                  <span
                    v-else
                    class="bg-secondary text-secondary-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-medium"
                  >
                    {{ group.initials }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="text-item-title truncate">
                      {{ group.name || '?' }}
                    </div>
                    <div
                      v-if="group.location || group.competitionIds.length > 1"
                      class="text-item-subtitle text-muted-foreground truncate"
                    >
                      <span v-if="group.location">{{ group.location }}</span>
                      <span v-if="group.location && group.competitionIds.length > 1"> · </span>
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
                    class="size-9 shrink-0 overflow-hidden rounded-full"
                  >
                    <img
                      :src="group.image"
                      :alt="group.name"
                      class="size-full object-cover"
                    />
                  </span>
                  <span
                    v-else
                    class="bg-secondary text-secondary-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-medium"
                  >
                    {{ group.initials }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="text-item-title truncate">
                      {{ group.name || '?' }}
                    </div>
                    <div
                      v-if="group.location || group.competitionIds.length > 1"
                      class="text-item-subtitle text-muted-foreground truncate"
                    >
                      <span v-if="group.location">{{ group.location }}</span>
                      <span v-if="group.location && group.competitionIds.length > 1"> · </span>
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
            <h2 class="pr-14 font-serif text-3xl font-medium tracking-tight">
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

    <CompetitionPickerSheet
      :open="picker !== null"
      :title="picker?.title ?? ''"
      :subtitle="picker?.subtitle"
      :icon="picker?.icon"
      :competition-ids="picker?.competitionIds ?? []"
      @close="picker = null"
    />
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
