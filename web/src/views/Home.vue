<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="mx-auto flex w-full max-w-3xl flex-1 items-center p-8">
    <div class="w-full space-y-6 text-center">
      <div class="space-y-2">
        <h2 class="text-3xl font-semibold tracking-tight">Highland dance, tracked.</h2>
        <p class="text-muted-foreground">
          Browse competitions, dancers, and live results.
        </p>
      </div>

      <RouterLink
        :to="{ name: 'competitions' }"
        class="bg-primary text-primary-foreground inline-flex items-center rounded-md px-4 py-2 text-sm font-medium hover:opacity-90"
      >
        Browse competitions
      </RouterLink>
    </div>
  </main>
</template>
