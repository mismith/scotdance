<script setup lang="ts">
import { computed } from 'vue'
import { X } from '@lucide/vue'
import { useCompetition } from '@/composables/useCompetition'
import { useFavoritesStore } from '@/stores/favorites'
import { findGroupDancers } from '@/lib/results'
import type { EnrichedDancer, EnrichedGroup } from '@/types/competition'
import FavoriteDancerButton from '@/components/FavoriteDancerButton.vue'

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

const groupDancers = computed<EnrichedDancer[]>(() => {
  if (!props.group) return []
  return [...findGroupDancers(props.group.id, dancers.value)].sort(
    (a, b) => dancerNumberValue(a) - dancerNumberValue(b),
  )
})
</script>

<template>
  <div
    v-if="group"
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
    role="dialog"
    aria-modal="true"
    @click.self="emit('close')"
  >
    <div
      class="bg-background relative flex max-h-[85svh] w-full max-w-md flex-col rounded-t-2xl border sm:rounded-2xl"
    >
      <header class="flex items-start gap-3 border-b p-4 pr-2">
        <div class="min-w-0 flex-1 space-y-1">
          <div
            class="text-foreground/65 text-xs text-eyebrow"
          >
            Draw<span v-if="breadcrumb"> · {{ breadcrumb }}</span>
          </div>
          <h2 class="text-2xl leading-tight font-medium tracking-tight">
            {{ group.name ?? group.fullName ?? 'Group' }}
          </h2>
        </div>
        <button
          type="button"
          class="hover:bg-accent text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-full"
          title="Close"
          @click="emit('close')"
        >
          <X class="size-4" />
        </button>
      </header>

      <div class="overflow-y-auto">
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
      </div>
    </div>
  </div>
</template>
