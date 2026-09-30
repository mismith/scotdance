<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Clock, Hourglass, Star, Trophy } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useCompetitionDays } from '@/composables/useCompetitionDays'
import { useFollowing } from '@/composables/useFollowing'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import Medal from '@/components/Medal.vue'
import NumberCard from '@/components/NumberCard.vue'
import StepsHelp from '@/components/StepsHelp.vue'
import {
  findGroupDancers,
  findGroupDances,
  findPointedDancers,
  getCallbackResults,
  getDanceResults,
} from '@/lib/results'
import { competitionPhase, scheduleIndex } from '@/lib/dancerDay'
import { OVERALL_ID, groupHasOverall, type EnrichedDance, type EnrichedDancer } from '@/types/competition'

const route = useRoute()
const setHeader = injectInfoHeaderSetter()
const {
  competitionId,
  competition,
  groups,
  dancers,
  dances,
  results,
  points,
  schedule,
  platforms,
  loadDancers,
  loadResults,
  loadSchedule,
} = useCompetition()
const { dayFor } = useCompetitionDays()
const following = useFollowing()

onMounted(() => Promise.all([loadDancers(), loadResults(), loadSchedule()]))

const groupId = computed(() => String(route.params.groupId ?? ''))
const group = computed(() => groups.value.find((g) => g.id === groupId.value) ?? null)

usePageTitle(() => [group.value?.fullName, competition.value?.name])

const phase = computed(() => competitionPhase(competition.value?.date))
const groupDancers = computed(() =>
  [...findGroupDancers(groupId.value, dancers.value)].sort(
    (a, b) => (a.number ?? Infinity) - (b.number ?? Infinity),
  ),
)

const followedHere = computed(() => groupDancers.value.filter((d) => following.isFollowing(d)))
const colorOf = (d: EnrichedDancer | null) => (d && following.isFollowing(d) ? following.colorFor(d.dancerId) : null)

// Where and when, from the schedule (first slot this group dances).
const where = computed(() => {
  if (!group.value) return null
  const idx = scheduleIndex(schedule.value, platforms.value)
  const slot = findGroupDances(group.value, dances.value)
    .map((d) => idx.byGroupDance.get(`${group.value!.id}:${d.id}`))
    .find(Boolean)
  if (!slot) return null
  return [slot.platformName ? `Platform ${slot.platformName}` : null, slot.blockName, slot.blockTime]
    .filter(Boolean)
    .join(' · ')
})

// Per-dance state for the group, borrowed from the first followed dancer's
// day where possible (so "waiting" vs "next" matches their card), otherwise
// from any dancer in the group.
const sample = computed(() => followedHere.value[0] ?? groupDancers.value[0] ?? null)
const stateByDance = computed(() => {
  const m = new Map<string, string>()
  if (!sample.value) return m
  const day = dayFor(sample.value)
  for (const s of day.dances) m.set(s.dance.id, s.state)
  return m
})

const danceList = computed<EnrichedDance[]>(() => {
  if (!group.value) return []
  const list = [...findGroupDances(group.value, dances.value)]
  if (groupHasOverall(group.value)) list.push({ id: OVERALL_ID, fullName: 'Overall', name: 'Overall' })
  return list
})

const callbacks = computed(() => getCallbackResults(groupId.value, dancers.value, results.value))
const showAllCallbacks = ref(false)

const sections = computed(() =>
  danceList.value.map((dance) => ({
    dance,
    placings: getDanceResults(groupId.value, dance.id, dancers.value, results.value),
    pointed: findPointedDancers(points.value, groupId.value, dance.id, dancers.value),
    state: stateByDance.value.get(dance.id) ?? null,
  })),
)

function focusHash() {
  const match = route.hash.match(/^#dance-(.+)$/)
  if (!match) return
  nextTick(() => document.getElementById(`dance-${match[1]}`)?.scrollIntoView({ block: 'start' }))
}
watch(() => [groupId.value, route.hash, sections.value.length], focusHash, { immediate: true })
</script>

<template>
  <article class="space-y-4">
    <p v-if="!groups.length" class="text-muted-foreground py-6 text-base">Loading…</p>
    <p v-else-if="!group" class="text-muted-foreground py-6 text-base">
      This age group isn’t listed any more. Go back to Results to see the current list.
    </p>

    <template v-else>
      <header :ref="setHeader" class="space-y-1">
        <p v-if="group.category?.name" class="text-muted-foreground text-sm font-bold">{{ group.category.name }}</p>
        <h1 class="text-display">{{ group.name || group.fullName }}</h1>
        <p class="text-muted-foreground text-sm">
          {{ [where, `${groupDancers.length} dancers`].filter(Boolean).join(' · ') }}
        </p>
        <p v-if="followedHere.length" class="flex flex-wrap items-center gap-1.5 pt-1 text-sm font-bold">
          <span v-for="d in followedHere" :key="d.id" class="inline-flex items-center gap-1">
            <Star class="size-4 fill-current" :style="{ color: colorOf(d) ?? 'var(--primary)' }" />
            {{ d.fullName }} · {{ d.number }}
          </span>
        </p>
      </header>

      <!-- Callbacks -->
      <section
        v-if="callbacks.hasResults || callbacks.explicitlyEmpty"
        id="dance-callbacks"
        class="bg-card scroll-mt-[calc(var(--chrome-top)+0.75rem)] overflow-hidden rounded-2xl border shadow-sm"
      >
        <header class="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 class="text-heading">Callbacks</h2>
          <span class="text-muted-foreground text-sm font-semibold">{{ callbacks.dancers.length }} called back</span>
        </header>
        <p class="text-muted-foreground px-4 pt-3 text-sm">Dancers invited back to dance again in the final round.</p>
        <p v-if="callbacks.explicitlyEmpty" class="px-4 py-3 text-base">No callbacks for this group.</p>
        <ul class="divide-y">
          <li
            v-for="row in showAllCallbacks
              ? groupDancers.map((d) => ({ dancerId: d.id, dancer: d as EnrichedDancer | null }))
              : callbacks.dancers"
            :key="row.dancerId"
            :class="[
              'relative flex min-h-12 items-center gap-3 px-4 py-1.5',
              showAllCallbacks && !callbacks.dancers.some((c) => c.dancerId === row.dancerId) && 'opacity-45',
            ]"
            :style="colorOf(row.dancer) ? { '--dc': colorOf(row.dancer)!, backgroundColor: 'color-mix(in srgb, var(--dc) 9%, var(--card))' } : undefined"
          >
            <span v-if="colorOf(row.dancer)" class="sash absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
            <template v-if="row.dancer">
              <NumberCard :number="row.dancer.number" size="xs" :color="colorOf(row.dancer)" />
              <RouterLink
                :to="{ name: 'competition.dancer', params: { competitionId, dancerId: row.dancer.id } }"
                class="min-w-0 flex-1 truncate text-base font-semibold"
              >
                {{ row.dancer.fullName }}
              </RouterLink>
            </template>
            <span v-else class="text-muted-foreground text-base">Unknown dancer</span>
          </li>
        </ul>
        <button
          v-if="callbacks.dancers.length && callbacks.dancers.length < groupDancers.length"
          type="button"
          class="text-primary h-12 w-full border-t text-[0.9375rem] font-bold"
          @click="showAllCallbacks = !showAllCallbacks"
        >
          {{ showAllCallbacks ? 'Show callbacks only' : `Show all ${groupDancers.length} dancers` }}
        </button>
      </section>

      <!-- Dances + overall -->
      <section
        v-for="s in sections"
        :id="`dance-${s.dance.id}`"
        :key="s.dance.id"
        class="bg-card scroll-mt-[calc(var(--chrome-top)+0.75rem)] overflow-hidden rounded-2xl border shadow-sm"
      >
        <header class="flex items-center justify-between gap-2 border-b py-2.5 pr-2.5 pl-4">
          <h2 class="text-heading flex items-center gap-2">
            <Trophy v-if="s.dance.id === OVERALL_ID" class="text-primary size-5" />
            {{ s.dance.name || s.dance.fullName }}
          </h2>
          <StepsHelp :steps="s.dance.steps" :dance="s.dance.name" />
        </header>

        <ul v-if="s.placings.hasResults" class="divide-y">
          <li
            v-for="row in s.placings.rows"
            :key="row.dancerId"
            class="relative flex min-h-13 items-center gap-2.5 px-3 py-1.5"
            :style="colorOf(row.dancer) ? { '--dc': colorOf(row.dancer)!, backgroundColor: 'color-mix(in srgb, var(--dc) 9%, var(--card))' } : undefined"
          >
            <span v-if="colorOf(row.dancer)" class="sash absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
            <Medal :place="row.place" :tied="row.tied" />
            <template v-if="row.dancer">
              <NumberCard :number="row.dancer.number" size="xs" :color="colorOf(row.dancer)" />
              <RouterLink
                :to="{ name: 'competition.dancer', params: { competitionId, dancerId: row.dancer.id } }"
                class="min-w-0 flex-1"
              >
                <span class="block truncate text-base font-semibold">{{ row.dancer.fullName }}</span>
                <span v-if="row.dancer.location" class="text-muted-foreground block truncate text-sm">{{ row.dancer.location }}</span>
              </RouterLink>
              <Star
                v-if="colorOf(row.dancer)"
                class="size-5 shrink-0 fill-current"
                :style="{ color: colorOf(row.dancer)! }"
                aria-label="Following"
              />
            </template>
            <span v-else class="text-muted-foreground text-base">Unknown dancer</span>
          </li>
        </ul>
        <div v-else class="text-muted-foreground flex items-start gap-3 px-4 py-4 text-base">
          <template v-if="s.placings.explicitlyEmpty">No placings for this dance.</template>
          <template v-else-if="s.dance.id === OVERALL_ID">
            <Clock class="mt-0.5 size-5 shrink-0" />
            <span>Posted after all the dances are in.</span>
          </template>
          <template v-else-if="s.state === 'waiting'">
            <Hourglass class="mt-0.5 size-5 shrink-0" />
            <span><b class="text-foreground">Danced. Waiting for results.</b><br />Placings appear here as soon as they’re entered.</span>
          </template>
          <template v-else-if="s.state === 'next'">
            <Clock class="mt-0.5 size-5 shrink-0" />
            <span><b class="text-foreground">Up next.</b> Not danced yet.</span>
          </template>
          <template v-else-if="phase === 'after'">No result was posted for this dance.</template>
          <template v-else>
            <Clock class="mt-0.5 size-5 shrink-0" />
            <span>Not danced yet.</span>
          </template>
        </div>

        <div v-if="s.pointed.length" class="border-t px-4 py-3">
          <p class="text-sm font-bold">Championship points</p>
          <p class="text-muted-foreground text-sm">
            {{ s.pointed.map((d) => `${d.number ?? ''} ${d.fullName}`.trim()).join(', ') }}
          </p>
        </div>
      </section>
    </template>
  </article>
</template>
