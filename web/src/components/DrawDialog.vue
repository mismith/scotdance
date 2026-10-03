<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useCompetition } from '@/composables/useCompetition'
import { useFollowing } from '@/composables/useFollowing'
import { findGroupDancers, getOrdinalSuffix } from '@/lib/results'
import type {
  EnrichedDancer,
  EnrichedGroup,
  ScheduleDance,
} from '@/types/competition'
import FollowButton from '@/components/FollowButton.vue'
import NumberCard from '@/components/NumberCard.vue'
import Dialog from '@/components/Dialog.vue'
import type { Morph } from '@/lib/morph'

// An age group's dancing order for one dance (or, before it's drawn, the
// group by number). Your dancers are marked, it opens at the first of them,
// and the header says where they fall: "Callum dances 6th of 6".
const props = defineProps<{
  group: EnrichedGroup | null
  dance?: ScheduleDance | null
  eventName?: string
  danceName?: string
  morph?: Morph
}>()

const breadcrumb = computed(() =>
  [props.eventName, props.danceName].filter(Boolean).join(' · '),
)

const emit = defineEmits<{
  close: []
}>()

const { competitionId, dancers, draws } = useCompetition()
const following = useFollowing()

const dancerNumberValue = (d: EnrichedDancer) =>
  d.number != null && Number.isFinite(d.number) ? d.number : Number.POSITIVE_INFINITY

// Hold onto the last group/dance so the exit animation has content to render
// after the parent has cleared `props.group`.
const displayGroup = ref<EnrichedGroup | null>(null)
const displayDance = ref<ScheduleDance | null>(null)
watch(
  () => props.group,
  (g) => {
    if (g) displayGroup.value = g
  },
  { immediate: true },
)
watch(
  () => props.dance,
  (d) => {
    if (d) displayDance.value = d
  },
  { immediate: true },
)

const isOpen = computed(() => (props.morph ? props.morph.open : !!props.group))

interface DrawRow {
  key: string
  number: string
  dancer: EnrichedDancer | null
  mine: boolean
}

const drawNumbers = computed<string[] | null>(() => {
  const g = displayGroup.value
  const d = displayDance.value
  if (!g || !d?.danceId) return null
  const list = draws.value?.[g.id]?.[d.danceId]
  // Skip gaps the old admin could leave.
  const numbers = Array.isArray(list) ? list.filter((n) => n != null && n !== '') : []
  return numbers.length ? numbers : null
})

const hasRealDraw = computed(() => drawNumbers.value !== null)

const drawRows = computed<DrawRow[]>(() => {
  const g = displayGroup.value
  if (!g) return []
  const groupDancers = findGroupDancers(g.id, dancers.value)
  const byNumber = new Map(
    groupDancers.map((dn) => [String(dn.number ?? ''), dn] as const),
  )
  const mine = (d: EnrichedDancer | null) => !!d && following.isFollowing(d)
  const numbers = drawNumbers.value
  if (numbers) {
    return numbers.map((num, i) => {
      const dancer = byNumber.get(String(num)) ?? null
      return { key: `${num}:${i}`, number: num, dancer, mine: mine(dancer) }
    })
  }
  return [...groupDancers]
    .sort((a, b) => dancerNumberValue(a) - dancerNumberValue(b))
    .map((dn) => ({
      key: dn.id,
      number: dn.number != null ? String(dn.number) : '–',
      dancer: dn,
      mine: mine(dn),
    }))
})

const ord = (n: number) => `${n}${getOrdinalSuffix(n)}`

// "Callum dances 6th of 6", or for two: "Callum 6th, Isla 2nd of 6".
const yours = computed(() => {
  if (!hasRealDraw.value) return null
  const mine = drawRows.value.flatMap((r, i) =>
    r.mine && r.dancer ? [`${r.dancer.firstName || r.dancer.fullName || '?'} ${ord(i + 1)}`] : [],
  )
  if (!mine.length) return null
  return `${mine.length === 1 ? mine[0].replace(/ (\S+)$/, ' dances $1') : mine.join(', ')} of ${drawRows.value.length}`
})

// Open at your first dancer, before the sheet's first frame.
const rowEls = ref<Record<string, HTMLElement | null>>({})
watch(
  isOpen,
  async (open) => {
    if (!open) return
    await nextTick()
    const first = drawRows.value.find((r) => r.mine)
    if (first) rowEls.value[first.key]?.scrollIntoView({ block: 'center', behavior: 'instant' })
  },
  { flush: 'post' },
)

// Opening a dancer: the sheet leaves with this page instead of shrinking back
// while the next one comes in.
const router = useRouter()
function openDancer() {
  const off = router.afterEach(() => {
    off()
    if (props.morph) props.morph.dismiss()
    else emit('close')
  })
}
</script>

<template>
  <Dialog :open="isOpen" :morph="morph" variant="sheet" size="md" @close="emit('close')">
    <template v-if="displayGroup" #header>
      <p class="text-muted-foreground text-sm font-medium">
        {{ hasRealDraw ? 'Dancing order' : 'By number · order not posted yet' }}<span v-if="breadcrumb"> · {{ breadcrumb }}</span>
      </p>
      <h2 class="text-title">{{ displayGroup.fullName ?? displayGroup.name ?? 'Group' }}</h2>
      <p v-if="yours" class="text-callout font-medium">{{ yours }}</p>
    </template>

    <template v-if="displayGroup">
      <p v-if="!drawRows.length" class="text-muted-foreground p-4 text-base">
        The dancing order hasn’t been posted yet.
      </p>
      <ol v-else class="rows-inset pb-[calc(1rem+var(--safe-bottom))] [--inset:3.25rem]">
        <li
          v-for="(row, i) in drawRows"
          :key="row.key"
          :ref="(el) => (rowEls[row.key] = el as HTMLElement | null)"
          class="relative flex items-center pr-2"
          :style="row.mine && row.dancer ? following.paint(row.dancer.dancerId) : undefined"
        >
          <span v-if="row.mine" class="sash absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
          <component
            :is="row.dancer ? RouterLink : 'div'"
            v-bind="row.dancer ? { to: { name: 'competition.dancer', params: { competitionId, dancerId: row.dancer.id } } } : {}"
            :class="[
              'flex min-h-14 min-w-0 flex-1 items-center gap-2.5 py-2 pl-3',
              row.dancer && 'press-row focus-inset rounded-r-xl',
            ]"
            @click="row.dancer && openDancer()"
          >
            <span v-if="hasRealDraw" class="text-muted-foreground w-9 shrink-0 text-right text-sm font-semibold tabular-nums">
              {{ ord(i + 1) }}
            </span>
            <NumberCard
              :number="row.dancer?.number ?? row.number"
              size="xs"
              :color="row.mine ? following.colorFor(row.dancer!.dancerId) : null"
            />
            <span v-if="row.dancer" class="min-w-0">
              <span class="block truncate text-base font-semibold">{{ row.dancer.fullName || '?' }}</span>
              <span v-if="row.dancer.location" class="text-muted-foreground block truncate text-sm">
                {{ row.dancer.location }}
              </span>
            </span>
            <span v-else class="text-muted-foreground flex-1 text-base">Not on the dancer list</span>
          </component>
          <FollowButton v-if="row.dancer" :dancer="row.dancer" />
        </li>
      </ol>
    </template>
  </Dialog>
</template>
