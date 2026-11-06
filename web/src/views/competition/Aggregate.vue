<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Award, Clock, Trophy } from '@lucide/vue'
import { rowsMove } from '@/lib/settle'
import EmptyState from '@/components/EmptyState.vue'
import Medal from '@/components/Medal.vue'
import MyDancerLine from '@/components/MyDancerLine.vue'
import NumberCard from '@/components/NumberCard.vue'
import Skeleton from '@/components/Skeleton.vue'
import StaffDialog from '@/components/StaffDialog.vue'
import { useCompetition } from '@/composables/useCompetition'
import { useFreshPlacings } from '@/composables/useCompetitionPlacings'
import { oncePerPerson, useFollowing } from '@/composables/useFollowing'
import { usePageTitle } from '@/composables/usePageTitle'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { AGGREGATE_RESULT } from '@/lib/aggregates'
import { competitionPhase } from '@/lib/dancerDay'
import { heroTitle } from '@/lib/heroTitle'
import { useMorph } from '@/lib/morph'
import { getDanceResults } from '@/lib/results'
import { staffMemberName, type EnrichedDancer, type EnrichedGroup } from '@/types/competition'

// One aggregate: a trophy across age groups, with its one list of placings
// (entered by the organiser, never worked out). The page is a short Group:
// a header, then the list, with each dancer's own age group under their name
// since the list mixes them.

const route = useRoute()
const setHeader = injectInfoHeaderSetter()
const { competitionId, competition, groups, aggregates, dancers, results, schedule, staff, loadDancers, loadResults, loadSchedule, loadStaff, resultsHidden } =
  useCompetition()
const following = useFollowing()
const isFresh = useFreshPlacings()

onMounted(() => Promise.all([loadDancers(), loadResults(), loadSchedule(), loadStaff()]))

const aggregateId = computed(() => String(route.params.aggregateId ?? ''))
const aggregate = computed(() => aggregates.value.find((a) => a.id === aggregateId.value) ?? null)

usePageTitle(() => [aggregate.value?.fullName, competition.value?.name])

const phase = computed(() => competitionPhase(competition.value?.date, schedule.value))

// Who can win it, and which of them are yours.
const eligible = computed(() => {
  const on = aggregate.value?.groupIds
  return dancers.value
    .filter((d) => d.group && on?.[d.group.id])
    .sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity))
})
const followedHere = computed(() => oncePerPerson(eligible.value.filter((d) => following.isFollowing(d))))
const colorOf = (d: EnrichedDancer | null) => (d && following.isFollowing(d) ? following.colorFor(d.dancerId) : null)
const rowStyle = (d: EnrichedDancer | null) => (colorOf(d) ? following.paint(d!.dancerId) : undefined)

const placings = computed(() => getDanceResults(aggregateId.value, AGGREGATE_RESULT, dancers.value, results.value))

// The trophy sponsor: a person under the competition's staff (tap for their
// details), or a typed name.
const sponsor = computed(() => {
  const value = aggregate.value?.sponsor?.trim()
  if (!value) return { name: '', member: null }
  const member = staff.value.find((m) => m.id === value) ?? null
  return { name: member ? staffMemberName(member) : value, member }
})
// What the row under the placings says: the sponsor over the trophy's name,
// or the trophy alone (an age group's Overall words it the same way).
const trophyLine = computed(() => {
  const trophy = aggregate.value?.trophy?.trim()
  if (!sponsor.value.name) return 'Trophy'
  return !trophy ? 'Trophy sponsor' : /trophy/i.test(trophy) ? `${trophy} sponsor` : `${trophy} Trophy sponsor`
})
// A dancer's age group, without the category when every age group it's open
// to shares one ("16 & Over", not "Premier 16 & Over" over and over).
const oneCategory = computed(() => {
  const ids = new Set(aggregate.value?.groups.map((g) => g.categoryId ?? '') ?? [])
  return ids.size === 1
})
const groupLabel = (g: EnrichedGroup) => (oneCategory.value && g.name?.trim() ? g.name.trim() : g.fullName)
const sponsorOpen = ref(false)
const sponsorSheet = useMorph()
function openSponsor(e: MouseEvent) {
  sponsorOpen.value = true
  sponsorSheet.show(e)
}
</script>

<template>
  <article class="space-y-4">
    <!-- The page's shape, if it's slow to come (skeletons wait 150ms). -->
    <div v-if="!groups.length" class="space-y-4" aria-busy="true">
      <span class="sr-only">Loading…</span>
      <div class="space-y-2"><Skeleton class="h-8 w-1/2" /><Skeleton class="h-4 w-2/3" /></div>
      <Skeleton class="h-56 w-full rounded-2xl!" />
    </div>
    <p v-else-if="!aggregate" class="text-muted-foreground py-6 text-base">
      This aggregate isn’t listed any more. Go back to Results to see the current list.
    </p>

    <template v-else>
      <header :ref="setHeader" class="space-y-1 pt-0.5">
        <h1 :class="heroTitle(aggregate.fullName)">{{ aggregate.fullName }}</h1>
        <p v-if="aggregate.openTo" class="text-muted-foreground text-callout">Open to {{ aggregate.openTo }}</p>
        <div v-if="followedHere.length" class="space-y-1 pt-1">
          <MyDancerLine
            v-for="d in followedHere"
            :key="d.id"
            :color="colorOf(d)"
            :name="d.fullName"
            :details="[`#${d.number}`, d.group && groupLabel(d.group)]"
          />
        </div>
      </header>

      <EmptyState
        v-if="resultsHidden"
        :icon="Trophy"
        title="No results here"
        description="This competition doesn’t share its results here."
      />

      <section v-else class="space-y-2 pt-2">
        <h2 class="sr-only">Placings</h2>
        <div class="rows-engraved -mx-4 [--inset:1rem] [--inset-end:1rem]">
          <div v-if="!placings.hasResults" class="text-muted-foreground flex items-start gap-3 px-4 py-4 text-base">
            <!-- Worded as an age group's Overall is. -->
            <template v-if="placings.explicitlyEmpty">No results for this aggregate.</template>
            <template v-else-if="phase === 'after'">No result was posted for this aggregate.</template>
            <template v-else>
              <Clock class="mt-0.5 size-5 shrink-0" />
              <span>Posted after all the dances are in.</span>
            </template>
          </div>

          <!-- Kept mounted, so the first placings to arrive grow in too. -->
          <TransitionGroup
            v-show="placings.hasResults"
            tag="ul"
            class="rows-engraved [interpolate-size:allow-keywords] [--inset:7rem] [--inset-end:1rem]"
            v-bind="rowsMove"
          >
            <li v-for="row in placings.rows" :key="row.dancerId" class="relative isolate" :style="rowStyle(row.dancer)">
              <span v-if="colorOf(row.dancer)" class="dancer-sash" aria-hidden="true" />
              <component
                :is="row.dancer ? RouterLink : 'div'"
                v-bind="row.dancer ? { to: { name: 'competition.dancer', params: { competitionId, dancerId: row.dancer.id } } } : {}"
                :class="['flex min-h-13 items-center gap-2.5 px-3 py-1.5', row.dancer && 'press-row focus-inset']"
              >
                <span class="flex w-9 shrink-0 justify-center">
                  <Medal :place="row.place" :tied="row.tied" :fresh="isFresh(aggregateId, AGGREGATE_RESULT, row.dancerId)" :dance="aggregate.fullName" />
                </span>
                <template v-if="row.dancer">
                  <NumberCard :number="row.dancer.number" size="xs" :color="colorOf(row.dancer)" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-base font-semibold">{{ row.dancer.fullName }}</span>
                    <span v-if="row.dancer.group" class="text-muted-foreground block truncate text-sm">{{ groupLabel(row.dancer.group) }}</span>
                  </span>
                </template>
                <span v-else class="text-muted-foreground text-base">Unknown dancer</span>
              </component>
            </li>
          </TransitionGroup>

          <!-- Its trophy and who sponsors it, under the placings as on an age group's Overall. -->
          <component
            :is="sponsor.member ? 'button' : 'div'"
            v-if="sponsor.name || aggregate.trophy"
            :type="sponsor.member ? 'button' : undefined"
            :class="['flex w-full items-center gap-3 px-4 py-3 text-left', sponsor.member && 'press-row focus-inset']"
            @click="sponsor.member && openSponsor($event)"
          >
            <Award class="text-primary size-5 shrink-0" />
            <span class="min-w-0 flex-1">
              <span class="block text-base font-semibold">{{ sponsor.name || aggregate.trophy }}</span>
              <span class="text-muted-foreground block text-sm">{{ trophyLine }}</span>
            </span>
          </component>
        </div>
      </section>
    </template>
    <StaffDialog :member="sponsorOpen ? sponsor.member : null" :morph="sponsorSheet" @close="sponsorSheet.hide().then(() => (sponsorOpen = false))" />
  </article>
</template>
