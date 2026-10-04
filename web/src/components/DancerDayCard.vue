<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight, Hourglass } from '@lucide/vue'
import Medal from '@/components/Medal.vue'
import NumberCard from '@/components/NumberCard.vue'
import DanceStatusChip from '@/components/DanceStatusChip.vue'
import { getOrdinalSuffix } from '@/lib/results'
import { platformLabel } from '@/lib/schedule'
import type { DancerDay, DanceStatus } from '@/lib/dancerDay'

// One followed dancer at one competition, led by the number card they wear
// there (in their colour, the one mark of "yours"). Placings pin on beside
// it as rosettes as they're posted; the dances still to come sit at the foot
// with what the schedule says about them. A dancer entered in more than one
// age group (Premier plus a Broadsword event) is one card under one number.
// The header opens the dancer's page; each dance still to come opens its
// age group's results. `bare` is just the day's dances, one row each, for
// the dancer's own page, which has its own header.
const props = withDefaults(
  defineProps<{
    days: DancerDay[]
    competitionId: string
    color?: string | null
    /** Shown under the name on Home, where several competitions mix. */
    competitionName?: string | null
    /** `${dancerId}:${danceId}` of a placing that just arrived. */
    fresh?: string | null
    /** lg: the dancer's own page, where it's the main thing. */
    size?: 'md' | 'lg'
    /** Just the dances, under a page that has its own header. */
    bare?: boolean
  }>(),
  { color: null, competitionName: null, fresh: null, size: 'md', bare: false },
)

// Entries with nothing scheduled are dropped when another entry has dances.
const shown = computed(() => {
  const withDances = props.days.filter((d) => d.dances.length)
  return withDances.length ? withDances : props.days.slice(0, 1)
})
const day = computed(() => shown.value[0])
const multi = computed(() => shown.value.length > 1)
const lg = computed(() => props.size === 'lg')

const sub = computed(() => (multi.value ? `${shown.value.length} age groups` : (day.value.group?.fullName ?? '')))

// What's pinned on so far: callbacks, a rosette per placing (Overall last),
// championship points, and what's still to come in.
const dances = computed(() => shown.value.flatMap((d) => d.dances.map((s) => ({ d, s }))))
const won = computed(() => dances.value.filter(({ s }) => s.state === 'placed' && s.place != null))
const overall = computed(() => shown.value.map((d) => ({ d, s: d.overall })).find(({ s }) => s?.state === 'placed' && s.place != null) ?? null)
const points = computed(() => dances.value.filter(({ s }) => s.state === 'unplaced' && s.pointed).length)
const notPlaced = computed(() => dances.value.filter(({ s }) => (s.state === 'unplaced' && !s.pointed) || s.state === 'no-placings').length)
const upcoming = computed(() => dances.value.filter(({ s }) => s.state === 'upcoming'))
// Danced, results not posted yet; or every dance in and Overall still to come.
const waiting = computed(
  () =>
    dances.value.some(({ s }) => s.state === 'waiting') ||
    (!upcoming.value.length && shown.value.some((d) => d.overall?.state === 'later' && d.resultsIn > 0)),
)
const calledBack = computed(() => (multi.value ? null : day.value.calledBack))
const settled = computed(() => !upcoming.value.length && !waiting.value && dances.value.length > 0)
const pinned = computed(
  () => calledBack.value != null || won.value.length || overall.value || points.value || notPlaced.value || waiting.value || (settled.value && day.value.phase === 'today'),
)

const ordinal = (n: number) => `${n}${getOrdinalSuffix(n)}`
// A dance still to come, as the schedule has it: its time (or session), then
// where, and their place in the draw. Never a guess at what's on now.
const when = (s: DanceStatus) => s.slot?.eventTime ?? s.slot?.blockTime ?? s.slot?.blockName ?? null
const where = (d: DancerDay, s: DanceStatus) =>
  [d.phase === 'before' ? s.slot?.dayName : null, platformLabel(s.slot?.platformName), s.drawPos ? `${ordinal(s.drawPos)} to dance` : null]
    .filter(Boolean)
    .join(' · ')

// The bare rows' details: the session with its time, and the draw.
function detail(s: DanceStatus): string[] {
  if (s.state !== 'upcoming') return []
  const session = [s.slot?.blockName, s.slot?.eventTime ?? s.slot?.blockTime].filter(Boolean).join(', ')
  return [session, s.drawPos ? `${ordinal(s.drawPos)} to dance` : ''].filter(Boolean)
}

const groupRoute = (d: DancerDay, danceId?: string) => ({
  name: 'competition.group',
  params: { competitionId: props.competitionId, groupId: d.group?.id ?? '' },
  hash: danceId ? `#dance-${danceId}` : undefined,
})

const ROW = 'relative flex items-center justify-between gap-3'
const rowSize = computed(() => (lg.value ? 'min-h-14 px-5 py-2.5' : 'min-h-12 px-4 py-2'))
</script>

<template>
  <article :class="['surface overflow-hidden', bare && lg ? 'rounded-3xl' : 'rounded-[1.25rem]']">
    <template v-if="!bare">
      <RouterLink
        :to="{ name: 'competition.dancer', params: { competitionId, dancerId: day.dancer.id } }"
        :class="['press-row focus-inset flex items-center gap-3.5 px-4 pt-4', pinned || upcoming.length ? 'pb-3' : 'pb-4']"
      >
        <NumberCard :number="day.dancer.number" :color="color" size="md" />
        <span class="min-w-0 flex-1">
          <span class="block text-[1.25rem] leading-tight font-bold tracking-[-0.01em] break-words">{{ day.dancer.fullName }}</span>
          <span v-if="sub" class="text-muted-foreground text-callout block">{{ sub }}</span>
          <span v-if="competitionName" class="text-muted-foreground text-callout block truncate">{{ competitionName }}</span>
        </span>
        <ChevronRight class="text-muted-foreground size-5 shrink-0" />
      </RouterLink>

      <!-- Pinned on as they're posted. Each rosette names its dance aloud;
           the dancer's page lists them. -->
      <div v-if="pinned" class="flex flex-wrap items-center gap-x-1 gap-y-2 px-4 pb-4">
        <span
          v-if="calledBack != null"
          :class="[
            'mr-1.5 inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold',
            calledBack ? 'bg-done text-done-foreground' : 'bg-muted text-muted-foreground',
          ]"
        >
          {{ calledBack ? 'Called back' : 'Not called back' }}
        </span>
        <Medal
          v-for="{ d, s } in won"
          :key="`${d.dancer.id}:${s.dance.id}`"
          :place="s.place"
          :tied="s.tied"
          :fresh="fresh === `${d.dancer.id}:${s.dance.id}`"
          :dance="s.dance.fullName || s.dance.name"
          size="lg"
        />
        <span v-if="overall" class="ml-2 inline-flex items-center gap-1.5 border-l pl-3">
          <Medal
            :place="overall.s!.place"
            :tied="overall.s!.tied"
            :fresh="fresh === `${overall.d.dancer.id}:overall`"
            dance="Overall"
            size="lg"
          />
          <span class="text-muted-foreground text-sm font-semibold" aria-hidden="true">Overall</span>
        </span>
        <span v-if="points" class="bg-blue-paper text-primary ml-1.5 inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold">
          {{ points === 1 ? 'Championship point' : `${points} championship points` }}
        </span>
        <span v-if="notPlaced && (won.length || overall || points)" class="text-muted-foreground ml-1.5 text-sm font-medium">
          {{ notPlaced }} not placed
        </span>
        <span v-else-if="notPlaced" class="text-muted-foreground text-sm font-medium">Not placed</span>
        <span
          v-if="waiting"
          class="bg-muted text-muted-foreground border-strong ml-1.5 inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed px-3 text-sm font-semibold"
        >
          <Hourglass class="size-3.5" stroke-width="2.4" aria-hidden="true" />
          Results to come
        </span>
        <span v-if="settled && day.phase === 'today' && !won.length && !overall" class="text-muted-foreground text-sm">Every result is in</span>
      </div>

      <!-- Still to come, as the schedule has it. -->
      <ul v-if="upcoming.length" class="rows-inset shadow-[inset_0_1px_0_var(--border)] [--inset:1rem]">
        <li v-for="{ d, s } in upcoming" :key="`${d.dancer.id}:${s.dance.id}`">
          <RouterLink :to="groupRoute(d, s.dance.id)" class="press-row focus-inset flex min-h-14 flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2.5">
            <span class="min-w-[8rem] flex-1 text-base font-semibold break-words">
              {{ s.dance.fullName || s.dance.name }}
              <span v-if="multi" class="text-muted-foreground block text-sm font-normal">{{ d.group?.fullName }}</span>
            </span>
            <span v-if="when(s) || where(d, s)" class="ml-auto text-right">
              <span v-if="when(s)" class="block text-base font-bold tabular-nums">{{ when(s) }}</span>
              <span v-if="where(d, s)" class="text-muted-foreground block text-sm">{{ where(d, s) }}</span>
            </span>
          </RouterLink>
        </li>
      </ul>
      <p
        v-if="!dances.length"
        class="text-muted-foreground px-4 pb-4 text-sm"
      >
        No dances listed for this age group yet.
      </p>
    </template>

    <template v-if="bare">
      <template v-for="(d, i) in shown" :key="d.dancer.id">
        <p
          v-if="multi"
          :class="[
            'text-muted-foreground pt-3 pb-1 text-footnote font-semibold',
            lg ? 'px-5' : 'px-4',
            !(bare && i === 0) && 'shadow-[inset_0_1px_0_var(--border)]',
          ]"
        >
          {{ d.group?.fullName }}
        </p>
        <ul
          v-if="d.dances.length"
          :class="['rows-inset', lg ? '[--inset:1.25rem]' : '[--inset:1rem]', !multi && !bare && 'shadow-[inset_0_1px_0_var(--border)]']"
        >
          <li v-if="d.calledBack != null" :class="[ROW, rowSize]">
            <span class="text-callout font-medium">Callbacks</span>
            <span :class="['text-sm font-semibold', d.calledBack ? 'text-done-foreground' : 'text-muted-foreground']">
              {{ d.calledBack ? 'Called back' : 'Not called back' }}
            </span>
          </li>
          <li v-for="s in d.dances" :key="s.dance.id">
            <!-- The dance's name always shows in full: it wraps, and on a narrow
                 card (or with big text) the state drops below it. -->
            <RouterLink
              :to="groupRoute(d, s.dance.id)"
              :class="['press-row focus-inset relative flex flex-wrap items-center gap-x-3 gap-y-1', rowSize]"
            >
              <span
                :class="[
                  'min-w-[9rem] flex-1 break-words',
                  lg ? 'text-base' : 'text-callout',
                  'font-medium',
                ]"
              >
                {{ s.dance.fullName || s.dance.name }}
              </span>
              <DanceStatusChip class="ml-auto" :status="s" :fresh="fresh === `${d.dancer.id}:${s.dance.id}`" />
              <!-- The details take the row's full width below. Each fact wraps
                   as a whole, its separator at the line's end. -->
              <span v-if="detail(s).length" class="text-muted-foreground basis-full text-sm">
                <template v-for="(bit, n) in detail(s)" :key="bit">
                  <span class="inline-block">{{ bit }}{{ n < detail(s).length - 1 ? '&nbsp;·' : '' }}</span>{{ ' ' }}
                </template>
              </span>
            </RouterLink>
          </li>
          <li v-if="d.overall">
            <RouterLink :to="groupRoute(d, 'overall')" :class="['press-row focus-inset', ROW, rowSize]">
              <span :class="['font-semibold', lg ? 'text-base' : 'text-callout']">Overall</span>
              <DanceStatusChip
                v-if="d.overall.state !== 'later'"
                :status="d.overall"
                :fresh="fresh === `${d.dancer.id}:overall`"
              />
              <span v-else class="text-muted-foreground text-sm">After all dances</span>
            </RouterLink>
          </li>
        </ul>
        <p
          v-else
          :class="[
            'text-muted-foreground py-3 text-sm',
            lg ? 'px-5' : 'px-4',
            !(bare && i === 0 && !multi) && 'shadow-[inset_0_1px_0_var(--border)]',
          ]"
        >
          No dances listed for this age group yet.
        </p>
      </template>
    </template>
  </article>
</template>
