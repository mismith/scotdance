<script setup lang="ts">
import MyDancerLine from '@/components/MyDancerLine.vue'
import ResultsMark from '@/components/ResultsMark.vue'
import { computed, onMounted, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { RouterLink } from 'vue-router'
import { AlertTriangle, ChevronRight, Trophy } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useCompetitionDays } from '@/composables/useCompetitionDays'
import { useCompetitionLive } from '@/composables/useCompetitionLive'
import { useFreshPlacings } from '@/composables/useCompetitionPlacings'
import { useFollowing } from '@/composables/useFollowing'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { findGroupDances, groupHasPlaceholderDancers, isPosted } from '@/lib/results'
import { resultsCount } from '@/lib/resultsCount'
import { OVERALL_ID, groupHasOverall, type EnrichedGroup } from '@/types/competition'
import EmptyState from '@/components/EmptyState.vue'
import LiveDot from '@/components/LiveDot.vue'
import Medal from '@/components/Medal.vue'
import Skeleton from '@/components/Skeleton.vue'
import Switch from '@/components/ui/Switch.vue'

// Results without digging: every age group is visible at once (no
// accordions), with how many of its dances are posted and, for the people
// you follow, their placings right in the list.
const setHeader = injectInfoHeaderSetter()
const {
  competitionId,
  categories,
  groups,
  dances,
  results,
  points,
  loadDancers,
  loadResults,
  loadSchedule,
  isLive,
  resultsHidden,
} = useCompetition()
const { followedByGroup, dayFor } = useCompetitionDays()
const following = useFollowing()
const { pulse, lastResult } = useCompetitionLive()
const isFresh = useFreshPlacings()

const loaded = ref(false)
onMounted(async () => {
  await Promise.all([loadDancers(), loadResults(), loadSchedule()])
  loaded.value = true
})

// Remembered across competitions: most people only ever want their own.
// Ignored where none of your dancers are entered, so the list is never empty.
const onlyMine = useLocalStorage('results:onlyMine', false)

interface Row {
  group: EnrichedGroup
  total: number
  posted: number
  unknown: boolean
  mine: Array<{
    key: string
    name: string
    color: string | null
    medals: Array<{ id: string; name: string; place: number; tied: boolean; dancerId: string }>
  }>
}

function rowFor(group: EnrichedGroup): Row {
  const ids = findGroupDances(group, dances.value).map((d) => d.id)
  if (groupHasOverall(group)) ids.push(OVERALL_ID)
  const followed = followedByGroup.value.get(group.id) ?? []
  return {
    group,
    total: ids.length,
    posted: ids.filter((id) => isPosted(results.value?.[group.id]?.[id])).length,
    unknown: groupHasPlaceholderDancers(group, results.value, points.value),
    mine: followed.map((d) => {
      const day = dayFor(d)
      const all = [...day.dances, ...(day.overall ? [day.overall] : [])]
      return {
        key: d.id,
        name: d.firstName ?? d.fullName,
        color: following.colorFor(d.dancerId),
        medals: all
          .filter((s) => s.state === 'placed' && s.place != null)
          .map((s) => ({ id: s.dance.id, name: s.dance.fullName || s.dance.name || '', place: s.place!, tied: s.tied, dancerId: d.id })),
      }
    }),
  }
}

const sections = computed(() =>
  (resultsHidden.value ? [] : categories.value)
    .map((category) => {
      let rows = groups.value.filter((g) => g.categoryId === category.id).map(rowFor)
      if (mineOnly.value) rows = rows.filter((r) => r.mine.length)
      return { category, rows }
    })
    .filter((s) => s.rows.length),
)

const totals = computed(() => resultsCount(groups.value, dances.value, results.value))

const anyFollowedHere = computed(() => followedByGroup.value.size > 0)
const mineOnly = computed(() => onlyMine.value && anyFollowedHere.value)
</script>

<template>
  <div class="space-y-3">
    <header :ref="setHeader" class="space-y-2">
      <h1 class="text-display">Results</h1>
      <div v-if="totals.total && !resultsHidden" class="space-y-2">
        <!-- How much is in: a hairline that grows as results arrive. -->
        <div class="h-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--foreground)_9%,transparent)]" aria-hidden="true">
          <div
            class="bg-done-foreground h-full rounded-full transition-[width] duration-(--dur-slow) ease-standard"
            :style="{ width: `${(totals.posted / totals.total) * 100}%` }"
          />
        </div>
        <p class="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
          <span><span class="text-foreground font-semibold tabular-nums">{{ totals.posted }} of {{ totals.total }}</span> results posted</span>
          <span v-if="isLive" class="flex items-center gap-1.5">
            <LiveDot :pulse="pulse" />
            <span class="text-live font-semibold">Live</span><template v-if="lastResult"> · {{ lastResult }}</template>
          </span>
        </p>
      </div>
    </header>

    <label
      v-if="anyFollowedHere && !resultsHidden"
      class="surface flex h-11 items-center gap-2 rounded-full pr-1.5 pl-4"
    >
      <span id="only-my-groups" class="text-callout min-w-0 flex-1 truncate font-medium">Only my dancers’ age groups</span>
      <Switch v-model="onlyMine" aria-labelledby="only-my-groups" />
    </label>

    <div v-if="!loaded" class="space-y-2" aria-busy="true">
      <Skeleton v-for="i in 6" :key="i" class="h-14 w-full rounded-xl!" />
    </div>
    <EmptyState
      v-else-if="resultsHidden"
      :icon="Trophy"
      title="No results here"
      description="This competition doesn’t share its results here."
    />
    <EmptyState
      v-else-if="!groups.length"
      :icon="Trophy"
      title="No results yet"
      description="Placings appear here as soon as they’re entered at the competition."
    />

    <!-- Only mine fades through, so the list doesn't jump. -->
    <Transition
      v-else
      mode="out-in"
      enter-active-class="transition-opacity duration-(--dur-quick) ease-standard"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-(--dur-instant) ease-exit"
      leave-to-class="opacity-0"
    >
      <div :key="String(mineOnly)" class="space-y-3">
        <section v-for="s in sections" :key="s.category.id">
          <h2 class="bg-background text-muted-foreground text-callout sticky top-(--chrome-top) z-10 py-2 font-semibold">
            {{ s.category.name || 'Other' }}
          </h2>
          <ul class="surface rows-inset overflow-hidden rounded-2xl">
            <li v-for="r in s.rows" :key="r.group.id">
              <RouterLink
                :to="{ name: 'competition.group', params: { competitionId, groupId: r.group.id } }"
                class="press-row focus-inset relative flex min-h-14 items-center gap-3 py-2 pr-3 pl-4"
                :style="r.mine.length ? { '--dc': r.mine[0].color ?? 'var(--primary)' } : undefined"
              >
                <span v-if="r.mine.length" class="sash absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-base font-semibold">{{ r.group.name || r.group.fullName }}</span>
                  <!-- Said in words: a bare warning sign reads as "something's wrong with the results". -->
                  <span v-if="r.unknown" class="text-muted-foreground mt-0.5 flex items-center gap-1 text-sm">
                    <AlertTriangle class="size-3.5 shrink-0" aria-hidden="true" />
                    Some placings couldn’t be matched to a dancer
                  </span>
                  <MyDancerLine
                    v-for="m in r.mine"
                    :key="m.key"
                    :color="m.color"
                    :name="m.name"
                    :details="[m.medals.length ? null : 'No placings yet']"
                    class="mt-1"
                  >
                    <span v-if="m.medals.length" class="flex items-center gap-1">
                      <Medal
                        v-for="x in m.medals.slice(0, 3)"
                        :key="x.id"
                        :place="x.place"
                        :tied="x.tied"
                        :fresh="isFresh(r.group.id, x.id, x.dancerId)"
                        :dance="x.name"
                        size="sm"
                      />
                      <span v-if="m.medals.length > 3" class="text-muted-foreground text-sm font-medium">+{{ m.medals.length - 3 }}</span>
                    </span>
                  </MyDancerLine>
                </span>
                <ResultsMark :posted="r.posted" :total="r.total" />
                <ChevronRight class="text-muted-foreground size-5 shrink-0" />
              </RouterLink>
            </li>
          </ul>
        </section>
      </div>
    </Transition>
  </div>
</template>
