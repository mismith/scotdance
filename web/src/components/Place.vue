<script setup lang="ts">
import { computed } from 'vue';
import { getOrdinalSuffix } from '@/lib/results';

const props = defineProps<{
  place: number | null;
  tied?: boolean;
  pointed?: boolean;
}>();

const ordinal = computed(() => (props.place != null ? getOrdinalSuffix(props.place) : ''));

const tone = computed(() => {
  if (props.pointed) return 'bg-amber-100 text-amber-900 border-amber-300';
  if (props.place === 1) return 'bg-yellow-100 text-yellow-900 border-yellow-300';
  if (props.place === 2) return 'bg-zinc-100 text-zinc-900 border-zinc-300';
  if (props.place === 3) return 'bg-orange-100 text-orange-900 border-orange-300';
  if (props.place != null) return 'bg-muted text-muted-foreground border-transparent';
  return 'bg-transparent text-muted-foreground border-dashed border-muted-foreground/40';
});
</script>

<template>
  <span
    :class="[
      'inline-flex items-center justify-center min-w-9 h-9 px-2 rounded-md border text-sm font-mono font-medium tabular-nums',
      tone,
    ]"
    :title="tied ? 'Tied' : undefined"
  >
    <template v-if="pointed">♦</template>
    <template v-else-if="place != null">
      <span>{{ place }}</span>
      <sup class="text-[0.6rem] ml-0.5">{{ ordinal }}</sup>
      <span v-if="tied" class="text-xs ml-0.5">=</span>
    </template>
    <template v-else>—</template>
  </span>
</template>
