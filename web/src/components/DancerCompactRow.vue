<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight, Hourglass } from '@lucide/vue'
import Avatar from '@/components/Avatar.vue'
import FollowButton from '@/components/FollowButton.vue'
import Medal from '@/components/Medal.vue'
import NumberCard from '@/components/NumberCard.vue'
import { bestPlacing, dayStage } from '@/lib/dancerDay'
import { formatShortDate } from '@/lib/format'
import type { DancerCard } from '@/composables/useDancerCards'

// One line per dancer, for people following many (a teacher's class) and
// for dancers you've only looked at: their number at the competition that
// matters now, their name, one status line, and where they are in their day
// at the right edge. Usually under that competition's header, so it isn't
// named again unless `showCompetition`.
const props = withDefaults(
  defineProps<{
    card: DancerCard
    color: string | null
    /** A Follow star at the end (dancers you've only looked at). */
    follow?: boolean
    showCompetition?: boolean
  }>(),
  { follow: false, showCompetition: false },
)

const f = computed(() => props.card.focus)
const days = computed(() => f.value?.days ?? [])
const day = computed(() => days.value.find((d) => d.dances.length) ?? days.value[0] ?? null)
const stage = computed(() => (f.value?.phase === 'today' && days.value.length ? dayStage(days.value) : null))
const best = computed(() => {
  const all = days.value.map(bestPlacing).filter((b): b is NonNullable<typeof b> => !!b)
  return all.sort((a, b) => (a.place ?? 99) - (b.place ?? 99))[0] ?? null
})

const line = computed(() => {
  const focus = f.value
  if (!focus) return 'Not entered in any listed competitions'
  const where = props.showCompetition ? focus.competition.name : null
  if (stage.value === 'done') return 'Every result is in'
  if (focus.phase === 'before')
    return [where ?? day.value?.group?.fullName, focus.competition.date ? formatShortDate(focus.competition.date) : null]
      .filter(Boolean)
      .join(' · ')
  return [focus.phase === 'after' && where ? `Last: ${where}` : where, day.value?.group?.fullName].filter(Boolean).join(' · ') || focus.competition.name
})

const to = computed(() =>
  f.value && day.value
    ? { name: 'competition.dancer', params: { competitionId: f.value.competitionId, dancerId: day.value.dancer.id } }
    : { name: 'dancer.info', params: { dancerId: props.card.id } },
)
</script>

<template>
  <li class="relative flex items-center" :style="color ? { '--dc': color } : undefined">
    <span v-if="color" class="sash absolute inset-y-0 left-0 w-1" aria-hidden="true" />
    <RouterLink
      :to="to"
      :class="['press-row focus-inset flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 pl-4', follow ? 'pr-1' : 'pr-3']"
    >
      <span class="flex w-11 shrink-0 justify-center">
        <NumberCard
          v-if="day?.dancer.number != null"
          :number="day.dancer.number"
          size="xs"
          :color="color"
        />
        <Avatar v-else :name="card.name" :color="color" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-base font-semibold">{{ card.name }}</span>
        <span
          class="text-muted-foreground block truncate text-sm"
        >
          {{ line }}
        </span>
      </span>
      <span
        v-if="stage === 'waiting'"
        class="text-muted-foreground inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-footnote font-semibold shadow-[inset_0_0_0_1px_var(--border)] whitespace-nowrap"
      >
        <Hourglass class="size-3" aria-hidden="true" />
        Results to come
      </span>
      <Medal v-else-if="best && f?.phase !== 'before'" :place="best.place" :tied="best.tied" size="sm" />
      <ChevronRight v-if="!follow" class="text-muted-foreground size-5 shrink-0" />
    </RouterLink>
    <FollowButton v-if="follow" :dancer="{ dancerId: card.id, fullName: card.name }" class="mr-1" />
  </li>
</template>
