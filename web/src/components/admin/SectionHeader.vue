<script setup lang="ts">
// The top of a Manage section (and a page within one), the same in each:
// its title (and how many), with Select or a ⋯ menu beside it, then anything
// else underneath: the ways to add, search.

defineProps<{
  title: string
  /** Shown faintly after the title: how many, or how far along. */
  count?: string | number | null
  /** A line above the title: what this page belongs to. */
  kicker?: string | null
  description?: string
}>()
</script>

<template>
  <header class="space-y-3">
    <div class="space-y-1">
      <p v-if="kicker" class="text-muted-foreground text-sm font-medium">{{ kicker }}</p>
      <div class="flex min-h-11 items-center gap-2">
        <h1 class="text-title min-w-0 flex-1 truncate">
          {{ title }}
          <span
            v-if="count != null && count !== ''"
            class="text-muted-foreground text-base font-medium tabular-nums"
            >{{ count }}</span
          >
        </h1>
        <slot name="actions" />
      </div>
      <p v-if="description" class="text-muted-foreground text-base">{{ description }}</p>
    </div>
    <slot />
  </header>
</template>
