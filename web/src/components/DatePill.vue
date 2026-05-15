<script setup lang="ts">
import { computed } from 'vue'
import ExpandingPill from '@/components/ExpandingPill.vue'

export type DateFilter = 'archived' | 'current' | 'all'

const model = defineModel<DateFilter>({ required: true })

const options: Array<{ id: DateFilter; label: string }> = [
  { id: 'archived', label: 'Archived' },
  { id: 'current', label: 'Current' },
  { id: 'all', label: 'All' },
]

const currentLabel = computed(
  () => options.find((o) => o.id === model.value)?.label ?? 'Current',
)

function select(id: DateFilter, close: () => void) {
  model.value = id
  close()
}
</script>

<template>
  <ExpandingPill id="date" :aria-label="`Date filter: ${currentLabel}`">
    <template #compact>
      <span>{{ currentLabel }}</span>
    </template>

    <template #expanded="{ close }">
      <div class="flex h-12 w-full items-center px-1">
        <button
          v-for="opt in options"
          :key="opt.id"
          type="button"
          :class="[
            'inline-flex h-10 flex-auto items-center justify-center rounded-full px-3 font-sans text-sm font-medium transition-colors',
            model === opt.id
              ? 'bg-nav-foreground/15'
              : 'opacity-70 hover:opacity-100',
          ]"
          @click="select(opt.id, close)"
        >
          {{ opt.label }}
        </button>
      </div>
    </template>
  </ExpandingPill>
</template>
