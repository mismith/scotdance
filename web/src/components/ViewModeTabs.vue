<script setup lang="ts">
import { useRoute, type RouteLocationRaw } from 'vue-router'
import { CalendarDays, List, Map as MapIcon } from '@lucide/vue'

export type ViewMode = 'list' | 'map' | 'calendar'

defineProps<{
  current: ViewMode
}>()

const route = useRoute()

const modes: Array<{ id: ViewMode; label: string; icon: typeof List }> = [
  { id: 'list', label: 'List', icon: List },
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
]

function to(id: ViewMode): RouteLocationRaw {
  return {
    query: { ...route.query, view: id === 'list' ? undefined : id },
  }
}
</script>

<template>
  <div class="bg-chip inline-flex rounded-lg p-1">
    <RouterLink
      v-for="mode in modes"
      :key="mode.id"
      :to="to(mode.id)"
      replace
      :class="[
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
        current === mode.id
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      ]"
    >
      <component :is="mode.icon" class="size-3.5" />
      {{ mode.label }}
    </RouterLink>
  </div>
</template>
