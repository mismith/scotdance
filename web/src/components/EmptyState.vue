<script setup lang="ts">
import type { Component } from 'vue'

// Nothing here (yet): an icon, a title, one line on what to do, then the
// actions for it (the main one first) and, below, any other way out.
defineProps<{
  icon?: Component
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center gap-4 px-6 py-16 text-center">
    <div
      v-if="icon"
      class="bg-muted text-muted-foreground/80 flex size-14 items-center justify-center rounded-full"
    >
      <component :is="icon" class="size-6" />
    </div>
    <div class="space-y-2">
      <div class="text-title">{{ title }}</div>
      <p v-if="description" class="text-muted-foreground mx-auto max-w-sm text-base">
        {{ description }}
      </p>
    </div>
    <!-- Stacked, the same width, so they line up however many there are. -->
    <div
      v-if="$slots.default"
      class="flex w-full max-w-xs flex-col gap-2 [&>*]:justify-center"
    >
      <slot />
    </div>
    <p v-if="$slots.footer" class="text-muted-foreground max-w-sm text-sm">
      <slot name="footer" />
    </p>
  </div>
</template>
