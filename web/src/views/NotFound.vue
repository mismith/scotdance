<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { House, Search } from '@lucide/vue'
import AppBar from '@/components/nav/AppBar.vue'
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
        <RouterLink :to="{ name: 'home' }" class="bg-primary-fill text-primary-foreground flex h-12 items-center gap-2 rounded-xl px-5 text-base font-bold">
          <House class="size-5" /> Go to Home
        </RouterLink>
        <RouterLink :to="{ name: 'search' }" class="bg-card border-strong flex h-12 items-center gap-2 rounded-xl border px-5 text-base font-bold">
          <Search class="size-5" /> Search
        </RouterLink>
      </div>
    </main>
  </div>
</template>
