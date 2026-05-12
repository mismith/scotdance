<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCompetition } from '@/composables/useCompetition'
import { useFavoritesStore } from '@/stores/favorites'
import { findGroupDancers } from '@/lib/results'
import type { EnrichedDancer, EnrichedGroup } from '@/types/competition'
import FavoriteDancerButton from '@/components/FavoriteDancerButton.vue'
import Dialog from '@/components/Dialog.vue'

const props = defineProps<{
  group: EnrichedGroup | null
  eventName?: string
  danceName?: string
}>()

const breadcrumb = computed(() =>
  [props.eventName, props.danceName].filter(Boolean).join(' · '),
)

const emit = defineEmits<{
  close: []
}>()

const { competitionId, dancers } = useCompetition()
const favorites = useFavoritesStore()

const dancerNumberValue = (d: EnrichedDancer) =>
  d.number != null && Number.isFinite(d.number) ? d.number : Number.POSITIVE_INFINITY

// Hold onto the last group so the exit animation has content to render
// after the parent has cleared `props.group`.
const displayGroup = ref<EnrichedGroup | null>(null)
watch(
  () => props.group,
  (g) => {
    if (g) displayGroup.value = g
  },
  { immediate: true },
)

const isOpen = computed(() => !!props.group)

const groupDancers = computed<EnrichedDancer[]>(() => {
  if (!displayGroup.value) return []
  return [...findGroupDancers(displayGroup.value.id, dancers.value)].sort(
    (a, b) => dancerNumberValue(a) - dancerNumberValue(b),
  )
})
</script>

<template>
  <Dialog
    :open="isOpen"
    variant="sheet"
    size="md"
    @close="emit('close')"
  >
    <template v-if="displayGroup" #header>
      <div class="text-foreground/65 text-xs text-eyebrow">
        Draw<span v-if="breadcrumb"> · {{ breadcrumb }}</span>
      </div>
      <h2 class="text-2xl leading-tight font-medium tracking-tight">
        {{ displayGroup.name ?? displayGroup.fullName ?? 'Group' }}
      </h2>
    </template>

    <template v-if="displayGroup">
      <p
        v-if="!groupDancers.length"
        class="text-muted-foreground p-4 text-lg italic"
      >
        Draw not yet posted.
      </p>
      <ul v-else class="p-2">
        <li
          v-for="dancer in groupDancers"
          :key="dancer.id"
          class="flex items-center"
        >
          <RouterLink
            :to="{
              name: 'competition.dancer',
              params: { competitionId, dancerId: dancer.id },
            }"
            class="flex min-w-0 flex-1 items-center gap-3 px-2 py-2.5"
            @click="emit('close')"
          >
            <div
              :class="[
                'flex size-9 shrink-0 items-center justify-center rounded-full font-medium tabular-nums',
                favorites.isFavoriteDancer(dancer.id)
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-muted text-muted-foreground',
              ]"
            >
              {{ dancer.number ?? '–' }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-item-title truncate">
                {{ dancer.fullName || '?' }}
              </div>
              <div
                v-if="dancer.location"
                class="text-item-subtitle text-muted-foreground truncate"
              >
                {{ dancer.location }}
              </div>
            </div>
          </RouterLink>
          <FavoriteDancerButton :dancer="dancer" class="mr-1" />
        </li>
      </ul>
    </template>
  </Dialog>
</template>
