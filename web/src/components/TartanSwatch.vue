<script setup lang="ts">
import { computed } from 'vue'
import { tartanLayer, type Tartan } from '@/lib/tartan'

// A piece of the cloth, drawn from its threadcount.
const props = withDefaults(defineProps<{ tartan: Pick<Tartan, 'threadcount' | 'palette'> | null; scale?: number }>(), {
  scale: 0.6,
})
const background = computed(() => (props.tartan ? tartanLayer(props.tartan, props.scale) : null))
</script>

<template>
  <span class="bg-muted block" :style="background ? { background } : undefined" aria-hidden="true" />
</template>
