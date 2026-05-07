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
  <span class="inline-flex flex-col items-center" :title="tied ? 'Tied' : undefined">
    <span
      :class="[
        'font-serif inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-base font-medium tabular-nums tracking-tight',
        tone,
      ]"
    >
      <template v-if="pointed">♦</template>
      <template v-else-if="place != null">
        <span>{{ place }}</span>
        <sup class="ml-0.5 text-[0.55rem] font-medium">{{ ordinal }}</sup>
      </template>
      <template v-else>—</template>
    </span>
    <span
      v-if="tied"
      class="text-muted-foreground/70 mt-0.5 text-[9px] font-bold tracking-[0.14em] uppercase"
    >
      Tie
    </span>
  </span>
</template>
