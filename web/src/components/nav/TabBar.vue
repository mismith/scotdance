<script setup lang="ts">
import type { Component } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

// Opaque, full-width, always-labelled tab bar. Used for both the app-wide tabs
// and a competition's tabs, in the same position, so there's one pattern to
// learn. Labels never scale past 12px so the bar can't break at large text.
export interface TabItem {
  label: string
  icon: Component
  to: RouteLocationRaw
  active: boolean
  badge?: boolean
}

defineProps<{ items: TabItem[]; label: string }>()
</script>

<template>
  <nav
    :aria-label="label"
    class="bg-card fixed inset-x-0 bottom-0 z-30 border-t pb-[max(0.25rem,var(--safe-bottom))]"
  >
    <div
      class="mx-auto grid h-14 max-w-3xl px-1"
      :style="{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }"
    >
      <RouterLink
        v-for="item in items"
        :key="item.label"
        v-tap-feedback
        :to="item.to"
        :aria-current="item.active ? 'page' : undefined"
        :class="[
          'relative flex flex-col items-center justify-center gap-0.5 rounded-xl text-[min(0.6875rem,12px)] leading-none font-bold',
          item.active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        ]"
        style="--tap-scale: 1"
      >
        <span
          :class="[
            'flex h-7 w-14 items-center justify-center rounded-full transition-colors',
            item.active && 'bg-blue-paper',
          ]"
        >
          <component :is="item.icon" class="size-[1.375rem]" :stroke-width="item.active ? 2.4 : 2" />
        </span>
        {{ item.label }}
        <span
          v-if="item.badge"
          class="bg-secondary absolute top-1.5 right-[calc(50%-1.5rem)] size-2 rounded-full"
          aria-hidden="true"
        />
      </RouterLink>
    </div>
  </nav>
</template>
