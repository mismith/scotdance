<script setup lang="ts">
import { computed, ref } from 'vue'
import { CalendarDays, Check, ChevronDown, List, Map as MapIcon } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'

export type ViewMode = 'list' | 'map' | 'calendar'

const model = defineModel<ViewMode>({ required: true })
const open = ref(false)

const modes: Array<{ id: ViewMode; label: string; hint: string; icon: typeof List }> = [
  { id: 'list', label: 'List', hint: 'By month, soonest first', icon: List },
  { id: 'calendar', label: 'Calendar', hint: 'A month at a time', icon: CalendarDays },
  { id: 'map', label: 'Map', hint: 'See what’s near you', icon: MapIcon },
]
const current = computed(() => modes.find((m) => m.id === model.value) ?? modes[0])

function pick(id: ViewMode) {
  model.value = id
  open.value = false
}
</script>

<template>
  <button
    type="button"
    class="bg-card border-strong flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[0.9375rem] font-bold"
    :aria-label="`Show as ${current.label}`"
    aria-haspopup="dialog"
    @click="open = true"
  >
    <component :is="current.icon" class="text-primary size-[1.125rem]" />
    {{ current.label }}
    <ChevronDown class="text-muted-foreground size-4" />
  </button>

  <Dialog :open="open" variant="sheet" @close="open = false">
    <template #header>
      <h2 class="text-title">Show competitions as</h2>
    </template>
    <div class="p-4 pb-[calc(1.5rem+var(--safe-bottom))]">
      <ul class="bg-card divide-y overflow-hidden rounded-2xl border" role="radiogroup" aria-label="Show competitions as">
        <li v-for="m in modes" :key="m.id">
          <button type="button" role="radio" :aria-checked="model === m.id" class="flex min-h-16 w-full items-center gap-3 px-4 text-left" @click="pick(m.id)">
            <component :is="m.icon" class="text-primary size-5 shrink-0" />
            <span class="min-w-0 flex-1">
              <span class="block text-base font-bold">{{ m.label }}</span>
              <span class="text-muted-foreground block text-sm">{{ m.hint }}</span>
            </span>
            <Check v-if="model === m.id" class="text-primary size-5" stroke-width="3" />
          </button>
        </li>
      </ul>
    </div>
  </Dialog>
</template>
