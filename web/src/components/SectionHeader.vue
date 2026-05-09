<script setup lang="ts">
defineProps<{
  label: string
  count?: number | string | null
}>()
</script>

<template>
  <div
    class="text-foreground/65 flex items-center gap-3 px-1 text-xs font-medium tracking-[0.18em] uppercase"
  >
    <span class="flex items-baseline gap-1.5">
      <span>{{ label }}</span>
      <template v-if="count != null && count !== ''">
        <span aria-hidden="true">·</span>
        <span class="tabular-nums">{{ count }}</span>
      </template>
    </span>
    <span class="border-border flex-1 border-t" aria-hidden="true" />
    <slot />
  </div>
</template>
