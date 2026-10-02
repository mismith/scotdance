<script setup lang="ts">
import { House, Search } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
import Button from '@/components/ui/Button.vue'
</script>

<template>
  <div class="flex flex-1 flex-col pb-[calc(var(--chrome-bottom)+1.5rem)]">
    <AppBar :fallback="{ to: { name: 'home' }, label: 'Home' }" />
    <main class="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 class="text-display">This page isn’t here</h1>
      <p class="text-muted-foreground max-w-sm text-base">
        The link may be old, or the competition may no longer be public. Try Home, or search for what you were looking for.
      </p>
      <div class="flex flex-wrap justify-center gap-2">
        <Button variant="primary" size="lg" :to="{ name: 'home' }"><House /> Go to Home</Button>
        <Button size="lg" :to="{ name: 'search' }"><Search /> Search</Button>
      </div>
    </main>
  </div>
</template>
