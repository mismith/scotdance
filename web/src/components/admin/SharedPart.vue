<script setup lang="ts">
// A part of a linked competition's Details that it shares from the main one
// (ADR 0007): shown as it is, as plain text, since it's changed there.
defineProps<{ title: string }>()
</script>

<template>
  <section class="space-y-2">
    <div class="flex items-baseline justify-between gap-2">
      <h2 class="text-heading">{{ title }}</h2>
      <span class="text-primary text-sm font-bold">Shared</span>
    </div>
    <div class="bg-muted text-callout rounded-2xl px-4 py-3 leading-relaxed"><slot /></div>
  </section>
</template>
