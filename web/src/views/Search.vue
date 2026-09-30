<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { refDebounced } from '@vueuse/core'
import { ChevronRight, Clock, Gavel, MapPin, Music, Search, User, X } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import CompetitionDateRow from '@/components/CompetitionDateRow.vue'
import FollowButton from '@/components/FollowButton.vue'
import NumberCard from '@/components/NumberCard.vue'
import { useScrolledPast } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import { useCompetitions } from '@/composables/useCompetitions'
import { useFollowing } from '@/composables/useFollowing'
import { useRecentSearches } from '@/composables/useRecentSearches'
import { useLocationFilter } from '@/composables/useLocationFilter'
import { useFavoritesStore } from '@/stores/favorites'
import { fetchDancers } from '@/lib/competitionData'
import { daysFromToday, formatShortDate } from '@/lib/format'
import { lookupEntityId, lookupVenueId } from '@/lib/entityIndex'
import {
  searchAll,
  type SearchAllResults,
  type SearchEntityType,
  type SearchPersonGroup,
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
const mode = ref<Mode>(route.query.by === 'number' ? 'number' : 'name')
watch(mode, (m) => router.replace({ query: { ...route.query, by: m === 'number' ? 'number' : undefined } }))

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

async function openPerson(type: 'dancers' | 'judges' | 'pipers', g: SearchPersonGroup) {
  const id = await lookupEntityId(type, g.name)
  if (!id) return
  const name = type === 'dancers' ? 'dancer.info' : type === 'judges' ? 'judge.info' : 'piper.info'
  const param = type === 'dancers' ? 'dancerId' : type === 'judges' ? 'judgeId' : 'piperId'
  router.push({ name, params: { [param]: id } })
}

async function openPlace(g: SearchPlaceGroup) {
  if (g.kind === 'venue') {
    const id = await lookupVenueId(g.name, g.locality ?? null)
    if (id) router.push({ name: 'venue.info', params: { venueId: id } })
    return
  }
  locationFilter.setRegion({
    country: g.country ?? null,
    region: g.region ?? null,
    locality: g.kind === 'locality' ? (g.locality ?? g.name) : null,
  })
  router.push({ name: 'competitions' })
}

// ─── By number (one competition) ────────────────────────────────────────────
// Numbers change at every competition, so number search always looks inside
// one. Default: today's competition, else the nearest one.
const { competitions } = useCompetitions(ref(false))
const candidates = computed(() =>
  [...competitions.value]
    .filter((c) => {
      const d = daysFromToday(c.date)
      return d != null && d >= -30 && d <= 30
    })
    .sort((a, b) => Math.abs(daysFromToday(a.date) ?? 99) - Math.abs(daysFromToday(b.date) ?? 99)),
)
const competitionId = ref<string>(String(route.query.in ?? ''))
watch(
  candidates,
  (list) => {
    if (!competitionId.value && list[0]) competitionId.value = list[0].id
  },
  { immediate: true },
)
watch(competitionId, (id) => router.replace({ query: { ...route.query, in: id || undefined } }))

const entries = shallowRef<EnrichedDancer[]>([])
watch(
  competitionId,
  async (id) => {
    entries.value = []
    if (!id) return
    try {
      const b = await fetchDancers(id)
      if (id === competitionId.value) entries.value = b.dancers
    } catch {
      entries.value = []
    }
  },
  { immediate: true },
)

const num = ref('')
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
const competitionName = computed(() => candidates.value.find((c) => c.id === competitionId.value)?.name ?? '')

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

    <main class="mx-auto w-full max-w-3xl space-y-3 px-4 pt-[calc(var(--chrome-top)+0.25rem)]">
      <header ref="titleEl">
        <h1 class="text-display">Search</h1>
      </header>

      <div class="bg-muted grid grid-cols-2 rounded-xl border p-1" role="group" aria-label="Search by">
        <button
          v-for="m in (['name', 'number'] as const)"
          :key="m"
          type="button"
          :aria-pressed="mode === m"
          :class="[
            'h-10 rounded-lg text-[0.9375rem] font-bold transition-colors',
            mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
          ]"
          @click="mode = m"
        >
          {{ m === 'name' ? 'By name' : 'By number' }}
        </button>
      </div>

      <!-- By name -->
      <template v-if="mode === 'name'">
        <label class="bg-card border-strong focus-within:border-primary flex h-12 items-center gap-2 rounded-xl border-2 px-3">
          <Search class="text-muted-foreground size-5 shrink-0" />
          <input
            ref="nameInput"
            v-model="q"
            type="search"
            enterkeyhint="search"
            autocomplete="off"
            placeholder="Dancer, competition, judge or town"
            aria-label="Search"
            class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          <button
            v-if="q"
            type="button"
            class="text-muted-foreground -mr-1 flex size-10 items-center justify-center rounded-full"
            aria-label="Clear search"
            @click="q = ''"
          >
            <X class="size-5" />
          </button>
        </label>

        <template v-if="!hasQuery">
          <section v-if="recentSearches.recent.value.length" class="space-y-2">
            <h2 class="text-heading flex items-baseline justify-between pt-1">
              Recent
              <button type="button" class="text-primary text-[0.9375rem] font-bold" @click="recentSearches.clear()">
                Clear
              </button>
            </h2>
            <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
              <li v-for="r in recentSearches.recent.value" :key="r">
                <button type="button" class="flex min-h-12 w-full items-center gap-3 px-4 text-left hover:bg-accent" @click="q = r">
                  <Clock class="text-muted-foreground size-5" />
                  <span class="flex-1 text-base font-semibold">{{ r }}</span>
                </button>
              </li>
            </ul>
          </section>
          <p class="text-muted-foreground px-1 text-[0.9375rem]">
            Know the number on their card? Use <button type="button" class="text-primary font-bold" @click="mode = 'number'">By number</button>.
          </p>
        </template>

        <div v-else-if="failed" class="bg-card space-y-3 rounded-2xl border p-4 text-center shadow-sm">
          <p class="text-base font-semibold">Search isn’t working right now. Check your connection.</p>
          <button type="button" class="bg-primary text-primary-foreground h-12 rounded-xl px-6 font-bold" @click="run(q)">
            Try again
          </button>
        </div>
        <p v-else-if="loadingName && nothing" class="text-muted-foreground py-4 text-center text-base">Searching…</p>
        <p v-else-if="nothing" class="text-muted-foreground py-4 text-center text-base">
          Nothing matches “{{ q }}”. Check the spelling, or try just a first or last name.
        </p>

        <template v-else>
          <section v-if="results.dancers.groups.length" class="space-y-2">
            <h2 class="text-heading pt-1">Dancers</h2>
            <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
              <li v-for="g in results.dancers.groups" :key="g.name">
                <button type="button" class="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent" @click="openPerson('dancers', g)">
                  <span class="bg-blue-paper text-primary flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold">{{ g.initials }}</span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-base font-bold">{{ g.name }}</span>
                    <span class="text-muted-foreground block truncate text-sm">
                      {{ [g.location, `${g.competitionIds.length} competition${g.competitionIds.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ') }}
                    </span>
                  </span>
                  <ChevronRight class="text-muted-foreground size-5" />
                </button>
              </li>
            </ul>
            <button
              v-if="results.dancers.total > results.dancers.groups.length"
              type="button"
              class="text-primary h-11 w-full text-[0.9375rem] font-bold"
              @click="run(q, 50, ['dancers'])"
            >
              Show all {{ results.dancers.total }} dancers
            </button>
          </section>

          <section v-if="results.competitions.hits.length" class="space-y-2">
            <h2 class="text-heading pt-1">Competitions</h2>
            <ul class="divide-y overflow-hidden rounded-2xl border shadow-sm">
              <CompetitionDateRow
                v-for="c in results.competitions.hits"
                :key="c.id"
                :competition="c"
                :to="{ name: 'competition.info', params: { competitionId: c.id } }"
                :followed="favorites.isFavorite('competitions', c.id)"
              />
            </ul>
          </section>

          <section v-for="t in (['judges', 'pipers'] as const)" v-show="results[t].groups.length" :key="t" class="space-y-2">
            <h2 class="text-heading pt-1">{{ t === 'judges' ? 'Judges' : 'Pipers' }}</h2>
            <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
              <li v-for="g in results[t].groups" :key="g.name">
                <button type="button" class="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent" @click="openPerson(t, g)">
                  <component :is="t === 'judges' ? Gavel : Music" class="text-primary size-5 shrink-0" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-base font-bold">{{ g.name }}</span>
                    <span v-if="g.location" class="text-muted-foreground block truncate text-sm">{{ g.location }}</span>
                  </span>
                  <ChevronRight class="text-muted-foreground size-5" />
                </button>
              </li>
            </ul>
          </section>

          <section v-if="results.places.groups.length" class="space-y-2">
            <h2 class="text-heading pt-1">Places</h2>
            <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
              <li v-for="g in results.places.groups" :key="`${g.kind}:${g.name}`">
                <button type="button" class="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent" @click="openPlace(g)">
                  <MapPin class="text-primary size-5 shrink-0" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-base font-bold">{{ g.name }}</span>
                    <span class="text-muted-foreground block truncate text-sm">
                      {{ [g.parentLabel, `${g.count} competition${g.count === 1 ? '' : 's'}`].filter(Boolean).join(' · ') }}
                    </span>
                  </span>
                  <ChevronRight class="text-muted-foreground size-5" />
                </button>
              </li>
            </ul>
          </section>
        </template>
      </template>

      <!-- By number: the phone's own number pad, via inputmode. -->
      <template v-else>
        <label class="block space-y-1">
          <span class="text-muted-foreground text-sm font-bold">Looking in</span>
          <select
            v-model="competitionId"
            class="bg-card border-strong h-12 w-full rounded-xl border-2 px-3 text-base font-bold outline-none"
          >
            <option v-if="!candidates.length" value="">No competitions this month</option>
            <option v-for="c in candidates" :key="c.id" :value="c.id">
              {{ c.name }}{{ c.date ? ` · ${formatShortDate(c.date)}` : '' }}
            </option>
          </select>
        </label>

        <label class="block space-y-1">
          <span class="text-muted-foreground text-sm font-bold">Number on their card</span>
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
            class="bg-card border-strong focus:border-primary placeholder:text-muted-foreground h-16 w-full rounded-2xl border-2 text-center text-[2rem] font-extrabold tracking-wider tabular-nums outline-none placeholder:text-xl placeholder:font-semibold placeholder:tracking-normal"
            @input="num = num.replace(/\D/g, '')"
          />
        </label>

        <ul v-if="numberMatches.length" class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
          <li v-for="{ dancer: d, groups } in numberMatches" :key="d.id" class="flex items-center gap-2 pr-2">
            <RouterLink
              :to="{ name: 'competition.dancer', params: { competitionId, dancerId: d.id } }"
              class="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pl-3"
            >
              <NumberCard
                :number="d.number"
                size="xs"
                :color="following.isFollowing(d) ? following.colorFor(d.dancerId) : null"
                :sash="following.sashFor(d.dancerId)"
              />
              <span class="min-w-0">
                <span class="block truncate text-base font-semibold">{{ d.fullName }}</span>
                <span class="text-muted-foreground block truncate text-sm">{{ groups.filter(Boolean).join(' · ') }}</span>
              </span>
            </RouterLink>
            <FollowButton :dancer="d" />
          </li>
        </ul>
        <p v-else-if="num && entries.length" class="text-muted-foreground text-center text-base">
          No dancer with number {{ num }} at {{ competitionName }}.
        </p>
        <p v-else-if="num && !entries.length" class="text-muted-foreground text-center text-base">
          The dancer list for {{ competitionName }} hasn’t been posted yet.
        </p>

        <p class="text-muted-foreground flex items-center gap-2 px-1 text-sm">
          <User class="size-4 shrink-0" />
          Numbers change at every competition, so this looks in one competition at a time.
        </p>
      </template>
    </main>
  </div>
</template>
