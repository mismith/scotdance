<script setup lang="ts">
import MyDancerLine from '@/components/MyDancerLine.vue'
import ResultsMark from '@/components/ResultsMark.vue'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { AlertTriangle, ChevronRight, Star, Trophy } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useCompetitionDays } from '@/composables/useCompetitionDays'
import { useFollowing } from '@/composables/useFollowing'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { findGroupDances, groupHasPlaceholderDancers } from '@/lib/results'
import { OVERALL_ID, groupHasOverall, type EnrichedGroup } from '@/types/competition'
import EmptyState from '@/components/EmptyState.vue'
import Medal from '@/components/Medal.vue'
import Skeleton from '@/components/Skeleton.vue'

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
} = useCompetition()
const { followedByGroup, dayFor } = useCompetitionDays()
const following = useFollowing()

const loaded = ref(false)
onMounted(async () => {
  await Promise.all([loadDancers(), loadResults(), loadSchedule()])
  loaded.value = true
})

const onlyMine = ref(false)

function isPosted(groupId: string, danceId: string) {
  const raw = results.value?.[groupId]?.[danceId]
  return raw === false || (Array.isArray(raw) && raw.length > 0)
}

interface Row {
  group: EnrichedGroup
  total: number
  posted: number
  unknown: boolean
  mine: Array<{ key: string; name: string; color: string | null; medals: Array<{ id: string; place: number; tied: boolean }> }>
}

function rowFor(group: EnrichedGroup): Row {
  const ids = findGroupDances(group, dances.value).map((d) => d.id)
  if (groupHasOverall(group)) ids.push(OVERALL_ID)
  const followed = followedByGroup.value.get(group.id) ?? []
  return {
    group,
    total: ids.length,
    posted: ids.filter((id) => isPosted(group.id, id)).length,
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
          .map((s) => ({ id: s.dance.id, place: s.place!, tied: s.tied })),
      }
    }),
  }
}

const sections = computed(() =>
  categories.value
    .map((category) => {
      let rows = groups.value.filter((g) => g.categoryId === category.id).map(rowFor)
      if (onlyMine.value) rows = rows.filter((r) => r.mine.length)
      return { category, rows }
    })
    .filter((s) => s.rows.length),
)

const totals = computed(() => {
  let total = 0
  let posted = 0
  for (const g of groups.value) {
    const r = rowFor(g)
    total += r.total
    posted += r.posted
  }
  return { total, posted }
})

const anyFollowedHere = computed(() => followedByGroup.value.size > 0)
</script>

<template>
  <div class="space-y-3">
    <header :ref="setHeader" class="space-y-2">
      <h1 class="text-display">Results</h1>
      <div v-if="totals.total" class="space-y-1.5">
        <div class="bg-muted h-2.5 overflow-hidden rounded-full border" aria-hidden="true">
          <div
            class="bg-done-foreground h-full rounded-full transition-[width] duration-500"
            :style="{ width: `${Math.round((totals.posted / totals.total) * 100)}%` }"
          />
        </div>
        <p class="text-muted-foreground text-sm">
          <b class="text-foreground">{{ totals.posted }} of {{ totals.total }}</b> results posted
          <template v-if="isLive"> · updating live</template>
        </p>
      </div>
    </header>

    <button
      v-if="anyFollowedHere"
      type="button"
      role="switch"
      :aria-checked="onlyMine"
      class="bg-card flex h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-[0.9375rem] font-bold"
      @click="onlyMine = !onlyMine"
    >
      <Star :class="['size-4 shrink-0', onlyMine ? 'text-primary fill-current' : 'text-muted-foreground']" />
      <span class="flex-1">Only my dancers’ age groups</span>
      <span
        :class="[
          'relative h-6 w-10 shrink-0 rounded-full transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform',
          onlyMine ? 'bg-primary after:translate-x-4' : 'bg-strong',
        ]"
        aria-hidden="true"
      />
    </button>

    <div v-if="!loaded" class="space-y-2" aria-busy="true">
      <Skeleton v-for="i in 6" :key="i" class="h-14 w-full rounded-xl!" />
    </div>
    <EmptyState
      v-else-if="!groups.length"
      :icon="Trophy"
      title="No results yet"
      description="Placings appear here as soon as they’re entered at the competition."
    />

    <section v-for="s in sections" :key="s.category.id">
      <h2 class="bg-background sticky top-(--chrome-top) z-10 py-2 text-[1.0625rem] font-extrabold">
        {{ s.category.name || 'Other' }}
      </h2>
      <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
        <li v-for="r in s.rows" :key="r.group.id">
          <RouterLink
            :to="{ name: 'competition.group', params: { competitionId, groupId: r.group.id } }"
            class="relative flex min-h-14 items-center gap-3 py-2 pr-2 pl-4 hover:bg-accent"
            :style="r.mine.length ? { '--dc': r.mine[0].color ?? 'var(--primary)' } : undefined"
          >
            <span v-if="r.mine.length" class="sash absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1.5 text-base font-bold">
                <span class="truncate">{{ r.group.name || r.group.fullName }}</span>
                <AlertTriangle
                  v-if="r.unknown"
                  class="text-next-foreground size-4 shrink-0"
                  aria-label="Some placings couldn’t be matched to a dancer"
                />
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
                  <Medal v-for="x in m.medals.slice(0, 3)" :key="x.id" :place="x.place" :tied="x.tied" size="sm" />
                  <span v-if="m.medals.length > 3" class="text-muted-foreground text-sm font-semibold">+{{ m.medals.length - 3 }}</span>
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
</template>
