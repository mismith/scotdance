<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Star } from '@lucide/vue'
import DancerCompactRow from '@/components/DancerCompactRow.vue'
import EmptyState from '@/components/EmptyState.vue'
import Skeleton from '@/components/Skeleton.vue'
import { useCompetition } from '@/composables/useCompetition'
import { useCompetitionDays } from '@/composables/useCompetitionDays'
import type { DancerCard } from '@/composables/useDancerCards'
import { usePageTitle } from '@/composables/usePageTitle'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { lateSkeleton } from '@/lib/settle'

// Your dancers at this competition, one line each: their star, name, age
// group and where their next dance is, and their placings or "Results to
// come" at the right. Always this shape, however many you follow: Home and
// the Overview just say how many, and this is where they are.
const setHeader = injectInfoHeaderSetter()
const { competitionId, competition, loadDancers, loadResults, loadSchedule } = useCompetition()
const { phase, followedHere } = useCompetitionDays()
usePageTitle(() => ['Your dancers', competition.value?.name])

const ready = computed(() => !!competition.value)
onMounted(() => Promise.all([loadDancers(), loadResults(), loadSchedule()]))

const cards = computed(() =>
  competition.value
    ? followedHere.value.map((f) => ({
        color: f.color,
        card: {
          id: f.personId,
          name: f.name,
          focus: { competitionId: competitionId.value, competition: competition.value!, phase: phase.value, daysAway: null, dayOf: null, days: f.days },
          upcoming: [],
          competitions: [],
          loading: false,
        } satisfies DancerCard,
      }))
    : [],
)
</script>

<template>
  <article class="space-y-4">
    <header :ref="setHeader" class="space-y-1 pt-0.5">
      <h1 class="text-hero">Your dancers</h1>
      <p v-if="cards.length" class="text-muted-foreground text-callout font-medium">
        {{ cards.length }} {{ cards.length === 1 ? 'favourite' : 'favourites' }} here
      </p>
    </header>
    <div v-if="!ready" :class="['space-y-2', lateSkeleton]" aria-busy="true">
      <Skeleton v-for="i in 4" :key="i" class="h-14 w-full rounded-xl!" />
    </div>
    <ul v-else-if="cards.length" class="rows-engraved -mx-4 [--inset:3rem] [--inset-end:1rem]">
      <DancerCompactRow v-for="c in cards" :key="c.card.id" :card="c.card" :color="c.color" star />
    </ul>
    <EmptyState
      v-else
      size="inline"
      :icon="Star"
      title="None of your favourites are here"
      description="Tap the star next to a dancer on Dancers to follow them."
    />
  </article>
</template>
