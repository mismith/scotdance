<script setup lang="ts">
import FavCount from '@/components/FavCount.vue'

defineProps<{
  label: string
  count?: number | string | null
  favs?: number
}>()
</script>

<template>
  <div
    class="text-foreground/65 flex items-center gap-3 px-1 text-eyebrow"
  >
    <span>{{ label }}</span>
    <span class="border-border flex-1 border-t" aria-hidden="true" />
    <FavCount
      v-if="favs != null && typeof count === 'number'"
      :favs="favs"
      :total="count"
    />
    <span
      v-else-if="count != null && count !== ''"
      class="tabular-nums"
    >{{ count }}</span>
    <slot />
  </div>
</template>
