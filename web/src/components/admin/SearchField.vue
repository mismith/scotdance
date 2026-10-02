<script setup lang="ts">
import { Search, X } from '@lucide/vue'

// A search box for a list: a magnifier, the text, and a clear button once
// there's something to clear.
const model = defineModel<string>({ required: true })
defineProps<{ label: string; placeholder?: string }>()
</script>

<template>
  <label class="field flex h-11 items-center gap-2 rounded-xl px-3">
    <Search class="text-muted-foreground size-4 shrink-0" />
    <span class="sr-only">{{ label }}</span>
    <input v-model="model" type="search" :placeholder="placeholder ?? label" class="min-w-0 flex-1 bg-transparent text-base outline-none" />
    <!-- Field-sized, with a 44px target around it. -->
    <button
      v-if="model"
      type="button"
      aria-label="Clear search"
      class="press text-muted-foreground relative -mr-1 flex size-7 shrink-0 items-center justify-center rounded-full after:absolute after:-inset-2"
      @click="model = ''"
    >
      <X class="size-4" />
    </button>
  </label>
</template>
