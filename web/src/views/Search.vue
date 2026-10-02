<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { refDebounced } from '@vueuse/core'
import { ChevronRight, CloudOff, Hash, LoaderCircle, MapPin, Search, SearchX, User, X } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import Button from '@/components/ui/Button.vue'
import Segmented from '@/components/ui/Segmented.vue'
import Avatar from '@/components/Avatar.vue'
import CompetitionDateRow from '@/components/CompetitionDateRow.vue'
import EmptyState from '@/components/EmptyState.vue'
import FollowButton from '@/components/FollowButton.vue'
import NumberCard from '@/components/NumberCard.vue'
import Skeleton from '@/components/Skeleton.vue'
import CompetitionPicker from '@/components/search/CompetitionPicker.vue'
import SearchStart from '@/components/search/SearchStart.vue'
import { useCompetitionChoices } from '@/components/search/useCompetitionChoices'
import { useScrolledPast } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import { useCompetitions } from '@/composables/useCompetitions'
import { useFollowing } from '@/composables/useFollowing'
import { useRecentSearches } from '@/composables/useRecentSearches'
import { useLocationFilter } from '@/composables/useLocationFilter'
import { useFavoritesStore } from '@/stores/favorites'
import { fetchDancers } from '@/lib/competitionData'
import { lookupEntityId, lookupVenueId } from '@/lib/entityIndex'
import { settle } from '@/lib/settle'
import {
  searchAll,
  type SearchAllResults,
  type SearchEntityType,
    type SearchPlaceGroup,
} from '@/lib/searchAll'
import type { EnrichedDancer } from '@/types/competition'

usePageTitle(['Search'])

const route = useRoute()
const router = useRouter()
const following = useFollowing()
const favorites = useFavoritesStore()
const recentSearches = useRecentSearches()
const locationFilter = useLocationFilter()

const titleEl = ref<HTMLElement | null>(null)
const scrolledPast = useScrolledPast(titleEl)

type Mode = 'name' | 'number'
const MODES = [
  { value: 'name', label: 'By name' },
  { value: 'number', label: 'By number' },
] as const
const mode = ref<Mode>(route.query.by === 'number' ? 'number' : 'name')

// ─── By name (every competition) ────────────────────────────────────────────
const q = ref(String(route.query.q ?? ''))
const qDebounced = refDebounced(q, 250)
const qForRecent = refDebounced(q, 2000)
watch(q, (v) => router.replace({ query: { ...route.query, q: v || undefined } }))
watch(qForRecent, (v) => v.trim().length > 2 && recentSearches.record(v))

const empty: SearchAllResults = {
  competitions: { hits: [], total: 0 },
  dancers: { groups: [], total: 0 },
  judges: { groups: [], total: 0 },
  pipers: { groups: [], total: 0 },
  places: { groups: [], total: 0 },
}
const results = shallowRef<SearchAllResults>(empty)
const searching = ref(false)
const failed = ref(false)

async function run(text: string, perGroup = 5, types?: SearchEntityType[]) {
  const t = text.trim()
  if (!t) {
    results.value = empty
    failed.value = false
    return
  }
  searching.value = true
  failed.value = false
  try {
    const out = await searchAll({ q: t, perGroup, types })
    if (q.value.trim() !== t) return
    results.value = types ? { ...results.value, ...Object.fromEntries(types.map((k) => [k, out[k]])) } : out
  } catch {
    if (q.value.trim() !== t) return
    failed.value = true
    results.value = empty
  } finally {
    if (q.value.trim() === t) searching.value = false
  }
}
watch(qDebounced, (v) => run(v), { immediate: true })

const hasQuery = computed(() => q.value.trim().length > 0)
const loadingName = computed(() => searching.value || (hasQuery.value && q.value.trim() !== qDebounced.value.trim()))
const nothing = computed(() => {
  const r = results.value
  return (
    !r.dancers.groups.length &&
    !r.competitions.hits.length &&
    !r.judges.groups.length &&
    !r.pipers.groups.length &&
    !r.places.groups.length
  )
})

// Search finds people and venues by name; their pages go by id. Look the
// ids up as soon as results arrive, so each row is a real link by the time
// it's tapped. One tapped sooner holds its press and spins until it can go.
type PersonType = 'dancers' | 'judges' | 'pipers'
const ids = ref<Record<string, string | null>>({})
const keyOf = (type: PersonType | 'venues', name: string) => `${type}:${name}`
const lookup = (type: PersonType | 'venues', name: string, locality?: string | null) =>
  type === 'venues' ? lookupVenueId(name, locality ?? null) : lookupEntityId(type, name)
watch(results, (r) => {
  const wanted: ReadonlyArray<readonly [PersonType | 'venues', string, string | null | undefined]> = [
    ...(['dancers', 'judges', 'pipers'] as const).flatMap((t) => r[t].groups.map((g) => [t, g.name, null] as const)),
    ...r.places.groups.filter((g) => g.kind === 'venue').map((g) => ['venues', g.name, g.locality] as const),
  ]
  for (const [type, name, locality] of wanted) {
    const key = keyOf(type, name)
    if (key in ids.value) continue
    void lookup(type, name, locality).then((id) => (ids.value = { ...ids.value, [key]: id }))
  }
})
const ROUTES = {
  dancers: ['dancer.info', 'dancerId'],
  judges: ['judge.info', 'judgeId'],
  pipers: ['piper.info', 'piperId'],
  venues: ['venue.info', 'venueId'],
} as const
function linkTo(type: PersonType | 'venues', name: string) {
  const id = ids.value[keyOf(type, name)]
  return id ? { name: ROUTES[type][0], params: { [ROUTES[type][1]]: id } } : null
}
const opening = ref<string | null>(null)
async function openLate(type: PersonType | 'venues', name: string, locality?: string | null) {
  const key = keyOf(type, name)
  opening.value = key
  const id = await lookup(type, name, locality)
  if (opening.value !== key) return
  opening.value = null
  if (id) router.push({ name: ROUTES[type][0], params: { [ROUTES[type][1]]: id } })
}

function openArea(g: SearchPlaceGroup) {
  locationFilter.setRegion({
    country: g.country ?? null,
    region: g.region ?? null,
    locality: g.kind === 'locality' ? (g.locality ?? g.name) : null,
  })
  router.push({ name: 'competitions' })
}

// ─── By number (one competition) ────────────────────────────────────────────
// Numbers change at every competition, so number search always looks inside
// one: the likeliest, on today or else the nearest (yours first on a tie).
const { competitions, loading: competitionsLoading } = useCompetitions(ref(false))
// Read whenever it can show: number search, or the competition on today
// before anything's typed.
const choices = useCompetitionChoices(competitions, computed(() => mode.value === 'number' || !hasQuery.value))
const competitionId = ref<string>(String(route.query.in ?? ''))
// A link's competition, or one picked here, stays put. Otherwise the choice
// follows the likeliest as more becomes known (a schedule saying a
// competition is still on, your dancers' entries), until a number is typed.
const chosen = ref(!!competitionId.value)
watch(
  choices,
  (list) => {
    if (!list.length) return
    // An old link's competition that isn't on any more falls back too.
    if (!list.some((c) => c.id === competitionId.value)) chosen.value = false
    if (!chosen.value) competitionId.value = list[0].id
  },
  { immediate: true },
)
function choose(id: string) {
  competitionId.value = id
  chosen.value = true
}
const todayChoice = computed(() => choices.value.find((c) => c.today) ?? null)
function searchByNumber(id?: string) {
  if (id) choose(id)
  mode.value = 'number'
}
// Digits typed into name search: offer to look them up as a number.
const digits = computed(() => (/^\d{1,5}$/.test(q.value.trim()) ? q.value.trim() : null))
function numberFromName() {
  num.value = digits.value ?? ''
  mode.value = 'number'
}
// The address keeps the mode and, for number search, the competition. One
// watcher, so two replaces from the same old query can't undo each other.
watch([mode, competitionId], ([m, id]) =>
  router.replace({
    query: { ...route.query, by: m === 'number' ? 'number' : undefined, in: (m === 'number' && id) || undefined },
  }),
)

// A big competition's dancer list is a heavy read: only once number search is used.
const entries = shallowRef<EnrichedDancer[]>([])
const loadingEntries = ref(false)
watch(
  [competitionId, mode],
  async ([id, m]) => {
    if (m !== 'number') return
    entries.value = []
    if (!id) return
    loadingEntries.value = true
    try {
      const b = await fetchDancers(id)
      if (id === competitionId.value) entries.value = b.dancers
    } catch {
      entries.value = []
    } finally {
      if (id === competitionId.value) loadingEntries.value = false
    }
  },
  { immediate: true },
)

const num = ref('')
watch(num, (n) => n && (chosen.value = true))
// One row per person: someone entered in two age groups has one number.
const numberMatches = computed(() => {
  if (!num.value) return []
  const byPerson = new Map<string, { dancer: EnrichedDancer; groups: string[] }>()
  for (const d of entries.value) {
    if (d.number == null || !String(d.number).startsWith(num.value)) continue
    const key = d.dancerId ?? `${d.number}:${d.fullName}`
    const hit = byPerson.get(key)
    if (hit) hit.groups.push(d.group?.fullName ?? '')
    else byPerson.set(key, { dancer: d, groups: [d.group?.fullName ?? ''] })
  }
  return [...byPerson.values()].sort((a, b) => (a.dancer.number ?? 0) - (b.dancer.number ?? 0)).slice(0, 12)
})
// The dancer whose number it is, if anyone's, gets a big card; the rest
// whose numbers start with it are rows, the digits typed heaviest.
const exact = computed(() => numberMatches.value.find((m) => String(m.dancer.number) === num.value) ?? null)
const others = computed(() => numberMatches.value.filter((m) => m !== exact.value))
const typed = (n: number | string | undefined) => String(n ?? '').slice(0, num.value.length)
const untyped = (n: number | string | undefined) => String(n ?? '').slice(num.value.length)
const colorOf = (d: EnrichedDancer) => (following.isFollowing(d) ? following.colorFor(d.dancerId) : null)

const competitionName = computed(
  () => choices.value.find((c) => c.id === competitionId.value)?.competition.name ?? '',
)

const nameInput = ref<HTMLInputElement | null>(null)
const numberInput = ref<HTMLInputElement | null>(null)
watch(mode, async (m) => {
  await nextTick()
  if (m === 'name') nameInput.value?.focus()
  else numberInput.value?.focus()
})
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar title="Search" :show-title="scrolledPast" :back="false" />

    <main class="mx-auto w-full max-w-3xl space-y-4 px-4 pt-[calc(var(--chrome-top)+0.25rem)]">
      <header ref="titleEl">
        <h1 class="text-display">Search</h1>
      </header>

      <Segmented v-model="mode" :options="MODES" label="Search by" />

      <!-- By name -->
      <template v-if="mode === 'name'">
        <label class="field flex h-12 items-center gap-2 rounded-xl pr-1 pl-3">
          <Search class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
          <input
            ref="nameInput"
            v-model="q"
            type="search"
            enterkeyhint="search"
            autocomplete="off"
            placeholder="Search dancers, competitions and places"
            aria-label="Search"
            class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none"
            @keydown.enter="nameInput?.blur()"
          />
          <button
            v-if="q"
            type="button"
            class="text-muted-foreground press flex size-11 shrink-0 items-center justify-center rounded-full"
            aria-label="Clear search"
            @click="q = ''"
          >
            <X class="size-5" />
          </button>
        </label>

        <SearchStart v-if="!hasQuery" :today="todayChoice" @search="q = $event" @number="searchByNumber" />

        <EmptyState
          v-else-if="failed"
          size="inline"
          :icon="CloudOff"
          title="Search isn’t working right now"
          description="Check your connection, then try again."
        >
          <Button variant="primary" @click="run(q)">Try again</Button>
        </EmptyState>
        <div v-else-if="loadingName && nothing" class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]" aria-busy="true">
          <span class="sr-only">Searching…</span>
          <div v-for="i in 4" :key="i" class="flex min-h-16 items-center gap-3 py-2 pr-4 pl-4">
            <Skeleton class="size-10 shrink-0 rounded-full!" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-4 w-1/2" />
              <Skeleton class="h-3.5 w-1/3" />
            </div>
          </div>
        </div>
        <EmptyState
          v-else-if="nothing"
          size="inline"
          :icon="digits ? Hash : SearchX"
          :title="`Nothing matches “${q.trim()}”.`"
          :description="
            digits
              ? 'Numbers change at every competition. Look it up in one competition instead.'
              : 'Check the spelling, or try just a first or last name.'
          "
        >
          <Button v-if="digits" variant="primary" @click="numberFromName">Search by number</Button>
        </EmptyState>

        <template v-else>
          <section v-if="results.dancers.groups.length" :class="['space-y-2', settle]">
            <h2 class="text-heading">Dancers</h2>
            <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
              <li v-for="g in results.dancers.groups" :key="g.name">
                <component
                  :is="linkTo('dancers', g.name) ? RouterLink : 'button'"
                  :to="linkTo('dancers', g.name) ?? undefined"
                  :type="linkTo('dancers', g.name) ? undefined : 'button'"
                  :data-tapping="opening === keyOf('dancers', g.name) || undefined"
                  class="press-row focus-inset flex min-h-16 w-full items-center gap-3 py-2 pr-3 pl-4 text-left"
                  @click="!linkTo('dancers', g.name) && openLate('dancers', g.name)"
                >
                  <span class="flex w-11 shrink-0 justify-center">
                    <Avatar :name="g.name" :color="following.colorFor(ids[keyOf('dancers', g.name)])" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-base font-semibold">{{ g.name }}</span>
                    <span class="text-muted-foreground block truncate text-sm">
                      {{ [g.location, `${g.competitionIds.length} competition${g.competitionIds.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ') }}
                    </span>
                  </span>
                  <LoaderCircle v-if="opening === keyOf('dancers', g.name)" class="text-muted-foreground size-5 shrink-0 animate-spin" aria-hidden="true" />
                  <ChevronRight v-else class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
                </component>
              </li>
            </ul>
            <Button
              v-if="results.dancers.total > results.dancers.groups.length"
              variant="plain"
              block
              @click="run(q, 50, ['dancers'])"
            >
              Show all {{ results.dancers.total }} dancers
            </Button>
          </section>

          <section v-if="results.competitions.hits.length" :class="['space-y-2', settle]">
            <h2 class="text-heading">Competitions</h2>
            <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
              <CompetitionDateRow
                v-for="c in results.competitions.hits"
                :key="c.id"
                :competition="c"
                :to="{ name: 'competition.info', params: { competitionId: c.id } }"
                :followed="favorites.isFavorite('competitions', c.id)"
              />
            </ul>
          </section>

          <section v-for="t in (['judges', 'pipers'] as const)" v-show="results[t].groups.length" :key="t" :class="['space-y-2', settle]">
            <h2 class="text-heading">{{ t === 'judges' ? 'Judges' : 'Pipers' }}</h2>
            <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
              <li v-for="g in results[t].groups" :key="g.name">
                <component
                  :is="linkTo(t, g.name) ? RouterLink : 'button'"
                  :to="linkTo(t, g.name) ?? undefined"
                  :type="linkTo(t, g.name) ? undefined : 'button'"
                  :data-tapping="opening === keyOf(t, g.name) || undefined"
                  class="press-row focus-inset flex min-h-16 w-full items-center gap-3 py-2 pr-3 pl-4 text-left"
                  @click="!linkTo(t, g.name) && openLate(t, g.name)"
                >
                  <span class="flex w-11 shrink-0 justify-center">
                    <Avatar :name="g.name" :image="g.image" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-base font-semibold">{{ g.name }}</span>
                    <span class="text-muted-foreground block truncate text-sm">
                      {{ [t === 'judges' ? 'Judge' : 'Piper', g.location].filter(Boolean).join(' · ') }}
                    </span>
                  </span>
                  <LoaderCircle v-if="opening === keyOf(t, g.name)" class="text-muted-foreground size-5 shrink-0 animate-spin" aria-hidden="true" />
                  <ChevronRight v-else class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
                </component>
              </li>
            </ul>
          </section>

          <section v-if="results.places.groups.length" :class="['space-y-2', settle]">
            <h2 class="text-heading">Places</h2>
            <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]">
              <li v-for="g in results.places.groups" :key="`${g.kind}:${g.name}`">
                <component
                  :is="g.kind === 'venue' && linkTo('venues', g.name) ? RouterLink : 'button'"
                  :to="(g.kind === 'venue' && linkTo('venues', g.name)) || undefined"
                  :type="g.kind === 'venue' && linkTo('venues', g.name) ? undefined : 'button'"
                  :data-tapping="opening === keyOf('venues', g.name) || undefined"
                  class="press-row focus-inset flex min-h-16 w-full items-center gap-3 py-2 pr-3 pl-4 text-left"
                  @click="g.kind !== 'venue' ? openArea(g) : !linkTo('venues', g.name) && openLate('venues', g.name, g.locality)"
                >
                  <span class="flex w-11 shrink-0 justify-center">
                    <MapPin class="text-muted-foreground size-5" aria-hidden="true" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-base font-semibold">{{ g.name }}</span>
                    <span class="text-muted-foreground block truncate text-sm">
                      {{ [g.parentLabel, `${g.count} competition${g.count === 1 ? '' : 's'}`].filter(Boolean).join(' · ') }}
                    </span>
                  </span>
                  <LoaderCircle v-if="opening === keyOf('venues', g.name)" class="text-muted-foreground size-5 shrink-0 animate-spin" aria-hidden="true" />
                  <ChevronRight v-else class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
                </component>
              </li>
            </ul>
          </section>
        </template>
      </template>

      <!-- By number: the number first, then where to look. The phone's own
           number pad, via inputmode. -->
      <div v-else-if="!choices.length && competitionsLoading" class="space-y-3" aria-busy="true">
        <Skeleton class="h-16 w-full rounded-2xl!" />
        <Skeleton class="h-11 w-64 rounded-full!" />
      </div>
      <EmptyState
        v-else-if="!choices.length"
        :icon="Hash"
        title="No competitions on right now"
        description="Numbers change at every competition, so this only looks in competitions within a month of today. Search by name to find anyone."
      >
        <Button variant="primary" size="lg" @click="mode = 'name'">Search by name</Button>
      </EmptyState>
      <template v-else>
        <label class="block space-y-1.5">
          <span class="text-muted-foreground text-sm font-medium">Number on their card</span>
          <input
            ref="numberInput"
            v-model="num"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            autocomplete="off"
            enterkeyhint="search"
            maxlength="5"
            placeholder="e.g. 134"
            class="field placeholder:text-muted-foreground h-16 w-full rounded-2xl text-center text-[2rem] font-extrabold tracking-wider tabular-nums outline-none placeholder:text-xl placeholder:font-medium placeholder:tracking-normal"
            @input="num = num.replace(/\D/g, '')"
          />
        </label>

        <CompetitionPicker :model-value="competitionId" :choices="choices" @update:model-value="choose" />

        <div
          v-if="exact"
          :class="['surface flex items-center overflow-hidden rounded-3xl pr-2', settle]"
        >
          <RouterLink
            :to="{ name: 'competition.dancer', params: { competitionId, dancerId: exact.dancer.id } }"
            class="press-row focus-inset flex min-w-0 flex-1 items-center gap-4 py-4 pl-4"
          >
            <NumberCard :number="exact.dancer.number" size="md" :color="colorOf(exact.dancer)" />
            <span class="min-w-0">
              <span class="text-title line-clamp-2">{{ exact.dancer.fullName }}</span>
              <span class="text-muted-foreground block truncate text-sm">{{ exact.groups.filter(Boolean).join(' · ') }}</span>
            </span>
          </RouterLink>
          <FollowButton :dancer="exact.dancer" />
        </div>

        <ul v-if="others.length" :class="['surface rows-inset overflow-hidden rounded-2xl [--inset:4.5rem]', settle]">
          <li v-for="{ dancer: d, groups } in others" :key="d.id" class="flex items-center pr-1">
            <RouterLink
              :to="{ name: 'competition.dancer', params: { competitionId, dancerId: d.id } }"
              class="press-row focus-inset flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 pl-4"
              :aria-label="`${d.number} ${d.fullName}`"
            >
              <span
                class="bg-paper text-paper-ink relative inline-flex h-8 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--paper-edge)] text-[0.9375rem] tracking-[-0.02em] tabular-nums"
                :style="following.paint(d.dancerId)"
                aria-hidden="true"
              >
                <span v-if="colorOf(d)" class="sash absolute inset-x-0 top-0 h-1.5" />
                <span :class="['font-extrabold', colorOf(d) && 'pt-1']">{{ typed(d.number) }}</span
                ><span :class="['font-medium opacity-50', colorOf(d) && 'pt-1']">{{ untyped(d.number) }}</span>
              </span>
              <span class="min-w-0">
                <span class="block truncate text-base font-semibold">{{ d.fullName }}</span>
                <span class="text-muted-foreground block truncate text-sm">{{ groups.filter(Boolean).join(' · ') }}</span>
              </span>
            </RouterLink>
            <FollowButton :dancer="d" />
          </li>
        </ul>
        <p v-if="!numberMatches.length && num && loadingEntries" class="text-muted-foreground text-center text-base">Looking…</p>
        <EmptyState
          v-else-if="!numberMatches.length && num && entries.length"
          size="inline"
          :icon="SearchX"
          :title="`No dancer with number ${num} at ${competitionName}.`"
          description="Check the number on their card, or look in another competition."
        />
        <EmptyState
          v-else-if="!numberMatches.length && num"
          size="inline"
          :icon="Hash"
          :title="`The dancer list for ${competitionName} hasn’t been posted yet.`"
          description="Numbers appear here once the organisers post their entries."
        />

        <p class="text-muted-foreground flex items-center gap-2 px-1 text-sm">
          <User class="size-4 shrink-0" aria-hidden="true" />
          Numbers change at every competition, so this looks in one competition at a time.
        </p>
      </template>
    </main>
  </div>
</template>
