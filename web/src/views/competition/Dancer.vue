<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ChevronRight } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useCompetitionDays } from '@/composables/useCompetitionDays'
import { useFollowing } from '@/composables/useFollowing'
import { injectInfoHeaderSetter } from '@/composables/useScrolledPast'
import { usePageTitle } from '@/composables/usePageTitle'
import DanceStatusChip from '@/components/DanceStatusChip.vue'
import FollowButton from '@/components/FollowButton.vue'
import NumberCard from '@/components/NumberCard.vue'
import { getOrdinalSuffix } from '@/lib/results'
import { platformLabel } from '@/lib/schedule'
import type { DanceStatus } from '@/lib/dancerDay'

const route = useRoute()
const setHeader = injectInfoHeaderSetter()
const { competitionId, competition, dancers, loadDancers, loadResults, loadSchedule } = useCompetition()
const { dayFor, phase } = useCompetitionDays()
const following = useFollowing()

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

function detail(s: DanceStatus): string | null {
  const bits: string[] = []
  if (s.slot?.platformName && s.state !== 'next') bits.push(platformLabel(s.slot.platformName))
  if (s.slot?.blockName) bits.push([s.slot.blockName, s.slot.blockTime].filter(Boolean).join(' '))
  if (s.drawPos && s.drawSize) bits.push(`${s.drawPos}${getOrdinalSuffix(s.drawPos)} of ${s.drawSize} to dance`)
  if (s.state === 'waiting') bits.push('Danced')
  return bits.join(' · ') || null
}

</script>

<template>
  <article class="space-y-4">
    <p v-if="!dancer && !loaded" class="text-muted-foreground py-6 text-base">Loading…</p>
    <p v-else-if="!dancer" class="text-muted-foreground py-6 text-base">
      This dancer isn’t on the list any more. Go back to Dancers to see the current list.
    </p>

    <template v-else>
      <header :ref="setHeader" class="flex items-center gap-4">
        <NumberCard :number="dancer.number" :color="color" size="md" />
        <div class="min-w-0">
          <h1 class="text-display">{{ dancer.fullName }}</h1>
          <p class="text-muted-foreground text-sm">
            {{ [dancer.group?.fullName, dancer.location].filter(Boolean).join(' · ') }}
          </p>
        </div>
      </header>

      <FollowButton v-if="dancer.dancerId" :dancer="dancer" size="block" />

      <section v-for="e in entries" :key="e.dancer.id" class="space-y-2">
        <h2 class="text-heading flex items-baseline justify-between gap-2 pt-2">
          <span>{{ entries.length > 1 ? e.group?.fullName : phase === 'today' ? 'Today' : phase === 'before' ? 'Dances' : 'Results' }}</span>
          <RouterLink
            v-if="e.group"
            :to="{ name: 'competition.group', params: { competitionId, groupId: e.group.id } }"
            class="text-primary text-[0.9375rem] font-bold"
          >
            Age group results
          </RouterLink>
        </h2>
        <ul class="bg-card divide-y overflow-hidden rounded-2xl border shadow-sm">
          <li v-if="e.calledBack != null" class="flex min-h-12 items-center justify-between px-4">
            <span class="text-base font-semibold">Callbacks</span>
            <span :class="['text-sm font-bold', e.calledBack ? 'text-done-foreground' : 'text-muted-foreground']">
              {{ e.calledBack ? 'Called back' : 'Not called back' }}
            </span>
          </li>
          <li v-for="s in [...e.dances, ...(e.overall ? [e.overall] : [])]" :key="s.dance.id">
            <RouterLink
              :to="{
                name: 'competition.group',
                params: { competitionId, groupId: e.group?.id ?? '' },
                hash: `#dance-${s.dance.id}`,
              }"
              class="flex min-h-14 items-center justify-between gap-3 px-4 py-2 hover:bg-accent"
            >
              <span class="min-w-0">
                <span :class="['block text-base', s.dance.id === 'overall' ? 'font-extrabold' : 'font-semibold']">
                  {{ s.dance.fullName || s.dance.name }}
                </span>
                <span v-if="detail(s)" class="text-muted-foreground block text-[0.8125rem]">{{ detail(s) }}</span>
              </span>
              <span v-if="s.dance.id === 'overall' && s.state === 'later'" class="text-muted-foreground text-sm font-semibold">
                After all dances
              </span>
              <DanceStatusChip v-else :status="s" />
            </RouterLink>
          </li>
          <li v-if="!e.dances.length" class="text-muted-foreground px-4 py-3 text-base">
            No dances listed for this age group yet.
          </li>
        </ul>
      </section>

      <RouterLink
        v-if="dancer.dancerId"
        :to="{ name: 'dancer.info', params: { dancerId: dancer.dancerId } }"
        class="bg-card flex min-h-14 items-center gap-3 rounded-2xl border px-4 shadow-sm hover:bg-accent"
      >
        <span class="flex-1 text-base font-bold">All competitions for {{ firstName }}</span>
        <ChevronRight class="text-muted-foreground size-5" />
      </RouterLink>
    </template>
  </article>
</template>
