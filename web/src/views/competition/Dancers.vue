<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import Fuse from 'fuse.js'
import { Star, Users, X } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'
import type { EnrichedDancer } from '@/types/competition'
import DisclosureHeader from '@/components/DisclosureHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import FavoriteDancerButton from '@/components/FavoriteDancerButton.vue'
import Skeleton from '@/components/Skeleton.vue'
import SmoothCollapse from '@/components/SmoothCollapse.vue'
import { useVtScope } from '@/lib/viewTransitionFocus'

const SUGGESTIONS_NAME = 'Suggested Favourites'

const { competitionId, dancers, loadDancers } = useCompetition()
const auth = useAuthStore()
const favorites = useFavoritesStore()

const loaded = ref(false)
onMounted(async () => {
  await loadDancers()
  loaded.value = true
})

type SortKey = 'group' | 'number' | 'location' | 'firstName' | 'lastName'

const sortableBys: Array<{ key: SortKey; label: string }> = [
  { key: 'group', label: 'Age Group' },
  { key: 'number', label: 'Number' },
  { key: 'location', label: 'Location' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
]

const filter = useLocalStorage('dancers:filter', '')
const sortBy = useLocalStorage<SortKey>('dancers:sortBy', 'group')
const onlyFavorites = ref(false)
const expandedByGroup = useLocalStorage<Record<string, Record<string, boolean>>>(
  'dancers:expandedByGroup',
  {},
)
const dismissedSuggestions = useLocalStorage<Record<string, boolean>>(
  'dancers:dismissedSuggestions',
  {},
)

const fuse = computed(
  () =>
    new Fuse(dancers.value, {
      keys: ['fullName', 'firstName', 'lastName', 'number', 'location', 'group.fullName'],
      threshold: 0.33,
      ignoreLocation: true,
    }),
)

const dancerNumber = (d: EnrichedDancer) =>
  d.number != null && Number.isFinite(d.number) ? d.number : Number.POSITIVE_INFINITY

const groupSortValue = (d: EnrichedDancer) => d.group?._order ?? Number.POSITIVE_INFINITY

const sortedDancers = computed(() => {
  const list = [...dancers.value]
  switch (sortBy.value) {
    case 'group':
      return list.sort(
        (a, b) =>
          groupSortValue(a) - groupSortValue(b) || dancerNumber(a) - dancerNumber(b),
      )
    case 'number':
      return list.sort((a, b) => dancerNumber(a) - dancerNumber(b))
    case 'location':
      return list.sort((a, b) => (a.location ?? '').localeCompare(b.location ?? ''))
    case 'firstName':
      return list.sort((a, b) => (a.firstName ?? '').localeCompare(b.firstName ?? ''))
    case 'lastName':
      return list.sort((a, b) => (a.lastName ?? '').localeCompare(b.lastName ?? ''))
    default:
      return list
  }
})

const filteredDancers = computed(() => {
  let list = sortedDancers.value
  const q = filter.value.trim()
  if (q) {
    const matched = new Set(fuse.value.search(q).map((r) => r.item.id))
    list = list.filter((d) => matched.has(d.id))
  }
  if (onlyFavorites.value) {
    list = list.filter((d) => favorites.isFavoriteDancer(d.id))
  }
  return list
})

const suggestions = computed<EnrichedDancer[]>(() => {
  const favoriteNames = new Set(
    Object.values(favorites.dancers).filter(
      (v): v is string => typeof v === 'string' && v.trim().length > 0,
    ),
  )
  if (!favoriteNames.size) return []
  return dancers.value.filter(
    (d) => !favorites.isFavoriteDancer(d.id) && favoriteNames.has(d.fullName),
  )
})

const showSuggestionsBanner = computed(
  () => suggestions.value.length > 0 && !dismissedSuggestions.value[competitionId.value],
)

interface DancerGroupRow {
  groupName: string
  groupOrder: number
  members: EnrichedDancer[]
  isSuggestions?: boolean
}

const getGroupBucket = (d: EnrichedDancer): { name: string; order: number } => {
  switch (sortBy.value) {
    case 'group':
      return {
        name: d.group?.fullName || 'Unassigned',
        order: d.group?._order ?? Number.POSITIVE_INFINITY,
      }
    case 'number':
      return { name: 'Number', order: 0 }
    case 'location':
      return { name: d.location || '?', order: 0 }
    case 'firstName': {
      const ch = (d.firstName ?? '?')[0]?.toUpperCase() || '?'
      return { name: ch, order: ch.charCodeAt(0) }
    }
    case 'lastName': {
      const ch = (d.lastName ?? '?')[0]?.toUpperCase() || '?'
      return { name: ch, order: ch.charCodeAt(0) }
    }
    default:
      return { name: 'All', order: 0 }
  }
}

const grouped = computed<DancerGroupRow[]>(() => {
  const map = new Map<string, DancerGroupRow>()
  for (const dancer of filteredDancers.value) {
    const bucket = getGroupBucket(dancer)
    let row = map.get(bucket.name)
    if (!row) {
      row = { groupName: bucket.name, groupOrder: bucket.order, members: [] }
      map.set(bucket.name, row)
    }
    row.members.push(dancer)
  }
  const rows = [...map.values()].sort(
    (a, b) => a.groupOrder - b.groupOrder || a.groupName.localeCompare(b.groupName),
  )
  if (onlyFavorites.value && suggestions.value.length) {
    rows.unshift({
      groupName: SUGGESTIONS_NAME,
      groupOrder: -Infinity,
      members: suggestions.value,
      isSuggestions: true,
    })
  }
  return rows
})

function isExpanded(group: DancerGroupRow) {
  if (filter.value.trim()) return true
  if (onlyFavorites.value && !group.isSuggestions) return true
  const map = expandedByGroup.value[sortBy.value] ?? {}
  if (group.groupName in map) return map[group.groupName]
  return grouped.value.length <= 1 || group.isSuggestions === true
}

function toggleExpanded(group: DancerGroupRow) {
  const current = expandedByGroup.value[sortBy.value] ?? {}
  expandedByGroup.value = {
    ...expandedByGroup.value,
    [sortBy.value]: { ...current, [group.groupName]: !isExpanded(group) },
  }
}

function groupFavoriteCount(group: DancerGroupRow) {
  return group.members.filter((d) => favorites.isFavoriteDancer(d.id)).length
}

async function favoriteAll(dancersToFavorite: EnrichedDancer[]) {
  const apply = () =>
    Promise.all(dancersToFavorite.map((d) => favorites.setDancer(d.id, true, d.fullName)))
  if (!auth.isSignedIn) {
    auth.enqueueAfterLogin(apply)
    auth.openLogin()
    return
  }
  await apply()
}

function activateSuggestions() {
  onlyFavorites.value = true
  dismissedSuggestions.value = {
    ...dismissedSuggestions.value,
    [competitionId.value]: true,
  }
}

function dismissSuggestions() {
  dismissedSuggestions.value = {
    ...dismissedSuggestions.value,
    [competitionId.value]: true,
  }
}

const vt = useVtScope('comp-dancer')
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center gap-2">
      <div
        class="bg-card flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border px-4 shadow-sm"
      >
        <input
          v-model="filter"
          type="search"
          placeholder="Search dancers…"
          class="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent focus:outline-none"
        />
      </div>
      <label class="text-muted-foreground">
        <span class="sr-only">Sort by</span>
        <select
          v-model="sortBy"
          class="bg-card focus:ring-ring h-11 rounded-full border px-3 shadow-sm focus:ring-2 focus:outline-none"
        >
          <option v-for="by in sortableBys" :key="by.key" :value="by.key">
            {{ by.label }}
          </option>
        </select>
      </label>
      <button
        type="button"
        :title="onlyFavorites ? 'Show all dancers' : 'Show only favorites'"
        :aria-pressed="onlyFavorites"
        :class="[
          'flex size-11 items-center justify-center rounded-full border shadow-sm transition-colors',
          onlyFavorites
            ? 'text-secondary border-secondary bg-secondary/10'
            : 'text-muted-foreground bg-card hover:bg-accent',
        ]"
        @click="onlyFavorites = !onlyFavorites"
      >
        <Star :class="['size-4', onlyFavorites && 'fill-current']" />
      </button>
    </div>

    <div
      v-if="showSuggestionsBanner"
      class="border-secondary/40 bg-secondary/10 hover:bg-secondary/15 flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3"
      @click="activateSuggestions"
    >
      <Star class="text-secondary size-5 shrink-0 fill-current" />
      <div class="min-w-0 flex-1">
        <div class="text-lg font-medium tracking-tight">
          {{ suggestions.length }} favourite dancer
          {{ suggestions.length === 1 ? 'suggestion' : 'suggestions' }}
        </div>
        <div class="text-muted-foreground">based on your previous selections</div>
      </div>
      <button
        type="button"
        class="hover:bg-secondary/20 rounded-full p-1"
        title="Dismiss"
        @click.stop="dismissSuggestions"
      >
        <X class="size-4" />
      </button>
    </div>

    <div v-if="!loaded" class="space-y-6" aria-busy="true" aria-live="polite">
      <span class="sr-only">Loading dancers…</span>
      <div v-for="i in 2" :key="i" class="space-y-3">
        <Skeleton class="h-7 w-1/3" />
        <div v-for="j in 4" :key="j" class="flex items-center gap-3">
          <Skeleton class="size-9 rounded-full!" />
          <Skeleton class="h-5 flex-1" />
        </div>
      </div>
    </div>
    <EmptyState
      v-else-if="!dancers.length"
      :icon="Users"
      title="No dancers yet"
      description="The dancer list hasn’t been posted. Check back closer to the competition."
    />
    <EmptyState
      v-else-if="!grouped.length && onlyFavorites && !auth.isSignedIn"
      :icon="Star"
      title="Sign in to see your favourites"
      description="Your favourited dancers stay in sync once you sign in."
    />
    <EmptyState
      v-else-if="!grouped.length && onlyFavorites"
      :icon="Star"
      title="No favourite dancers"
      description="Star a dancer to follow them through this competition."
    />
    <div
      v-else-if="!grouped.length"
      class="text-muted-foreground text-lg italic"
    >
      No matches.
    </div>

    <section v-for="group in grouped" :key="group.groupName" class="space-y-1">
      <DisclosureHeader
        :label="group.groupName"
        :expanded="isExpanded(group)"
        :count="group.members.length"
        :favs="
          !onlyFavorites && !group.isSuggestions ? groupFavoriteCount(group) : 0
        "
        @toggle="toggleExpanded(group)"
      />
      <SmoothCollapse :open="isExpanded(group)">
        <div v-if="group.isSuggestions" class="flex justify-end px-1 pb-2">
          <button
            type="button"
            class="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-sm font-medium hover:opacity-90"
            @click="favoriteAll(group.members)"
          >
            Favourite all
          </button>
        </div>
        <ul>
        <li v-for="dancer in group.members" :key="dancer.id">
          <div class="flex items-center">
            <RouterLink
              :to="{
                name: 'competition.dancer',
                params: { competitionId, dancerId: dancer.id },
              }"
              v-slot="{ href, navigate }"
              custom
            >
              <a
                :href="href"
                class="flex min-w-0 flex-1 items-center gap-3 px-1 py-3"
                @click="vt.onNavigate($event, navigate, dancer.id)"
              >
                <div
                  :class="[
                    'flex size-9 shrink-0 items-center justify-center rounded-full font-medium tabular-nums [view-transition-class:nav-avatar]',
                    favorites.isFavoriteDancer(dancer.id)
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-muted text-muted-foreground',
                  ]"
                  :style="{ viewTransitionName: vt.name(dancer.id, 'avatar') }"
                >
                  {{ dancer.number ?? '–' }}
                </div>
                <div class="min-w-0 flex-1">
                  <div
                    class="text-item-title truncate [view-transition-class:fit_nav-title]"
                    :style="{ viewTransitionName: vt.name(dancer.id, 'name') }"
                  >
                    {{ dancer.fullName || '?' }}
                  </div>
                  <div
                    v-if="dancer.location"
                    class="text-item-subtitle text-muted-foreground truncate"
                  >
                    {{ dancer.location }}
                  </div>
                </div>
              </a>
            </RouterLink>
            <FavoriteDancerButton :dancer="dancer" class="mr-1" />
          </div>
        </li>
      </ul>
      </SmoothCollapse>
    </section>
  </div>
</template>
