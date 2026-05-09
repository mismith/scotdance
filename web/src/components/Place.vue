<script setup lang="ts">
import { computed } from 'vue'
import { getOrdinalSuffix } from '@/lib/results'

const props = defineProps<{
  place: number | null
  tied?: boolean
  pointed?: boolean
}>()

const ordinal = computed(() => (props.place != null ? getOrdinalSuffix(props.place) : ''))

const tone = computed(() => {
  if (props.pointed) return 'bg-amber-100 text-amber-900 border-amber-300'
  if (props.place != null) return 'bg-muted text-muted-foreground border-transparent'
  return 'bg-transparent text-muted-foreground border-dashed border-muted-foreground/40'
})
</script>

<template>
  <span
    :title="tied ? 'Tied' : undefined"
    :class="[
      'inline-flex h-9 min-w-9 flex-col items-center justify-center rounded-md border px-2 font-serif leading-none font-medium tracking-tight tabular-nums',
      tone,
    ]"
  >
    <template v-if="pointed">
      <span class="text-xl">♦</span>
    </template>
    <template v-else-if="place != null">
      <span class="inline-flex items-baseline text-xl">
        <span>{{ place }}</span>
        <sup class="ml-0.5">{{ ordinal }}</sup>
      </span>
      <span
        v-if="tied"
        class="-mt-1 font-sans text-sm font-bold tracking-[0.08em] uppercase opacity-60"
      >
        Tie
      </span>
    </template>
    <template v-else>
      <span class="text-xl">—</span>
    </template>
  </span>
</template>
