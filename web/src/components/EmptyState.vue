<script setup lang="ts">
import type { Component } from 'vue'

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
      <div class="font-serif text-2xl font-medium tracking-tight">{{ title }}</div>
      <p
        v-if="description"
        class="text-muted-foreground mx-auto max-w-sm font-serif text-base"
      >
        {{ description }}
      </p>
    </div>
  </div>
</template>
