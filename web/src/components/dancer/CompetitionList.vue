<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight } from '@lucide/vue'
import DateTile from '@/components/DateTile.vue'
import LinkRail from '@/components/LinkRail.vue'
import Medal from '@/components/Medal.vue'
import Skeleton from '@/components/Skeleton.vue'
import VisibilityChip from '@/components/VisibilityChip.vue'
import { useDancerRecord, type ListRow } from '@/composables/useDancerRecord'
import type { EntrySummary } from '@/lib/entrySummary'
import { useHiddenAs } from '@/composables/useHiddenAs'
import { useMeStore } from '@/stores/me'

// A dancer's competitions as rows: the date, the name and what they won.
// A year at a time (`headings`), or one run of rows (the basic profile).
// `skip`: a competition shown as the day card instead.
const props = defineProps<{
  years: ReadonlyArray<readonly [string, ListRow[]]>
  headings?: boolean
  skip?: string | null
  /** The competitions are still on their way. */
  loading?: boolean
}>()

const me = useMeStore()
const record = useDancerRecord()
const hiddenAs = useHiddenAs()

const shown = computed(() =>
  props.years
    .map(([year, list]) => [year, list.filter((r) => r.competitionId !== props.skip)] as const)
    .filter(([, list]) => list.length),
)

// Every placing, best first, on one line on a phone: a narrow row keeps to
// its best three (two beside an Overall trophy on the narrowest) and says how
// many more, so it never passes for the whole story; a wide one shows them all.
// A trophy event's cup, which follows Overall's, is one more placing in that count.
const NARROW = '@max-[17.5rem]:hidden'
const PHONE = '@max-[26rem]:hidden'
function medals(cid: string) {
  const all = record.summaries.value[cid] ?? []
  // Their own placings here; each team's best beside its name (ADR 0012).
  const list = all.filter((s) => !s.team)
  const teams = all
    .filter((s) => s.team)
    .map((s) => ({ name: s.team!, best: [...s.placings, ...(s.overall ? [{ ...s.overall, name: 'Overall' }] : [])].sort((a, b) => a.place - b.place)[0] }))
    .filter((t) => t.best)
  const overall = list.map((s) => s.overall).find(Boolean)
  const placings = list.flatMap((s) => s.placings).sort((a, b) => a.place - b.place)
  // One cup per trophy event, even when two of their age groups can win it.
  const best = new Map<string, EntrySummary['trophyEvents'][number]>()
  for (const a of list.flatMap((s) => s.trophyEvents ?? [])) if (!best.has(a.id) || a.place < best.get(a.id)!.place) best.set(a.id, a)
  const trophyEvents = [...best.values()]
  // Best first across both; a tie goes to the trophy event.
  const pool: Array<{ place: number }> = [...trophyEvents, ...placings].sort((a, b) => a.place - b.place)
  const hide = new Map(pool.map((m, i) => [m, i >= 3 ? PHONE : i === 2 && overall ? NARROW : '']))
  const n = pool.length
  const more: Array<{ count: number; class: string }> = []
  if (overall && n > 2) more.push({ count: n - 2, class: '@min-[17.5rem]:hidden' })
  if (n > 3) more.push({ count: n - 3, class: overall ? 'hidden @min-[17.5rem]:inline @min-[26rem]:hidden' : '@min-[26rem]:hidden' })
  return {
    overall,
    // Results are in and they weren't placed, so the row doesn't read as results still to come.
    unplaced: !n && !overall && !teams.length && list.some((s) => s.danced.length || s.overallMissed),
    placings: placings.map((p) => ({ ...p, class: hide.get(p) })),
    trophyEvents: trophyEvents.map((a) => ({ ...a, class: hide.get(a) })),
    more,
    teams,
    groups: all.map((s) => s.groupName).filter(Boolean) as string[],
  }
}
</script>

<template>
  <div v-if="loading" class="rows-engraved -mx-4 [--inset:4.5rem] [--inset-end:1rem]" aria-busy="true">
    <span class="sr-only">Loading competitions…</span>
    <div v-for="i in 3" :key="i" class="flex min-h-16 items-center gap-3 py-2.5 pr-3 pl-4">
      <Skeleton class="h-14 w-11 shrink-0 rounded-xl!" />
      <div class="flex-1 space-y-2">
        <Skeleton class="h-4 w-3/4" />
        <Skeleton class="h-3.5 w-1/3" />
      </div>
    </div>
  </div>
  <template v-for="[year, list] in shown" :key="year">
    <h3 v-if="headings" class="text-heading flex items-baseline justify-between pt-2">
      {{ year }} <span class="text-muted-foreground text-sm font-normal tabular-nums">{{ list.length }}</span>
    </h3>
    <ul class="rows-engraved -mx-4 [--inset:4.5rem] [--inset-end:1rem]">
      <li
        v-for="r in list"
        :key="r.competitionId"
        :class="[r.rail && 'relative', (r.rail === 'middle' || r.rail === 'last') && 'bg-none!']"
      >
        <LinkRail :rail="r.rail" />
        <RouterLink
          :to="
            r.entryIds[0]
              ? { name: 'competition.dancer', params: { competitionId: r.competitionId, dancerId: r.entryIds[0] } }
              : { name: 'competition.info', params: { competitionId: r.competitionId } }
          "
          class="press-row focus-inset flex min-h-16 items-center gap-3 py-2.5 pr-3 pl-4"
        >
          <DateTile :date="r.competition.date" :managed="me.organises(r.competitionId)" />
          <span class="@container min-w-0 flex-1">
            <span class="line-clamp-2 text-base leading-snug font-semibold">{{ r.competition.name }}</span>
            <span v-if="r.withOthers" class="text-muted-foreground block text-sm">{{ r.withOthers }}</span>
            <span v-if="medals(r.competitionId).groups.length" class="text-muted-foreground block text-sm">
              {{ medals(r.competitionId).groups.join(' · ') }}
            </span>
            <span v-if="hiddenAs(r.competitionId, r.competition)" class="mt-0.5 flex"><VisibilityChip :visibility="hiddenAs(r.competitionId, r.competition)" /></span>
            <!-- Their results, including an explicit unplaced result. -->
            <span
              v-if="medals(r.competitionId).unplaced || medals(r.competitionId).placings.length || medals(r.competitionId).overall || medals(r.competitionId).trophyEvents.length || medals(r.competitionId).teams.length"
              class="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1.5"
            >
              <span v-if="medals(r.competitionId).unplaced" class="text-muted-foreground text-sm font-medium">Not placed</span>
              <Medal
                v-for="m in medals(r.competitionId).placings"
                :key="m.danceId"
                :place="m.place"
                :tied="m.tied"
                :dance="m.name"
                :class="m.class"
              />
              <span
                v-for="t in medals(r.competitionId).more"
                :key="t.count"
                :class="['text-muted-foreground ml-0.5 text-sm font-semibold tabular-nums', t.class]"
              >
                +{{ t.count }}<span class="sr-only"> more placing{{ t.count === 1 ? '' : 's' }}</span>
              </span>
              <Medal
                v-if="medals(r.competitionId).overall"
                :place="medals(r.competitionId).overall!.place"
                :tied="medals(r.competitionId).overall!.tied"
                dance="Overall"
                trophy
              />
              <Medal
                v-for="a in medals(r.competitionId).trophyEvents"
                :key="a.id"
                :place="a.place"
                :tied="a.tied"
                :dance="a.name"
                :class="a.class"
                trophy
              />
              <span v-for="t in medals(r.competitionId).teams" :key="t.name" class="ml-1.5 inline-flex min-w-0 items-center gap-1.5 border-l pl-2.5">
                <Medal :place="t.best!.place" :tied="t.best!.tied" :dance="`${t.name}, ${t.best!.name}`" />
                <span class="text-muted-foreground max-w-40 truncate text-sm font-semibold" aria-hidden="true">{{ t.name }}</span>
              </span>
            </span>
          </span>
          <ChevronRight class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
        </RouterLink>
      </li>
    </ul>
  </template>
</template>
