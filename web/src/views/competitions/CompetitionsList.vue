<script setup lang="ts">
import { computed, ref } from 'vue'
import { onClickOutside, useLocalStorage } from '@vueuse/core'
import { Check, ChevronDown, ListFilter } from '@lucide/vue'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import CompetitionRow from '@/components/CompetitionRow.vue'
import CompetitionsCalendar from '@/components/CompetitionsCalendar.vue'
import HeroCompCard from '@/components/HeroCompCard.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import Skeleton from '@/components/Skeleton.vue'
import ViewModeTabs, { type ViewMode } from '@/components/ViewModeTabs.vue'
import { isBeforeToday, isSameDay, parseDate } from '@/lib/format'

type Filter = 'upcoming' | 'past' | 'all'

const view = useLocalStorage<ViewMode>('competitions:view', 'list')
const filter = useLocalStorage<Filter>('competitions:filter', 'upcoming')

const filterOptions: Array<{ id: Filter; label: string }> = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'all', label: 'All' },
]

const filterLabel = computed(
  () => filterOptions.find((o) => o.id === filter.value)?.label ?? 'Upcoming',
)

const filterMenuRef = ref<HTMLElement | null>(null)
const filterOpen = ref(false)
onClickOutside(filterMenuRef, () => (filterOpen.value = false))

const calendarRef = ref<InstanceType<typeof CompetitionsCalendar> | null>(null)

const includeArchived = useLocalStorage('competitions:includeArchived', false)

const { competitions, loading } = useCompetitions(includeArchived)

const featuredComp = computed<CompetitionListItem | null>(() => {
  const list = competitions.value
  if (!list.length) return null
  const live = list.find((c) => c.date && isSameDay(c.date))
  if (live) return live
  const upcoming = list
    .filter((c) => c.date && !isBeforeToday(c.date))
    .sort((a, b) => Number(a.date ?? 0) - Number(b.date ?? 0))
  return upcoming[0] ?? null
})

const filteredCompetitions = computed<CompetitionListItem[]>(() => {
  const list = competitions.value.slice()
  if (filter.value === 'upcoming') {
    return list
      .filter((c) => c.date && !isBeforeToday(c.date))
      .sort((a, b) => Number(a.date ?? 0) - Number(b.date ?? 0))
  }
  if (filter.value === 'past') {
    return list
      .filter((c) => c.date && isBeforeToday(c.date) && !isSameDay(c.date))
      .sort((a, b) => Number(b.date ?? 0) - Number(a.date ?? 0))
  }
  return list.sort((a, b) => Number(a.date ?? 0) - Number(b.date ?? 0))
})

const featuredId = computed(() => featuredComp.value?.id ?? null)
const visibleCompetitions = computed(() =>
  filter.value === 'upcoming'
    ? filteredCompetitions.value.filter((c) => c.id !== featuredId.value)
    : filteredCompetitions.value,
)

interface MonthGroup {
  key: string
  label: string
  members: CompetitionListItem[]
}

const monthGroups = computed<MonthGroup[]>(() => {
  const groups = new Map<string, MonthGroup>()
  for (const c of visibleCompetitions.value) {
    const d = c.date ? parseDate(c.date) : null
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
    g.members.push(c)
  }
  return [...groups.values()]
})
</script>

<template>
  <div class="flex flex-1 flex-col">
    <main class="pt-safe mx-auto w-full max-w-3xl flex-1 space-y-5 p-4">
      <div class="flex flex-wrap items-center gap-2">
        <ViewModeTabs v-model="view" />
        <button
          v-if="view === 'calendar'"
          type="button"
          class="bg-chip text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 font-medium"
          @click="calendarRef?.goToToday()"
        >
          Today
        </button>
        <div v-else ref="filterMenuRef" class="relative ml-auto">
          <button
            type="button"
            class="bg-chip text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 font-medium"
            @click="filterOpen = !filterOpen"
          >
            <ListFilter class="size-3.5" />
            {{ filterLabel }}
            <ChevronDown class="size-3 opacity-60" />
          </button>
          <div
            v-if="filterOpen"
            class="bg-card absolute top-full right-0 z-30 mt-1 w-36 overflow-hidden rounded-lg border shadow-md"
          >
            <button
              v-for="opt in filterOptions"
              :key="opt.id"
              type="button"
              :class="[
                'hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left',
                filter === opt.id
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground',
              ]"
              @click="
                () => {
                  filter = opt.id
                  filterOpen = false
                }
              "
            >
              <Check v-if="filter === opt.id" class="size-3" />
              <span v-else class="size-3" />
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="view === 'map'"
        class="text-muted-foreground rounded-2xl border border-dashed p-8 text-center font-serif text-lg italic"
      >
        Map view — stub.
      </div>
      <CompetitionsCalendar
        v-else-if="view === 'calendar'"
        ref="calendarRef"
        :competitions="competitions"
        :loading="loading"
      />

      <template v-else>
        <HeroCompCard
          v-if="featuredComp && filter === 'upcoming'"
          :competition="featuredComp"
        />

        <div
          v-if="loading && !competitions.length"
          class="space-y-3"
          aria-busy="true"
          aria-live="polite"
        >
          <span class="sr-only">Loading competitions…</span>
          <div v-for="i in 5" :key="i" class="flex items-start gap-3 py-3">
            <Skeleton class="size-12 shrink-0 rounded-xl!" />
            <div class="flex-1 space-y-2 pt-1">
              <Skeleton class="h-5 w-3/4" />
              <Skeleton class="h-4 w-1/2" />
            </div>
          </div>
        </div>
        <div
          v-else-if="!competitions.length"
          class="text-muted-foreground space-y-2 font-serif text-lg italic"
        >
          <div>No competitions found.</div>
          <button
            v-if="!includeArchived"
            type="button"
            class="hover:text-foreground font-sans not-italic underline"
            @click="includeArchived = true"
          >
            Load archived competitions
          </button>
        </div>
        <div
          v-else-if="!visibleCompetitions.length"
          class="text-muted-foreground font-serif text-lg italic"
        >
          <span v-if="filter === 'upcoming'">No upcoming competitions.</span>
          <span v-else-if="filter === 'past'">No past competitions on record.</span>
          <span v-else>No competitions match.</span>
        </div>

        <template v-else>
          <section v-for="group in monthGroups" :key="group.key" class="space-y-2">
            <SectionHeader :label="group.label" :count="group.members.length" />
            <ul>
              <CompetitionRow
                v-for="competition in group.members"
                :key="competition.id"
                :competition="competition"
                :to="{
                  name: 'competition.info',
                  params: { competitionId: competition.id },
                }"
              />
            </ul>
          </section>
        </template>

        <div v-if="competitions.length && !includeArchived" class="pt-2 text-center">
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground underline"
            @click="includeArchived = true"
          >
            Load archived competitions
          </button>
        </div>
      </template>
    </main>
  </div>
</template>
