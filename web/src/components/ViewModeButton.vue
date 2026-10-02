<script setup lang="ts">
import { computed } from 'vue'
import { CalendarDays, Check, ChevronDown, List, Map as MapIcon } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import { useMorph } from '@/lib/morph'
import { selectionHaptic } from '@/lib/haptics'

export type ViewMode = 'list' | 'map' | 'calendar'

// List, Calendar or Map: a small menu that grows out of the pill, just
// under it, with a check on the current one.
const model = defineModel<ViewMode>({ required: true })
defineProps<{ glass?: boolean }>()
const menu = useMorph()

const modes: Array<{ id: ViewMode; label: string; hint: string; icon: typeof List }> = [
  { id: 'list', label: 'List', hint: 'By month, soonest first', icon: List },
  { id: 'calendar', label: 'Calendar', hint: 'A month at a time', icon: CalendarDays },
  { id: 'map', label: 'Map', hint: 'See what’s near you', icon: MapIcon },
]
const current = computed(() => modes.find((m) => m.id === model.value) ?? modes[0])

function pick(id: ViewMode) {
  if (id !== model.value) selectionHaptic()
  model.value = id
  menu.hide()
}
</script>

<template>
  <button
    type="button"
    :class="[
      'press flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-callout font-semibold',
      glass ? 'glass' : 'surface',
    ]"
    :aria-label="`Show as ${current.label}`"
    aria-haspopup="dialog"
    :aria-expanded="menu.open"
    @click="menu.show($event)"
  >
    <component :is="current.icon" class="text-primary size-[1.125rem]" aria-hidden="true" />
    {{ current.label }}
    <ChevronDown class="text-muted-foreground size-4" aria-hidden="true" />
  </button>

  <Dialog :open="menu.open" :morph="menu" variant="dropdown" aria-label="Show competitions as" @close="menu.hide()">
    <ul role="radiogroup" aria-label="Show competitions as">
      <li v-for="m in modes" :key="m.id">
        <button
          type="button"
          role="radio"
          :aria-checked="model === m.id"
          class="press-row focus-inset flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-base font-medium"
          @click="pick(m.id)"
        >
          <component :is="m.icon" class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            {{ m.label }}
            <span class="text-muted-foreground block text-sm font-normal">{{ m.hint }}</span>
          </span>
          <Check v-if="model === m.id" class="text-primary size-5 shrink-0" stroke-width="2.5" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </Dialog>
</template>
