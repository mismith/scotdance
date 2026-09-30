<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCompetition } from '@/composables/useCompetition'
import { useFollowing } from '@/composables/useFollowing'
import { findGroupDancers } from '@/lib/results'
import type {
  EnrichedDancer,
  EnrichedGroup,
  ScheduleDance,
} from '@/types/competition'
import FollowButton from '@/components/FollowButton.vue'
import NumberCard from '@/components/NumberCard.vue'
import { getOrdinalSuffix } from '@/lib/results'
import Dialog from '@/components/Dialog.vue'
import type { Morph } from '@/lib/morph'

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
}

const drawNumbers = computed<string[] | null>(() => {
  const g = displayGroup.value
  const d = displayDance.value
  if (!g || !d?.danceId) return null
  const list = draws.value?.[g.id]?.[d.danceId]
  return Array.isArray(list) && list.length ? list : null
})

const hasRealDraw = computed(() => drawNumbers.value !== null)

const drawRows = computed<DrawRow[]>(() => {
  const g = displayGroup.value
  if (!g) return []
  const groupDancers = findGroupDancers(g.id, dancers.value)
  const byNumber = new Map(
    groupDancers.map((dn) => [String(dn.number ?? ''), dn] as const),
  )
  const numbers = drawNumbers.value
  if (numbers) {
    return numbers.map((num, i) => ({
      key: `${num}:${i}`,
      number: num,
      dancer: byNumber.get(String(num)) ?? null,
    }))
  }
  return [...groupDancers]
    .sort((a, b) => dancerNumberValue(a) - dancerNumberValue(b))
    .map((dn) => ({
      key: dn.id,
      number: dn.number != null ? String(dn.number) : '–',
      dancer: dn,
    }))
})
</script>

<template>
  <Dialog :open="isOpen" :morph="morph" variant="sheet" size="md" @close="emit('close')">
    <template v-if="displayGroup" #header>
      <p class="text-muted-foreground text-sm font-bold">
        {{ hasRealDraw ? 'Dancing order' : 'By number (order not posted)' }}<span v-if="breadcrumb"> · {{ breadcrumb }}</span>
      </p>
      <h2 class="text-title">{{ displayGroup.fullName ?? displayGroup.name ?? 'Group' }}</h2>
    </template>

    <template v-if="displayGroup">
      <p v-if="!drawRows.length" class="text-muted-foreground p-4 text-base">
        The dancing order hasn’t been posted yet.
      </p>
      <ol v-else class="divide-y pb-[calc(1rem+var(--safe-bottom))]">
        <li
          v-for="(row, i) in drawRows"
          :key="row.key"
          class="relative flex min-h-14 items-center gap-2.5 pr-2 pl-3"
          :style="
            row.dancer && following.isFollowing(row.dancer)
              ? { ...following.paint(row.dancer.dancerId), backgroundColor: 'color-mix(in srgb, var(--dc) 9%, var(--card))' }
              : undefined
          "
        >
          <span
            v-if="row.dancer && following.isFollowing(row.dancer)"
            class="sash absolute inset-y-0 left-0 w-1.5"
            aria-hidden="true"
          />
          <span v-if="hasRealDraw" class="text-muted-foreground w-9 shrink-0 text-right text-sm font-bold tabular-nums">
            {{ i + 1 }}{{ getOrdinalSuffix(i + 1) }}
          </span>
          <template v-if="row.dancer">
            <NumberCard
              :number="row.dancer.number"
              size="xs"
              :color="following.isFollowing(row.dancer) ? following.colorFor(row.dancer.dancerId) : null"
            />
            <RouterLink
              :to="{ name: 'competition.dancer', params: { competitionId, dancerId: row.dancer.id } }"
              class="min-w-0 flex-1 py-2"
              @click="emit('close')"
            >
              <span class="block truncate text-base font-semibold">{{ row.dancer.fullName || '?' }}</span>
              <span v-if="row.dancer.location" class="text-muted-foreground block truncate text-sm">
                {{ row.dancer.location }}
              </span>
            </RouterLink>
            <FollowButton :dancer="row.dancer" />
          </template>
          <template v-else>
            <NumberCard :number="row.number" size="xs" />
            <span class="text-muted-foreground flex-1 text-base">Not on the dancer list</span>
          </template>
        </li>
      </ol>
    </template>
  </Dialog>
</template>
