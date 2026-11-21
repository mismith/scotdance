<script setup lang="ts">
import DancerStars from '@/components/DancerStars.vue'

// One of your dancers inside a list row: a star in their colour (the app's
// one mark for "yours", DancerStars), their first name, then quieter details.
defineProps<{ color: string | null; name: string; details?: Array<string | null | undefined> }>()
</script>

<template>
  <span class="flex min-w-0 items-center gap-2 text-sm leading-snug">
    <DancerStars :colors="[color]" />
    <span class="shrink-0 font-semibold">{{ name }}</span>
    <span v-if="details?.some(Boolean)" class="text-muted-foreground truncate">{{ details.filter(Boolean).join(' · ') }}</span>
    <slot />
  </span>
</template>
