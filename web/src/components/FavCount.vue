<script setup lang="ts">
import { Star } from '@lucide/vue'

defineProps<{
  favs: number
  total: number | string
}>()
</script>

<template>
  <span class="inline-flex items-center whitespace-nowrap tabular-nums">
    <template v-if="favs > 0">
      <Star class="text-secondary mr-0.5 -mt-px size-3 shrink-0 fill-current" />
      <span class="text-secondary">{{ favs }}</span
      ><span class="text-muted-foreground">/{{ total }}</span>
    </template>
    <template v-else>
      <span class="text-muted-foreground">{{ total }}</span>
    </template>
  </span>
</template>
