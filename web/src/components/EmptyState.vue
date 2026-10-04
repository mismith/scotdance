<script setup lang="ts">
import type { Component } from 'vue'
import LogoMark from '@/components/LogoMark.vue'

// Nothing here (yet): an icon, a title, one line on what to do, then the
// actions for it (the main one first) and, below, any other way out. `page`
// fills an empty screen; `inline` sits inside a list or panel (no results,
// a section with nothing in it). It settles in rather than popping. `scott`
// puts the logo dancer in place of the icon, for the friendly, low-stakes
// empties (nothing followed, nothing found), never on competition-day screens.
withDefaults(
  defineProps<{
    icon?: Component
    scott?: boolean
    title: string
    description?: string
    size?: 'page' | 'inline'
  }>(),
  { icon: undefined, scott: false, description: undefined, size: 'page' },
)
</script>

<template>
  <div
    :class="[
      'flex flex-col items-center text-center motion-safe:animate-[rise-in_var(--dur-slow)_var(--ease-snappy)_both]',
      size === 'inline' ? 'gap-3 px-4 py-8' : 'gap-4 px-6 py-16',
    ]"
  >
    <LogoMark v-if="scott" :class="['text-primary', size === 'inline' ? 'size-16' : 'size-20']" />
    <div
      v-else-if="icon"
      :class="[
        'bg-muted text-muted-foreground/80 flex items-center justify-center rounded-full',
        size === 'inline' ? 'size-11' : 'size-14',
      ]"
    >
      <component :is="icon" :class="size === 'inline' ? 'size-5' : 'size-6'" />
    </div>
    <div class="space-y-1.5">
      <div :class="size === 'inline' ? 'text-heading' : 'text-title'">{{ title }}</div>
      <p v-if="description" class="text-muted-foreground mx-auto max-w-sm text-base">
        {{ description }}
      </p>
    </div>
    <!-- Stacked, the same width, so they line up however many there are. -->
    <div
      v-if="$slots.default"
      class="flex w-full max-w-xs flex-col gap-2 [&>*]:justify-center"
    >
      <slot />
    </div>
    <p v-if="$slots.footer" class="text-muted-foreground max-w-sm text-sm">
      <slot name="footer" />
    </p>
  </div>
</template>
