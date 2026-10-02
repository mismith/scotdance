<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Award, Clock, Hourglass, Trophy } from '@lucide/vue'
import EmptyState from '@/components/EmptyState.vue'
import MyDancerLine from '@/components/MyDancerLine.vue'
import Skeleton from '@/components/Skeleton.vue'
import { useCompetition } from '@/composables/useCompetition'
import { useCompetitionDays } from '@/composables/useCompetitionDays'
import { useDancerNumberVt } from '@/composables/useCompetitionDancerVt'
import { useFreshPlacings } from '@/composables/useCompetitionPlacings'
import { oncePerPerson, useFollowing } from '@/composables/useFollowing'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import Medal from '@/components/Medal.vue'
import NumberCard from '@/components/NumberCard.vue'
import StaffDialog from '@/components/StaffDialog.vue'
import { useMorph } from '@/lib/morph'
import {
  findGroupDancers,
  findGroupDances,
  findPointedDancers,
  getCallbackResults,
  getDanceResults,
} from '@/lib/results'
import { competitionPhase, scheduleIndex } from '@/lib/dancerDay'
import { platformLabel } from '@/lib/schedule'
import { OVERALL_ID, groupHasOverall, staffMemberName, type EnrichedDance, type EnrichedDancer } from '@/types/competition'

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
  staff,
  loadDancers,
  loadResults,
  loadSchedule,
  loadStaff,
  resultsHidden,
} = useCompetition()
const { dayFor } = useCompetitionDays()
const following = useFollowing()
const numberVt = useDancerNumberVt()
const isFresh = useFreshPlacings()

onMounted(() => Promise.all([loadDancers(), loadResults(), loadSchedule(), loadStaff()]))

const groupId = computed(() => String(route.params.groupId ?? ''))
const group = computed(() => groups.value.find((g) => g.id === groupId.value) ?? null)

usePageTitle(() => [group.value?.fullName, competition.value?.name])

const phase = computed(() => competitionPhase(competition.value?.date, schedule.value))
const groupDancers = computed(() =>
  [...findGroupDancers(groupId.value, dancers.value)].sort(
    (a, b) => (a.number ?? Infinity) - (b.number ?? Infinity),
  ),
)

const followedHere = computed(() => oncePerPerson(groupDancers.value.filter((d) => following.isFollowing(d))))
const colorOf = (d: EnrichedDancer | null) => (d && following.isFollowing(d) ? following.colorFor(d.dancerId) : null)
const rowStyle = (d: EnrichedDancer | null) => (colorOf(d) ? following.paint(d!.dancerId) : undefined)

// Where and when, from the schedule (first slot this group dances).
const where = computed(() => {
  if (!group.value) return null
  const idx = scheduleIndex(schedule.value, platforms.value)
  const slot = findGroupDances(group.value, dances.value)
    .map((d) => idx.byGroupDance.get(`${group.value!.id}:${d.id}`))
    .find(Boolean)
  if (!slot) return null
  return [platformLabel(slot.platformName), slot.blockName, slot.blockTime]
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
const callbackRows = computed(() =>
  showAllCallbacks.value
    ? groupDancers.value.map((d) => ({
        dancerId: d.id,
        dancer: d as EnrichedDancer | null,
        out: !callbacks.value.dancers.some((c) => c.dancerId === d.id),
      }))
    : callbacks.value.dancers.map((c) => ({ ...c, out: false })),
)

// Rows that arrive (a placing coming in, everyone shown) grow into place;
// reorders glide. Gentler with Reduce Motion: a fade.
const ROWS_MOVE = {
  enterActiveClass:
    'overflow-hidden transition-[height,opacity] duration-(--dur-base) ease-standard motion-reduce:transition-opacity',
  enterFromClass: 'h-0 opacity-0',
  leaveActiveClass:
    'overflow-hidden transition-[height,opacity] duration-(--dur-quick) ease-exit motion-reduce:transition-opacity',
  leaveToClass: 'h-0 opacity-0',
  moveClass: 'transition-transform duration-(--dur-slow) ease-snappy',
}

const sections = computed(() =>
  (resultsHidden.value ? [] : danceList.value).map((dance) => ({
    dance,
    placings: getDanceResults(groupId.value, dance.id, dancers.value, results.value),
    pointed: findPointedDancers(points.value, groupId.value, dance.id, dancers.value),
    state: stateByDance.value.get(dance.id) ?? null,
  })),
)

// The trophy sponsor: a person under the competition's staff (tap for their
// details), or a typed name on older competitions.
const sponsor = computed(() => {
  const value = group.value?.sponsor?.trim()
  if (!value) return { name: '', member: null }
  const member = staff.value.find((m) => m.id === value) ?? null
  return { name: member ? staffMemberName(member) : value, member }
})
const sponsorOpen = ref(false)
const sponsorSheet = useMorph()
function openSponsor(e: MouseEvent) {
  sponsorOpen.value = true
  sponsorSheet.show(e)
}

function focusHash() {
  const match = route.hash.match(/^#dance-(.+)$/)
  if (!match) return
  nextTick(() => document.getElementById(`dance-${match[1]}`)?.scrollIntoView({ block: 'start' }))
}
watch(() => [groupId.value, route.hash, sections.value.length], focusHash, { immediate: true })
</script>

<template>
  <article class="space-y-4">
    <!-- The page's shape, if it's slow to come (skeletons wait 150ms). -->
    <div v-if="!groups.length" class="space-y-4" aria-busy="true">
      <span class="sr-only">Loading…</span>
      <div class="space-y-2"><Skeleton class="h-4 w-1/4" /><Skeleton class="h-8 w-1/2" /><Skeleton class="h-4 w-2/3" /></div>
      <Skeleton class="h-56 w-full rounded-2xl!" />
      <Skeleton class="h-56 w-full rounded-2xl!" />
    </div>
    <p v-else-if="!group" class="text-muted-foreground py-6 text-base">
      This age group isn’t listed any more. Go back to Results to see the current list.
    </p>

    <template v-else>
      <header :ref="setHeader" class="space-y-1">
        <p v-if="group.category?.name" class="text-muted-foreground text-sm font-medium">{{ group.category.name }}</p>
        <h1 class="text-display">{{ group.name || group.fullName }}</h1>
        <p class="text-muted-foreground text-sm">
          {{ [where, `${groupDancers.length} dancers`].filter(Boolean).join(' · ') }}
        </p>
        <div v-if="followedHere.length" class="space-y-1 pt-1">
          <MyDancerLine v-for="d in followedHere" :key="d.id" :color="colorOf(d)" :name="d.fullName" :details="[`#${d.number}`]" />
        </div>
      </header>

      <EmptyState
        v-if="resultsHidden"
        :icon="Trophy"
        title="No results here"
        description="This competition doesn’t share its results here."
      />

      <!-- Callbacks -->
      <section
        v-if="callbacks.hasResults || callbacks.explicitlyEmpty"
        id="dance-callbacks"
        class="surface scroll-mt-[calc(var(--chrome-top)+0.75rem)] overflow-hidden rounded-2xl"
      >
        <header class="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 class="text-heading">Callbacks</h2>
          <span class="text-muted-foreground text-sm font-medium">{{ callbacks.dancers.length }} called back</span>
        </header>
        <p v-if="callbacks.explicitlyEmpty" class="px-4 py-3 text-base">No callbacks for this group.</p>
        <TransitionGroup tag="ul" class="rows-inset [interpolate-size:allow-keywords] [--inset:4.5rem]" v-bind="ROWS_MOVE">
          <li
            v-for="row in callbackRows"
            :key="row.dancerId"
            :class="['relative transition-opacity duration-(--dur-base)', row.out && 'opacity-45']"
            :style="rowStyle(row.dancer)"
          >
            <span v-if="colorOf(row.dancer)" class="sash absolute inset-y-0 left-0 z-1 w-1.5" aria-hidden="true" />
            <RouterLink
              v-if="row.dancer"
              :to="{ name: 'competition.dancer', params: { competitionId, dancerId: row.dancer.id } }"
              class="press-row focus-inset flex min-h-12 items-center gap-3 px-4 py-1.5"
              @click="numberVt.tap(row.dancerId, 'callbacks')"
            >
              <NumberCard
                :number="row.dancer.number"
                size="xs"
                :color="colorOf(row.dancer)"
                :vt="numberVt.row(row.dancerId, 'callbacks')"
              />
              <span class="min-w-0 flex-1 truncate text-base font-semibold">{{ row.dancer.fullName }}</span>
            </RouterLink>
            <span v-else class="text-muted-foreground flex min-h-12 items-center px-4 text-base">Unknown dancer</span>
          </li>
        </TransitionGroup>
        <button
          v-if="callbacks.dancers.length && callbacks.dancers.length < groupDancers.length"
          type="button"
          class="press-row focus-inset text-primary text-callout h-12 w-full border-t font-semibold"
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
        class="surface scroll-mt-[calc(var(--chrome-top)+0.75rem)] divide-y overflow-hidden rounded-2xl"
      >
        <header class="flex items-center gap-2 px-4 py-3">
          <h2 class="text-heading flex items-center gap-2">
            <Trophy v-if="s.dance.id === OVERALL_ID" class="text-primary size-5" />
            {{ s.dance.fullName || s.dance.name }}
          </h2>
        </header>

        <!-- Kept mounted, so the first placings to arrive grow in too. -->
        <TransitionGroup
          v-show="s.placings.hasResults"
          tag="ul"
          class="rows-inset [interpolate-size:allow-keywords] [--inset:7rem]"
          v-bind="ROWS_MOVE"
        >
          <li v-for="row in s.placings.rows" :key="row.dancerId" class="relative" :style="rowStyle(row.dancer)">
            <span v-if="colorOf(row.dancer)" class="sash absolute inset-y-0 left-0 z-1 w-1.5" aria-hidden="true" />
            <component
              :is="row.dancer ? RouterLink : 'div'"
              v-bind="row.dancer ? { to: { name: 'competition.dancer', params: { competitionId, dancerId: row.dancer.id } } } : {}"
              :class="['flex min-h-13 items-center gap-2.5 px-3 py-1.5', row.dancer && 'press-row focus-inset']"
              @click="row.dancer && numberVt.tap(row.dancerId, s.dance.id)"
            >
              <span class="flex w-9 shrink-0 justify-center">
                <Medal :place="row.place" :tied="row.tied" :fresh="isFresh(groupId, s.dance.id, row.dancerId)" />
              </span>
              <template v-if="row.dancer">
                <NumberCard
                  :number="row.dancer.number"
                  size="xs"
                  :color="colorOf(row.dancer)"
                  :vt="numberVt.row(row.dancerId, s.dance.id)"
                />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-base font-semibold">{{ row.dancer.fullName }}</span>
                  <span v-if="row.dancer.location" class="text-muted-foreground block truncate text-sm">{{ row.dancer.location }}</span>
                </span>
              </template>
              <span v-else class="text-muted-foreground text-base">Unknown dancer</span>
            </component>
          </li>
        </TransitionGroup>
        <div v-if="!s.placings.hasResults" class="text-muted-foreground flex items-start gap-3 px-4 py-4 text-base">
          <template v-if="s.placings.explicitlyEmpty">No placings for this dance.</template>
          <template v-else-if="s.dance.id === OVERALL_ID">
            <Clock class="mt-0.5 size-5 shrink-0" />
            <span>Posted after all the dances are in.</span>
          </template>
          <template v-else-if="s.state === 'waiting'">
            <Hourglass class="mt-0.5 size-5 shrink-0" />
            <span><span class="text-foreground font-semibold">Danced. Waiting for results.</span><br />Placings appear here as soon as they’re entered.</span>
          </template>
          <template v-else-if="s.state === 'next'">
            <Clock class="mt-0.5 size-5 shrink-0" />
            <span><span class="text-foreground font-semibold">Up next.</span> Not danced yet.</span>
          </template>
          <template v-else-if="phase === 'after'">No result was posted for this dance.</template>
          <template v-else>
            <Clock class="mt-0.5 size-5 shrink-0" />
            <span>Not danced yet.</span>
          </template>
        </div>

        <!-- Who sponsors the age group's trophy (under Overall, as before) -->
        <component
          :is="sponsor.member ? 'button' : 'div'"
          v-if="s.dance.id === OVERALL_ID && sponsor.name"
          :type="sponsor.member ? 'button' : undefined"
          :class="['flex w-full items-center gap-3 px-4 py-3 text-left', sponsor.member && 'press-row focus-inset']"
          @click="sponsor.member && openSponsor($event)"
        >
          <Award class="text-primary size-5 shrink-0" />
          <span class="min-w-0 flex-1">
            <span class="block text-base font-semibold">{{ sponsor.name }}</span>
            <span class="text-muted-foreground block text-sm">{{ !group.trophy ? 'Trophy sponsor' : /trophy/i.test(group.trophy) ? `${group.trophy} sponsor` : `${group.trophy} Trophy sponsor` }}</span>
          </span>
        </component>

        <div v-if="s.pointed.length" class="px-4 py-3">
          <p class="text-sm font-semibold">Championship points</p>
          <p class="text-muted-foreground text-sm">
            {{ s.pointed.map((d) => `${d.number ?? ''} ${d.fullName}`.trim()).join(', ') }}
          </p>
        </div>
      </section>
    </template>
    <StaffDialog :member="sponsorOpen ? sponsor.member : null" :morph="sponsorSheet" @close="sponsorSheet.hide().then(() => (sponsorOpen = false))" />
  </article>
</template>
