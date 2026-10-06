<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { ChevronRight, Star } from '@lucide/vue'
import { useFollowing } from '@/composables/useFollowing'
import { useHiddenAs } from '@/composables/useHiddenAs'
import CompetitionName from '@/components/CompetitionName.vue'
import DateTile from '@/components/DateTile.vue'
import VisibilityChip from '@/components/VisibilityChip.vue'
import { useMeStore } from '@/stores/me'
import { isSameDay } from '@/lib/format'
import type { Competition } from '@/types/competition'

// A competition as a row: a calendar date block (what people scan for, pink
// while it's on), the name, the town, then a short note ("Day 2 of 2"), and
// your dancers as coloured dots. Its admins also see the shield and, until
// it's published, how it's hidden. The name leads with its organisation's
// short name (CompetitionName); on that organisation's own page (`within`),
// without it. Lists put these in a `rows-inset` card with
// `[--inset:4.5rem]`, so separators line up with the name.
const props = withDefaults(
  defineProps<{
    competition: Omit<Competition, 'date'> & { id?: string; date?: number | string }
    to: RouteLocationRaw
    followed?: boolean
    /** Followed dancers entered here (aggregate id, first name). */
    dancers?: Array<{ id: string; name: string }>
    /** On today. Pass it when the schedule's later days are known; otherwise the start date decides. */
    today?: boolean
    /** Its id, when `competition` doesn't carry one. */
    competitionId?: string
    /** Shield it when you're its admin (off where every row is yours). */
    markManaged?: boolean
    /** As everyone else sees it: no shield, no visibility. */
    preview?: boolean
    /** A word on where it's at: "Day 2 of 2", "Results posted", "Published". */
    note?: string | null
    /** On this organisation's page: its name without the organisation, in front or in it. */
    within?: string | null
    /** Under the day: the weekday, or the year where years mix (Search). */
    below?: 'weekday' | 'year'
  }>(),
  {
    followed: false,
    dancers: () => [],
    today: undefined,
    competitionId: undefined,
    markManaged: true,
    preview: false,
    note: null,
    within: null,
    below: 'weekday',
  },
)

const following = useFollowing()
const me = useMeStore()
const today = computed(() => props.today ?? isSameDay(props.competition.date))
const hiddenAs = useHiddenAs()
const id = computed(() => props.competitionId ?? props.competition.id)
const managed = computed(() => props.markManaged && !props.preview && !!id.value && me.organises(id.value))
const hidden = computed(() => (props.preview ? null : hiddenAs(id.value, props.competition)))

</script>

<template>
  <li class="bg-card">
    <RouterLink :to="to" class="press-row focus-inset flex min-h-16 items-center gap-3 py-2.5 pr-3 pl-4">
      <DateTile
        :date="competition.date"
        :below="below"
        :managed="managed"
        :today="today"
      />
      <span class="min-w-0 flex-1">
        <span class="line-clamp-2 text-base leading-snug font-semibold">
          <CompetitionName :competition="competition" :within="within" />
        </span>
        <span v-if="competition.location" class="text-muted-foreground block truncate text-sm">
          {{ competition.location }}
        </span>
        <span v-if="managed" class="sr-only">You can manage this.</span>
        <span v-if="note || hidden || followed || dancers.length" class="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <VisibilityChip :visibility="hidden" />
          <span v-if="note" class="text-muted-foreground text-sm font-medium">{{ note }}</span>
          <span v-if="dancers.length" class="flex min-w-0 items-center gap-1.5 text-sm font-medium">
            <span class="flex shrink-0 gap-0.5" aria-hidden="true">
              <span
                v-for="x in dancers.slice(0, 4)"
                :key="x.id"
                class="size-2.5 rounded-full"
                :style="{ background: following.colorFor(x.id) ?? 'var(--primary)' }"
              />
            </span>
            <span class="truncate">{{ dancers.map((x) => x.name).join(', ') }}</span>
          </span>
          <span v-else-if="followed" class="text-muted-foreground inline-flex items-center gap-1 text-sm">
            <Star class="text-secondary size-3.5 fill-current" aria-hidden="true" /> Following
          </span>
        </span>
      </span>
      <ChevronRight class="text-muted-foreground size-5 shrink-0" />
    </RouterLink>
  </li>
</template>
