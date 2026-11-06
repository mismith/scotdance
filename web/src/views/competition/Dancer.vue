<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ChevronRight } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useCompetitionDays } from '@/composables/useCompetitionDays'
import { useFreshPlacings } from '@/composables/useCompetitionPlacings'
import { useFollowing } from '@/composables/useFollowing'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import DancerDayCard from '@/components/DancerDayCard.vue'
import DancerLookButton from '@/components/DancerLookButton.vue'
import FollowButton from '@/components/FollowButton.vue'
import NumberCard from '@/components/NumberCard.vue'
import Skeleton from '@/components/Skeleton.vue'
import { TROPHY_EVENT_RESULT } from '@/lib/trophyEvents'
import { dancerPlace } from '@/lib/competitionInfo'
import { heroTitle } from '@/lib/heroTitle'
import { entryLine } from '@/lib/entries'
import type { EnrichedMember } from '@/types/competition'

const route = useRoute()
const setHeader = injectInfoHeaderSetter()
const { competitionId, competition, dancers, loadDancers, loadResults, loadSchedule } = useCompetition()
const { dayFor, entriesFor, phase } = useCompetitionDays()
const following = useFollowing()
const isFresh = useFreshPlacings()

const loaded = ref(false)
onMounted(async () => {
  await Promise.all([loadDancers(), loadResults(), loadSchedule()])
  loaded.value = true
})

const dancerId = computed(() => String(route.params.dancerId ?? ''))
const dancer = computed(() => dancers.value.find((d) => d.id === dancerId.value) ?? null)

usePageTitle(() => [dancer.value?.fullName, competition.value?.name])

// The same person can be entered in more than one age group here, under
// the same number, and dance in teams too. Show every entry. A team's page
// is the team's own day.
const entries = computed(() => {
  const d = dancer.value
  if (!d) return []
  if (d.team) return [dayFor(d)]
  const same = d.dancerId ? entriesFor(d.dancerId) : [d]
  return [d, ...same.filter((x) => x.id !== d.id)].map(dayFor)
})

// A team's dancers, each linking to their own entry here, or else their profile.
const members = computed(() =>
  (dancer.value?.teamMembers ?? []).map((m: EnrichedMember) => {
    const own = m.dancerId ? dancers.value.find((x) => !x.team && x.dancerId === m.dancerId) : null
    return {
      m,
      own,
      to: own
        ? { name: 'competition.dancer', params: { competitionId: competitionId.value, dancerId: own.id } }
        : m.dancerId
          ? { name: 'dancer.info', params: { dancerId: m.dancerId } }
          : null,
      color: m.dancerId && following.isFollowing(m.dancerId) ? following.colorFor(m.dancerId) : null,
    }
  }),
)
const teamLine = computed(() => {
  const d = dancer.value
  if (!d?.team) return ''
  return [d.group?.fullName, d.studio && d.studio !== d.fullName ? d.studio : null, d.location].filter(Boolean).join(' · ')
})

const color = computed(() =>
  dancer.value && following.isFollowing(dancer.value) ? following.colorFor(following.followedIn(dancer.value)) : null,
)
const firstName = computed(() => dancer.value?.firstName || dancer.value?.fullName || 'this dancer')

// Their dances, the same card as on Home (K8), at the page's size. A placing
// that just arrived flips in.
const fresh = computed(() => {
  for (const e of entries.value)
    for (const s of [...e.dances, ...(e.overall ? [e.overall] : [])])
      if (s.state === 'placed' && isFresh(e.group?.id, s.dance.id, e.dancer.id)) return `${e.dancer.id}:${s.dance.id}`
  for (const e of entries.value)
    for (const s of e.trophyEvents)
      if (s.state === 'placed' && isFresh(s.dance.id, TROPHY_EVENT_RESULT, e.dancer.id)) return `${e.dancer.id}:${s.dance.id}`
  return null
})
</script>

<template>
  <article class="space-y-4">
    <!-- The page's shape, if it's slow to come (skeletons wait 150ms). -->
    <div v-if="!dancer && !loaded" class="space-y-4" aria-busy="true">
      <span class="sr-only">Loading…</span>
      <div class="flex flex-col items-center gap-3 pt-2">
        <Skeleton class="h-32 w-44 rounded-2xl!" />
        <Skeleton class="mt-2 h-8 w-2/3" />
        <Skeleton class="h-4 w-1/2" />
        <Skeleton class="h-12 w-48 rounded-full!" />
      </div>
      <Skeleton class="h-5 w-24" />
      <Skeleton class="h-64 w-full rounded-2xl!" />
    </div>
    <p v-else-if="!dancer" class="text-muted-foreground py-6 text-base">
      This dancer isn’t on the list any more. Go back to Dancers to see the current list.
    </p>

    <template v-else>
      <!-- Their number card at poster size: the bib they're wearing today. -->
      <header :ref="setHeader" class="flex flex-col items-center pt-2 text-center">
        <DancerLookButton
          v-if="dancer.dancerId"
          :dancer-id="dancer.dancerId"
          :name="dancer.fullName"
          :label="dancer.number != null ? `Number ${dancer.number}` : undefined"
          shape="card"
        >
          <NumberCard :number="dancer.number" :color="color" size="xl" />
        </DancerLookButton>
        <NumberCard v-else :number="dancer.number" :color="color" size="xl" />
        <h1 :class="[heroTitle(dancer.fullName), 'mt-5']">{{ dancer.fullName }}</h1>
        <p class="text-muted-foreground text-callout mt-1.5">
          {{
            dancer.team
              ? [members.length > 1 ? `${members.length} dancers` : null, teamLine].filter(Boolean).join(' · ')
              : [dancer.group?.fullName, entryLine(dancer, { location: false }), dancerPlace(dancer.location, dancer.group)].filter(Boolean).join(' · ')
          }}
        </p>
        <FollowButton v-if="dancer.dancerId" :dancer="dancer" size="block" class="mt-4 w-auto! min-w-48" />
      </header>

      <!-- A team's dancers: follow any of them to follow the team. -->
      <section v-if="dancer.team && members.length" class="space-y-2">
        <h2 class="text-heading pt-2">Dancers</h2>
        <ul class="surface rows-inset overflow-hidden rounded-2xl [--inset:1rem]">
          <li
            v-for="{ m, own, to, color: c } in members"
            :key="m.key"
            class="relative flex items-center gap-1 pr-2"
            :style="c ? { '--dc': c } : undefined"
          >
            <span v-if="c" class="sash absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
            <RouterLink v-if="to" :to="to" class="press-row focus-inset flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-r-xl py-2 pl-4">
              <span class="min-w-0 flex-1">
                <span class="block truncate text-base font-semibold">{{ m.name }}</span>
                <span v-if="own" class="text-muted-foreground block truncate text-sm">Also dancing {{ own.group?.fullName ?? 'here' }}</span>
              </span>
              <ChevronRight class="text-muted-foreground size-5 shrink-0" />
            </RouterLink>
            <span v-else class="flex min-h-14 min-w-0 flex-1 items-center py-2 pl-4 text-base font-semibold">{{ m.name }}</span>
            <FollowButton v-if="m.dancerId" :dancer="{ dancerId: m.dancerId, firstName: m.firstName, lastName: m.lastName, fullName: m.name }" />
          </li>
        </ul>
      </section>

      <section class="space-y-2">
        <h2 class="text-section flex min-h-6 items-center justify-between gap-2 pt-2">
          <span>{{ phase === 'today' ? 'Today' : phase === 'before' ? 'Dances' : 'Results' }}</span>
          <RouterLink
            v-if="entries.length === 1 && entries[0]?.group"
            :to="{ name: 'competition.group', params: { competitionId, groupId: entries[0].group.id } }"
            class="press text-primary -my-2.5 -mr-2 flex h-11 items-center rounded-full px-2 text-callout font-semibold"
          >
            Age group results
          </RouterLink>
        </h2>
        <DancerDayCard :days="entries" :competition-id="competitionId" :color="color" :fresh="fresh" size="lg" bare />
      </section>

      <div v-if="dancer.dancerId" class="-mx-4">
        <RouterLink
          :to="{ name: 'dancer.info', params: { dancerId: dancer.dancerId } }"
          class="press-row focus-inset flex min-h-14 items-center gap-3 pr-3 pl-4"
        >
          <span class="flex-1 text-base font-semibold">All competitions for {{ firstName }}</span>
          <ChevronRight class="text-muted-foreground size-5" />
        </RouterLink>
      </div>
    </template>
  </article>
</template>
