<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { ChevronRight, EyeOff, Star } from '@lucide/vue'
import { useFollowing } from '@/composables/useFollowing'
import DateTile from '@/components/DateTile.vue'
import { useMeStore } from '@/stores/me'
import { isSameDay } from '@/lib/format'
import type { Competition } from '@/types/competition'

// A competition as a row: a calendar date block (what people scan for, pink
// while it's on), the name, the town, then a short note ("Day 2 of 2"), and
// your dancers as coloured dots. Lists put these in a `rows-inset` card with
// `[--inset:4.5rem]`, so separators line up with the name.
const props = withDefaults(
  defineProps<{
    competition: Competition & { id?: string }
    to: RouteLocationRaw
    followed?: boolean
    /** Followed dancers entered here (aggregate id, first name). */
    dancers?: Array<{ id: string; name: string }>
    /** On today. Pass it when the schedule's later days are known; otherwise the start date decides. */
    today?: boolean
    /** Its id, when `competition` doesn't carry one. */
    competitionId?: string
    /** Mark it when you can manage it (off where every row is yours, or in a preview). */
    markManaged?: boolean
    /** A word on where it's at: "Day 2 of 2", "Results posted", "Published". */
    note?: string | null
  }>(),
  {
    followed: false,
    dancers: () => [],
    today: undefined,
    competitionId: undefined,
    markManaged: true,
    note: null,
  },
)

const following = useFollowing()
const me = useMeStore()
const today = computed(() => props.today ?? isSameDay(props.competition.date))
const managed = computed(() => {
  const id = props.competitionId ?? props.competition.id
  return props.markManaged && !!id && me.hasCompetitionPerm(id)
})
// Not in the public list (only its admins see it), in Manage's word.
const isPrivate = computed(() => managed.value && props.competition.listed !== true && props.competition.published !== true)
</script>

<template>
  <li class="bg-card">
    <RouterLink :to="to" class="press-row focus-inset flex min-h-16 items-center gap-3 py-2.5 pr-3 pl-4">
      <DateTile :date="competition.date" :managed="managed" :today="today" />
      <span class="min-w-0 flex-1">
        <span class="line-clamp-2 text-base leading-snug font-semibold">
          {{ competition.name ?? 'Competition' }}
        </span>
        <span v-if="competition.location" class="text-muted-foreground block truncate text-sm">
          {{ competition.location }}
        </span>
        <span v-if="managed" class="sr-only">You can manage this.</span>
        <span v-if="note || isPrivate || followed || dancers.length" class="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span v-if="note" class="text-muted-foreground text-sm font-medium">{{ note }}</span>
          <span v-if="isPrivate" class="text-muted-foreground inline-flex items-center gap-1 text-sm font-medium">
            <EyeOff class="size-3.5" aria-hidden="true" />
            Private<span class="sr-only"> (only admins can see it)</span>
          </span>
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
