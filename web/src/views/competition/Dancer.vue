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
import FollowButton from '@/components/FollowButton.vue'
import NumberCard from '@/components/NumberCard.vue'
import Skeleton from '@/components/Skeleton.vue'

const route = useRoute()
const setHeader = injectInfoHeaderSetter()
const { competitionId, competition, dancers, loadDancers, loadResults, loadSchedule } = useCompetition()
const { dayFor, phase } = useCompetitionDays()
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
// the same number. Show every entry.
const entries = computed(() => {
  const d = dancer.value
  if (!d) return []
  const same = d.dancerId ? dancers.value.filter((x) => x.dancerId === d.dancerId) : [d]
  return [d, ...same.filter((x) => x.id !== d.id)].map(dayFor)
})

const color = computed(() =>
  dancer.value && following.isFollowing(dancer.value) ? following.colorFor(dancer.value.dancerId) : null,
)
const firstName = computed(() => dancer.value?.firstName || dancer.value?.fullName || 'this dancer')

// Their dances, the same card as on Home (K8), at the page's size. A placing
// that just arrived flips in.
const fresh = computed(() => {
  for (const e of entries.value)
    for (const s of [...e.dances, ...(e.overall ? [e.overall] : [])])
      if (s.state === 'placed' && isFresh(e.group?.id, s.dance.id, e.dancer.id)) return `${e.dancer.id}:${s.dance.id}`
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
        <NumberCard :number="dancer.number" :color="color" size="xl" />
        <h1 class="text-display mt-5">{{ dancer.fullName }}</h1>
        <p class="text-muted-foreground text-callout mt-1">
          {{ [dancer.group?.fullName, dancer.location].filter(Boolean).join(' · ') }}
        </p>
        <FollowButton v-if="dancer.dancerId" :dancer="dancer" size="block" class="mt-4 w-auto! min-w-48" />
      </header>

      <section class="space-y-2">
        <h2 class="text-heading flex min-h-6 items-center justify-between gap-2 pt-2">
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

      <div v-if="dancer.dancerId" class="surface overflow-hidden rounded-2xl">
        <RouterLink
          :to="{ name: 'dancer.info', params: { dancerId: dancer.dancerId } }"
          class="press-row focus-inset flex min-h-14 items-center gap-3 px-4"
        >
          <span class="flex-1 text-base font-semibold">All competitions for {{ firstName }}</span>
          <ChevronRight class="text-muted-foreground size-5" />
        </RouterLink>
      </div>
    </template>
  </article>
</template>
