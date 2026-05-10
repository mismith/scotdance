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
  if (props.pointed) return 'bg-amber-100 dark:bg-amber-900/30'
  if (props.place != null) return 'bg-primary/10'
  return 'border border-dashed border-muted-foreground/30'
})
</script>

<template>
  <span
    :title="tied ? 'Tied' : undefined"
    :class="[
      'font-serif inline-flex min-w-[2em] shrink-0 items-baseline justify-center rounded-md px-2 py-1.5 text-2xl leading-none font-medium tracking-tight tabular-nums',
      tone,
    ]"
  >
    <template v-if="pointed">
      <span class="text-amber-700 dark:text-amber-300">♦</span>
    </template>
    <template v-else-if="place != null">
      <span :class="['text-primary', tied && 'italic opacity-70']">{{ place }}</span>
      <sup class="text-primary/60 ml-0.5 text-[0.5em] font-normal">{{ ordinal }}</sup>
    </template>
    <template v-else>
      <span class="text-muted-foreground/50">—</span>
    </template>
  </span>
</template>
