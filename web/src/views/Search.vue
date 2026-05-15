<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { refDebounced } from '@vueuse/core'
import {
  Building,
  Calendar,
  Calendars,
  ChevronRight,
  Gavel,
  History,
  Home,
  Map as MapIcon,
  MapPin,
  Search as SearchIcon,
  User,
  Users,
  X,
} from '@lucide/vue'
import SectionHeader from '@/components/SectionHeader.vue'
import DisclosureHeader from '@/components/DisclosureHeader.vue'
import SmoothCollapse from '@/components/SmoothCollapse.vue'
import Skeleton from '@/components/Skeleton.vue'
import CompetitionRow from '@/components/CompetitionRow.vue'
import {
  searchAll,
  type SearchAllResults,
  type SearchEntityType,
  type SearchCompetitionHit,
  type SearchLocationGroup,
} from '@/lib/searchAll'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import { useVtScope } from '@/lib/viewTransitionFocus'
import { useLocationFilter } from '@/composables/useLocationFilter'
import { useRecentSearches } from '@/composables/useRecentSearches'
import { useSearchExamples } from '@/composables/useSearchExamples'
import { backPath, preferBackClick } from '@/lib/smartBack'

const vt = useVtScope('dancer')

const route = useRoute()
const router = useRouter()
const inputEl = ref<HTMLInputElement | null>(null)

const q = ref(String(route.query.q ?? ''))
const qDebounced = refDebounced(q, 250)

const DEFAULT_PER_GROUP = 5
const EXPANDED_PER_GROUP = 50

const empty: SearchAllResults = {
  competitions: { hits: [], total: 0 },
  dancers: { groups: [], total: 0 },
  judges: { groups: [], total: 0 },
  locations: { groups: [], total: 0 },
}

const results = shallowRef<SearchAllResults>(empty)
const searching = ref(false)
const error = ref<Error | null>(null)
const expanded = reactive<Record<SearchEntityType, boolean>>({
  competitions: false,
  dancers: false,
  judges: false,
  locations: false,
})

const locationFilter = useLocationFilter()
const recentSearches = useRecentSearches()
const searchExamples = useSearchExamples()

interface ExampleCardConfig {
  key: 'competitions' | 'places' | 'dancers' | 'judges'
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
]

const hasExamples = computed(() =>
  exampleCards.some((c) => searchExamples.examples.value[c.key].length > 0),
)

const suggestionExpanded = reactive<Record<ExampleCardConfig['key'] | 'recent', boolean>>({
  recent: true,
  competitions: true,
  places: true,
  dancers: true,
  judges: true,
})

const hasRecent = computed(() => recentSearches.recent.value.length > 0)
const showSuggestions = computed(
  () => hasRecent.value || hasExamples.value || searchExamples.loading.value,
)

// Pick the back-button destination from history. /search is a leaf — the
// history.back entry doesn't change while we're here, so resolving once at
// setup is enough.
const backInfo = (() => {
  const back = backPath()
  if (back === '/') {
    return {
      icon: Home,
      label: 'Back to Home',
      to: { name: 'home' as const },
    }
  }
  if (back && back.startsWith('/dancers')) {
    return {
      icon: Users,
      label: 'Back to Dancers',
      to: { name: 'dancers' as const },
    }
  }
  return {
    icon: Calendars,
    label: 'Back to Competitions',
    to: { name: 'competitions' as const },
  }
})()

onMounted(() => inputEl.value?.focus())

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
  expanded.locations = false
})

async function runSearch(text: string) {
  const trimmed = text.trim()
  if (!trimmed) {
    results.value = empty
    error.value = null
    return
  }
  searching.value = true
  error.value = null
  try {
    const out = await searchAll({ q: trimmed, perGroup: DEFAULT_PER_GROUP })
    if (q.value.trim() !== trimmed) return
    results.value = out
    recentSearches.record(trimmed)
  } catch (e) {
    if (q.value.trim() !== trimmed) return
    error.value = e as Error
    results.value = empty
  } finally {
    if (q.value.trim() === trimmed) searching.value = false
  }
}

watch(qDebounced, (value) => runSearch(value), { immediate: true })

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

function clearSearch() {
  q.value = ''
  inputEl.value?.focus()
}

function locationIcon(kind: SearchLocationGroup['kind']) {
  if (kind === 'venue') return Building
  if (kind === 'region') return MapIcon
  return MapPin
}

function locationCountLabel(count: number) {
  return count === 1 ? '1 competition' : `${count} competitions`
}

function handleLocationTap(group: SearchLocationGroup) {
  if (group.kind === 'venue') {
    router.push({
      name: 'competition.info',
      params: { competitionId: group.sampleCompId },
    })
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
const competitions = computed(() => results.value.competitions)
const dancers = computed(() => results.value.dancers)
const judges = computed(() => results.value.judges)
const locations = computed(() => results.value.locations)

const hasAnyResults = computed(
  () =>
    competitions.value.hits.length > 0 ||
    locations.value.groups.length > 0 ||
    dancers.value.groups.length > 0 ||
    judges.value.groups.length > 0,
)
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1rem)]">
    <main class="mx-auto flex w-full max-w-3xl flex-1 flex-col space-y-6 p-4">
      <div v-if="error" class="text-destructive text-lg">{{ error.message }}</div>

      <template v-if="hasQuery">
        <div
          v-if="searching && !hasAnyResults"
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
            v-if="!hasAnyResults && !searching"
            class="text-muted-foreground text-lg italic"
          >
            Nothing matches “{{ q }}”.
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
                  class="hover:bg-accent flex w-full items-center gap-3 rounded-lg px-1 py-3 text-left"
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
                <RouterLink
                  :to="{
                    name: 'competition.info',
                    params: { competitionId: group.competitionIds[0] },
                  }"
                  class="flex w-full items-center gap-3 px-1 py-3 text-left"
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
                      v-if="group.location"
                      class="text-item-subtitle text-muted-foreground truncate"
                    >
                      {{ group.location }}
                    </div>
                  </div>
                  <ChevronRight class="text-muted-foreground size-4 shrink-0" />
                </RouterLink>
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
        </template>
      </template>

      <template v-else>
        <div class="flex flex-1 flex-col gap-6">
          <section v-if="showSuggestions" class="space-y-2">
            <h2 class="font-serif text-3xl font-medium tracking-tight">Suggestions</h2>

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
                      @click="q = term"
                    >
                      <span
                        class="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300"
                      >
                        <History class="size-3.5" />
                      </span>
                      <div class="text-item-title min-w-0 flex-1 truncate">
                        {{ term }}
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
                        @click="q = term"
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
                          {{ term }}
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

    <nav class="pointer-events-none fixed inset-x-0 bottom-(--nav-bottom) z-30 px-4">
      <div class="mx-auto flex max-w-3xl items-center gap-2">
        <RouterLink v-slot="{ href, navigate }" :to="backInfo.to" custom>
          <a
            :href="href"
            class="bg-nav/90 text-nav-foreground pointer-events-auto flex size-16 shrink-0 items-center justify-center rounded-full shadow-lg backdrop-blur-xl [view-transition-class:clip] [view-transition-name:nav-left] hover:opacity-90"
            :title="backInfo.label"
            :aria-label="backInfo.label"
            @click="preferBackClick(router, $event, navigate)"
          >
            <span class="[view-transition-name:match-element]">
              <component :is="backInfo.icon" class="size-5" />
            </span>
          </a>
        </RouterLink>

        <div
          class="bg-nav/90 text-nav-foreground pointer-events-auto flex h-16 min-w-0 flex-1 items-center gap-2 rounded-full px-5 shadow-lg backdrop-blur-xl [view-transition-class:clip] [view-transition-name:nav-right]"
        >
          <SearchIcon
            class="size-5 shrink-0 opacity-80 [view-transition-name:nav-right-icon]"
          />
          <input
            ref="inputEl"
            v-model="q"
            type="search"
            placeholder="Search"
            class="placeholder:text-nav-foreground/50 min-w-0 flex-1 bg-transparent text-base focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          <button
            v-if="q"
            type="button"
            class="text-nav-foreground/70 hover:text-nav-foreground flex size-7 shrink-0 items-center justify-center rounded-full"
            title="Clear"
            aria-label="Clear search"
            @click="clearSearch"
          >
            <X class="size-5" />
          </button>
        </div>
      </div>
    </nav>
  </div>
</template>
