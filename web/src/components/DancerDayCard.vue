<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight } from '@lucide/vue'
import Medal from '@/components/Medal.vue'
import NumberCard from '@/components/NumberCard.vue'
import DanceStatusChip from '@/components/DanceStatusChip.vue'
import { getOrdinalSuffix } from '@/lib/results'
import { platformLabel } from '@/lib/schedule'
import { placings, type DancerDay, type DanceStatus } from '@/lib/dancerDay'

// One followed dancer at one competition: their number card for that
// competition, and every dance with its state. A dancer can be entered in
// more than one age group (e.g. Premier plus a Broadsword event); those are
// grouped in one card under the same number. The header opens the dancer's
// page; each dance row opens that age group's results. The dance they're on
// next stands out; once every result is in, `folded` sums the day up as one
// line of rosettes.
const props = withDefaults(
  defineProps<{
    days: DancerDay[]
    competitionId: string
    color?: string | null
    /** Shown under the name on Home, where several competitions mix. */
    competitionName?: string | null
    /** `${dancerId}:${danceId}` of a placing that just arrived. */
    fresh?: string | null
    /** Just the header, with the placings in place of the details. */
    folded?: boolean
    /** lg: the dancer's own page, where it's the main thing. */
    size?: 'md' | 'lg'
  }>(),
  { color: null, competitionName: null, fresh: null, folded: false, size: 'md' },
)

// Entries with nothing scheduled are dropped when another entry has dances.
const shown = computed(() => {
  const withDances = props.days.filter((d) => d.dances.length)
  return withDances.length ? withDances : props.days.slice(0, 1)
})
const day = computed(() => shown.value[0])
const multi = computed(() => shown.value.length > 1)
const lg = computed(() => props.size === 'lg')

const sub = computed(() => {
  const d = day.value
  const parts = [multi.value ? `${shown.value.length} age groups` : d.group?.fullName]
  const plat = d.next?.slot?.platformName ?? d.dances[0]?.slot?.platformName
  if (plat && d.phase !== 'after' && !props.folded) parts.push(platformLabel(plat))
  return parts.filter(Boolean).join(' · ')
})
const won = computed(() => (props.folded ? placings(shown.value) : []))

const ordinal = (n: number) => `${n}${getOrdinalSuffix(n)}`
function detail(s: DanceStatus): string | null {
  if (s.state !== 'next' && s.state !== 'upcoming') return null
  const bits: string[] = []
  if (s.drawPos) bits.push(`${ordinal(s.drawPos)} to dance`)
  if (s.slot?.blockTime && s.state === 'upcoming') bits.push(s.slot.blockTime)
  else if (s.slot && s.slot.groupCount > 1) bits.push(`${ordinal(s.slot.groupPos)} of ${s.slot.groupCount} groups`)
  return bits.join(' · ') || null
}

const groupRoute = (d: DancerDay, danceId?: string) => ({
  name: 'competition.group',
  params: { competitionId: props.competitionId, groupId: d.group?.id ?? '' },
  hash: danceId ? `#dance-${danceId}` : undefined,
})

const ROW = 'relative flex items-center justify-between gap-3'
const rowSize = computed(() => (lg.value ? 'min-h-14 px-5 py-2.5' : 'min-h-12 px-4 py-2'))
// The dance they're on next: a warm tint and an amber edge.
const NEXT = 'bg-next/55 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-amber-500'
</script>

<template>
  <article
    :class="['surface overflow-hidden', lg ? 'rounded-3xl' : 'rounded-2xl']"
    :style="color ? { '--dc': color } : undefined"
  >
    <div v-if="color" :class="['sash', lg ? 'h-2' : 'h-1.5']" aria-hidden="true" />
    <RouterLink
      :to="{
        name: 'competition.dancer',
        params: { competitionId, dancerId: day.dancer.id },
      }"
      :class="['press-row focus-inset flex items-center gap-3', lg ? 'px-5 py-4' : 'px-4 py-3']"
    >
      <NumberCard :number="day.dancer.number" :color="color" :size="lg ? 'md' : 'sm'" />
      <span class="min-w-0 flex-1">
        <span :class="['block truncate', lg ? 'text-title' : 'text-[1.0625rem] leading-tight font-semibold']">
          {{ day.dancer.fullName }}
        </span>
        <span v-if="sub" class="text-muted-foreground block truncate text-sm">{{ sub }}</span>
        <span v-if="competitionName" class="text-muted-foreground block truncate text-sm">
          {{ competitionName }}
        </span>
        <span v-if="folded && (won.length || day.phase === 'today')" class="mt-1 flex flex-wrap items-center gap-1">
          <Medal
            v-for="s in won"
            :key="s.dance.id"
            :place="s.place"
            :tied="s.tied"
            :fresh="fresh === `${day.dancer.id}:${s.dance.id}`"
            size="sm"
          />
          <span v-if="!won.length && day.phase === 'today'" class="text-muted-foreground text-sm">Every result is in</span>
        </span>
      </span>
      <ChevronRight class="text-muted-foreground size-5 shrink-0" />
    </RouterLink>

    <template v-if="!folded">
      <template v-for="d in shown" :key="d.dancer.id">
        <p
          v-if="multi"
          :class="['text-muted-foreground shadow-[inset_0_1px_0_var(--border)] pt-3 pb-1 text-footnote font-semibold', lg ? 'px-5' : 'px-4']"
        >
          {{ d.group?.fullName }}
        </p>
        <ul
          v-if="d.dances.length"
          :class="['rows-inset', lg ? '[--inset:1.25rem]' : '[--inset:1rem]', !multi && 'shadow-[inset_0_1px_0_var(--border)]']"
        >
          <li v-if="d.calledBack != null" :class="[ROW, rowSize]">
            <span class="text-callout font-medium">Callbacks</span>
            <span :class="['text-sm font-semibold', d.calledBack ? 'text-done-foreground' : 'text-muted-foreground']">
              {{ d.calledBack ? 'Called back' : 'Not called back' }}
            </span>
          </li>
          <li v-for="s in d.dances" :key="s.dance.id">
            <RouterLink :to="groupRoute(d, s.dance.id)" :class="['press-row focus-inset', ROW, rowSize, s.state === 'next' && NEXT]">
              <span class="min-w-0">
                <span
                  :class="[
                    'block truncate',
                    lg ? 'text-base' : 'text-callout',
                    s.state === 'next' ? 'font-semibold' : 'font-medium',
                  ]"
                >
                  {{ s.dance.fullName || s.dance.name }}
                </span>
                <span
                  v-if="detail(s)"
                  :class="[
                    'block text-footnote',
                    s.state === 'next' ? 'text-next-foreground font-medium' : 'text-muted-foreground',
                  ]"
                >
                  {{ detail(s) }}
                </span>
              </span>
              <DanceStatusChip :status="s" :fresh="fresh === `${d.dancer.id}:${s.dance.id}`" />
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
          :class="['text-muted-foreground shadow-[inset_0_1px_0_var(--border)] py-3 text-sm', lg ? 'px-5' : 'px-4']"
        >
          No dances listed for this age group yet.
        </p>
      </template>
    </template>
  </article>
</template>
