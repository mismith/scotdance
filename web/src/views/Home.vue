<script setup lang="ts">
import { RouterLink } from 'vue-router';
import AccountButton from '@/components/AccountButton.vue';
</script>

<template>
  <main class="min-h-svh flex flex-col">
    <header class="border-b">
      <div class="max-w-3xl mx-auto p-4 flex items-center gap-4">
        <h1 class="text-lg font-semibold flex-1">ScotDance.app</h1>
        <AccountButton />
      </div>
    </header>

    <div class="flex-1 max-w-3xl w-full mx-auto p-8 flex items-center">
      <div class="space-y-6 w-full text-center">
        <div class="space-y-2">
          <h2 class="text-3xl font-semibold tracking-tight">Highland dance, tracked.</h2>
          <p class="text-muted-foreground">Browse competitions, dancers, and live results.</p>
        </div>

        <RouterLink
          :to="{ name: 'competitions' }"
          class="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          Browse competitions
        </RouterLink>
      </div>
    </div>
  </main>
</template>
