<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { refDebounced } from '@vueuse/core'
import { ChevronRight, Search as SearchIcon, X } from '@lucide/vue'
import SectionHeader from '@/components/SectionHeader.vue'
import Skeleton from '@/components/Skeleton.vue'
import CompetitionRow from '@/components/CompetitionRow.vue'
import {
  searchAll,
  type SearchAllResults,
  type SearchEntityType,
  type SearchCompetitionHit,
} from '@/lib/searchAll'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import { useVtScope } from '@/lib/viewTransitionFocus'

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
}

const results = shallowRef<SearchAllResults>(empty)
const searching = ref(false)
const error = ref<Error | null>(null)
const expanded = reactive<Record<SearchEntityType, boolean>>({
  competitions: false,
  dancers: false,
  judges: false,
})

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
    const out = await searchAll({ q: trimmed, perGroup: EXPANDED_PER_GROUP, types: [type] })
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

function close() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.replace({ name: 'competitions' })
  }
}

const hasQuery = computed(() => q.value.trim().length > 0)
const competitions = computed(() => results.value.competitions)
const dancers = computed(() => results.value.dancers)
const judges = computed(() => results.value.judges)

const hasAnyResults = computed(
  () =>
    competitions.value.hits.length > 0
      || dancers.value.groups.length > 0
      || judges.value.groups.length > 0,
)
</script>

<template>
  <div class="flex flex-1 flex-col pb-(--chrome-bottom)">
    <header
      class="bg-background sticky top-0 z-20 mx-auto flex w-full max-w-3xl items-center gap-2 p-4"
    >
      <div
        class="bg-nav/90 text-nav-foreground flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 px-4 shadow-md backdrop-blur-xl [view-transition-name:nav-left]"
      >
        <SearchIcon class="size-4 shrink-0 opacity-80" />
        <input
          ref="inputEl"
          v-model="q"
          type="search"
          placeholder="Search competitions, dancers, judges…"
          class="placeholder:text-nav-foreground/50 min-w-0 flex-1 bg-transparent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          v-if="q"
          type="button"
          class="text-nav-foreground/70 hover:text-nav-foreground -mr-2 size-7 shrink-0 rounded-full p-1"
          title="Clear"
          aria-label="Clear search"
          @click="clearSearch"
        >
          <X class="size-4" />
        </button>
      </div>
      <button
        type="button"
        class="bg-nav/90 text-nav-foreground flex size-12 shrink-0 items-center justify-center rounded-full border border-white/10 shadow-md backdrop-blur-xl [view-transition-name:nav-right] hover:opacity-90"
        title="Close search"
        aria-label="Close search"
        @click="close"
      >
        <X class="size-5" />
      </button>
    </header>

    <main class="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 pt-0">
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
              v-if="!expanded.competitions && competitions.total > competitions.hits.length"
              type="button"
              class="text-primary hover:text-primary/80 px-1 py-2 text-sm font-medium"
              @click="expandGroup('competitions')"
            >
              See all {{ competitions.total }} →
            </button>
          </section>

          <section v-if="dancers.groups.length" class="space-y-2">
            <SectionHeader label="Dancers" :count="dancers.total" />
            <ul>
              <li v-for="group in dancers.groups" :key="group.name">
                <RouterLink
                  :to="{
                    name: 'dancer.info',
                    params: { dancerId: dancerSlug(group.name) },
                  }"
                  v-slot="{ href, navigate }"
                  custom
                >
                  <a
                    :href="href"
                    class="flex w-full items-center gap-3 px-1 py-3 text-left"
                    @click="vt.onNavigate($event, navigate, dancerSlug(group.name))"
                  >
                    <span
                      class="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-medium [view-transition-class:nav-avatar]"
                      :style="{ viewTransitionName: vt.name(dancerSlug(group.name), 'avatar') }"
                    >
                      {{ group.initials }}
                    </span>
                    <div class="min-w-0 flex-1">
                      <div
                        class="text-item-title truncate [view-transition-class:fit_nav-title]"
                        :style="{ viewTransitionName: vt.name(dancerSlug(group.name), 'name') }"
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
              <li v-for="group in judges.groups" :key="group.name + group.competitionIds[0]">
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
                    <img :src="group.image" :alt="group.name" class="size-full object-cover" />
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
        <p class="text-muted-foreground text-lg italic">
          Type a name to find competitions, dancers, or judges.
        </p>
      </template>
    </main>
  </div>
</template>
