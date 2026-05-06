<script setup lang="ts">
import AccountMenu from '@/components/AccountMenu.vue'
</script>

<template>
  <div class="flex flex-1 flex-col">
    <header
      class="bg-background sticky top-0 z-20 mx-auto flex w-full max-w-3xl items-center justify-end p-4"
    >
      <AccountMenu />
    </header>
    <main class="mx-auto flex w-full max-w-3xl flex-1 items-center p-8">
      <div class="w-full space-y-6 text-center">
        <div class="space-y-3">
          <div
            class="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase"
          >
            ScotDance.app
          </div>
          <h2 class="font-serif text-5xl font-medium tracking-tight">
            Highland dance, tracked.
          </h2>
          <p class="text-muted-foreground font-serif text-lg">
            Browse competitions, dancers, and live results.
          </p>
        </div>
      </div>
    </main>
  </div>
</template>
