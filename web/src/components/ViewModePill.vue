<script setup lang="ts">
import { computed } from 'vue'
import { CalendarDays, List, Map as MapIcon } from '@lucide/vue'
import ExpandingPill from '@/components/ExpandingPill.vue'

export type ViewMode = 'list' | 'map' | 'calendar'

const model = defineModel<ViewMode>({ required: true })

const modes: Array<{ id: ViewMode; label: string; icon: typeof List }> = [
  { id: 'list', label: 'List', icon: List },
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
]

const current = computed(() => modes.find((m) => m.id === model.value) ?? modes[0])

function select(id: ViewMode, close: () => void) {
  model.value = id
  close()
}
</script>

<template>
  <ExpandingPill id="viewmode" :aria-label="`View: ${current.label}`">
    <template #compact>
      <component :is="current.icon" class="size-5" />
    </template>

    <template #expanded="{ close }">
      <div class="flex h-12 w-full items-center px-1">
        <button
          v-for="mode in modes"
          :key="mode.id"
          type="button"
          :class="[
            'inline-flex h-10 flex-auto items-center justify-center gap-1.5 rounded-full px-3 font-sans text-sm font-medium transition-colors',
            model === mode.id
              ? 'bg-card-foreground/15'
              : 'opacity-70 hover:opacity-100',
          ]"
          @click="select(mode.id, close)"
        >
          <component :is="mode.icon" class="hidden size-4 md:inline-block" />
          {{ mode.label }}
        </button>
      </div>
    </template>
  </ExpandingPill>
</template>
