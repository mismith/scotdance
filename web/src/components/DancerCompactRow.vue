<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight, Hourglass } from '@lucide/vue'
import Avatar from '@/components/Avatar.vue'
import FollowButton from '@/components/FollowButton.vue'
import Medal from '@/components/Medal.vue'
import NumberCard from '@/components/NumberCard.vue'
import { dayStage } from '@/lib/dancerDay'
import { formatShortDate } from '@/lib/format'
import type { DancerCard } from '@/composables/useDancerCards'
import { OVERALL_ID } from '@/types/competition'

// One line per dancer, for people following many (a teacher's class) and
// for dancers you've only looked at: their number at the competition that
// matters now, their name, one status line, and where they are in their day
// at the right edge. Usually under that competition's header, so it isn't
// named again unless `showCompetition`.
const props = withDefaults(
  defineProps<{
    card: DancerCard
    color: string | null
    /** A Favourite star at the end (dancers you've only looked at). */
    follow?: boolean
    showCompetition?: boolean
  }>(),
  { follow: false, showCompetition: false },
)

const f = computed(() => props.card.focus)
const days = computed(() => f.value?.days ?? [])
const day = computed(() => days.value.find((d) => d.dances.length) ?? days.value[0] ?? null)
// Their own number: a team's (ADR 0012) isn't one they wear as theirs.
const own = computed(() => days.value.filter((d) => !d.dancer.team))
const competitionDancer = computed(() => own.value.find((d) => d.dances.length) ?? own.value[0] ?? null)
const stage = computed(() => (f.value?.phase === 'today' && days.value.length ? dayStage(days.value) : null))
// Their placings in the order they danced them (not just the best: that
// would flatter), the overall and trophy events after. Their own; a team's
// only when they dance in nothing else. Oldest to newest, left to right: the
// latest three, each newer one stacked on top of the one before (colour and
// shape still say the place), so an overall or trophy awarded last is the
// one you see whole; "+N" after, for the earlier ones.
const placings = computed(() =>
  (own.value.length ? own.value : days.value)
    .flatMap((d) => [...d.dances, ...(d.overall ? [d.overall] : []), ...d.trophyEvents])
    .filter((x) => x.state === 'placed' && x.place != null),
)
const SHOWN = 3
const shown = computed(() => placings.value.slice(-SHOWN))

// Over, results in, and no placing: said, so it doesn't read as results to come.
const unplaced = computed(
  () =>
    f.value?.phase === 'after' &&
    !placings.value.length &&
    days.value.some((d) => d.dances.some((s) => s.state === 'unplaced' || s.state === 'no-placings')),
)

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
  <li class="relative isolate flex items-center hover:z-10" :style="color ? { '--dc': color } : undefined">
    <span v-if="color" class="dancer-sash" aria-hidden="true" />
    <RouterLink
      :to="to"
      :class="['press-row focus-inset flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 pl-4', follow ? 'pr-1' : 'pr-3']"
    >
      <span class="flex w-11 shrink-0 justify-center">
        <NumberCard
          v-if="f?.phase !== 'after' && competitionDancer?.dancer.number != null"
          :number="competitionDancer.dancer.number"
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
      <span v-else-if="placings.length && f?.phase !== 'before'" class="flex shrink-0 items-center gap-1">
        <span class="flex -space-x-7">
          <Medal
            v-for="(p, i) in shown"
            :key="i"
            :style="{ zIndex: i }"
            class="[filter:drop-shadow(-1.5px_0_0_var(--background))]"
            :place="p.place!"
            :tied="p.tied"
            :dance="p.dance.fullName || p.dance.name"
            :trophy="p.dance.id === OVERALL_ID"
            size="sm"
          />
        </span>
        <span v-if="placings.length > SHOWN" class="text-muted-foreground text-sm font-medium tabular-nums">+{{ placings.length - SHOWN }}</span>
      </span>
      <span v-else-if="unplaced" class="text-muted-foreground shrink-0 text-sm font-medium">Not placed</span>
      <ChevronRight v-if="!follow" class="text-muted-foreground size-5 shrink-0" />
    </RouterLink>
    <FollowButton v-if="follow" :dancer="{ dancerId: card.id, fullName: card.name }" class="mr-1" />
  </li>
</template>
