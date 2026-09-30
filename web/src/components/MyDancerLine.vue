<script setup lang="ts">
// One of your dancers inside a list row: a dot in their colour, their first
// name, then quieter details. The dot is the app's one signal for "yours";
// stars are only ever the Follow button.
defineProps<{ color: string | null; name: string; details?: Array<string | null | undefined> }>()
</script>

<template>
  <span class="flex min-w-0 items-center gap-2 text-sm leading-snug">
    <span class="size-2.5 shrink-0 rounded-full" :style="{ background: color ?? 'var(--primary)' }" aria-hidden="true" />
    <span class="shrink-0 font-bold">{{ name }}</span>
    <span v-if="details?.some(Boolean)" class="text-muted-foreground truncate">{{ details.filter(Boolean).join(' · ') }}</span>
    <slot />
  </span>
</template>
