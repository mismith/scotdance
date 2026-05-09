<script setup lang="ts">
import { CalendarDays, List, Map as MapIcon } from '@lucide/vue'

export type ViewMode = 'list' | 'map' | 'calendar'

const model = defineModel<ViewMode>({ required: true })

const modes: Array<{ id: ViewMode; label: string; icon: typeof List }> = [
  { id: 'list', label: 'List', icon: List },
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
]
</script>

<template>
  <div class="bg-chip inline-flex rounded-lg p-1">
    <button
      v-for="mode in modes"
      :key="mode.id"
      type="button"
      :class="[
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors',
        model === mode.id
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      ]"
      @click="model = mode.id"
    >
      <component :is="mode.icon" class="size-3.5" />
      {{ mode.label }}
    </button>
  </div>
</template>
