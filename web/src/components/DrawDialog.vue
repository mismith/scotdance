<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCompetition } from '@/composables/useCompetition'
import { useFavoritesStore } from '@/stores/favorites'
import { findGroupDancers } from '@/lib/results'
import type {
  EnrichedDancer,
  EnrichedGroup,
  ScheduleDance,
} from '@/types/competition'
import FavoriteDancerButton from '@/components/FavoriteDancerButton.vue'
import Dialog from '@/components/Dialog.vue'

const props = defineProps<{
  group: EnrichedGroup | null
  dance?: ScheduleDance | null
  eventName?: string
  danceName?: string
}>()

const breadcrumb = computed(() =>
  [props.eventName, props.danceName].filter(Boolean).join(' · '),
)

const emit = defineEmits<{
  close: []
}>()

const { competitionId, dancers, draws } = useCompetition()
const favorites = useFavoritesStore()

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

const isOpen = computed(() => !!props.group)

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
  <Dialog :open="isOpen" variant="sheet" size="md" @close="emit('close')">
    <template v-if="displayGroup" #header>
      <div class="text-foreground/65 text-eyebrow text-xs">
        {{ hasRealDraw ? 'Draw' : 'Order'
        }}<span v-if="breadcrumb"> · {{ breadcrumb }}</span>
      </div>
      <h2 class="text-2xl leading-tight font-medium tracking-tight">
        {{ displayGroup.name ?? displayGroup.fullName ?? 'Group' }}
      </h2>
    </template>

    <template v-if="displayGroup">
      <p v-if="!drawRows.length" class="text-muted-foreground p-4 text-lg italic">
        Draw not yet posted.
      </p>
      <ul v-else class="p-2">
        <li v-for="row in drawRows" :key="row.key" class="flex items-center">
          <template v-if="row.dancer">
            <RouterLink
              :to="{
                name: 'competition.dancer',
                params: { competitionId, dancerId: row.dancer.id },
              }"
              class="flex min-w-0 flex-1 items-center gap-3 px-2 py-2.5"
              @click="emit('close')"
            >
              <div
                :class="[
                  'flex size-9 shrink-0 items-center justify-center rounded-full font-medium tabular-nums',
                  favorites.isFavoriteDancer(row.dancer.id)
                    ? 'bg-secondary text-secondary-foreground'
                    : 'bg-muted text-muted-foreground',
                ]"
              >
                {{ row.dancer.number ?? '–' }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-item-title truncate">
                  {{ row.dancer.fullName || '?' }}
                </div>
                <div
                  v-if="row.dancer.location"
                  class="text-item-subtitle text-muted-foreground truncate"
                >
                  {{ row.dancer.location }}
                </div>
              </div>
            </RouterLink>
            <FavoriteDancerButton :dancer="row.dancer" class="mr-1" />
          </template>
          <div v-else class="flex min-w-0 flex-1 items-center gap-3 px-2 py-2.5">
            <div
              class="border-muted-foreground/30 text-muted-foreground/60 flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed font-medium tabular-nums"
            >
              {{ row.number }}
            </div>
            <div class="text-item-title text-muted-foreground truncate italic">
              Unknown dancer
            </div>
          </div>
        </li>
      </ul>
    </template>
  </Dialog>
</template>
