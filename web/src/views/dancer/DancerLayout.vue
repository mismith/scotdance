<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AccountMenu from '@/components/AccountMenu.vue'

const route = useRoute()
const dancerId = computed(() => String(route.params.dancerId ?? ''))
</script>

<template>
  <div class="flex flex-1 flex-col">
    <header class="bg-background sticky top-0 z-20 border-b">
      <div class="mx-auto flex max-w-3xl items-center gap-3 p-4">
        <div
          class="text-secondary-foreground bg-secondary flex size-11 shrink-0 items-center justify-center rounded-full"
        >
          <span class="font-serif text-base font-medium leading-none">?</span>
        </div>
        <div class="min-w-0 flex-1">
          <h1
            class="font-serif truncate text-lg font-medium tracking-tight leading-[1.1]"
          >
            Dancer
          </h1>
          <p class="text-muted-foreground truncate font-mono text-xs">{{ dancerId }}</p>
        </div>
        <AccountMenu />
      </div>
    </header>

    <main class="mx-auto w-full max-w-3xl flex-1 p-4">
      <RouterView />
    </main>
  </div>
</template>
