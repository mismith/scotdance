<script setup lang="ts">
import type { Component } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import AdminMark from '@/components/AdminMark.vue'

// One row of the sidebar (nav/AppSidebar). `current` is the page you're on
// (filled); `open` is a row on the way to it (its parent, or its parent's
// parent), drawn in ink so the path down to where you are reads at a glance.
// `admin` marks organiser and admin tools with the shield. `vt` names the row
// for page changes, so it moves to where it now sits instead of sliding
// away with the page (style.css, .sidebar).
withDefaults(
  defineProps<{
    to: RouteLocationRaw
    label: string
    icon?: Component | null
    state?: 'current' | 'open' | null
    replace?: boolean
    admin?: boolean
    vt?: string | null
  }>(),
  { icon: null, state: null, vt: null },
)
</script>

<template>
  <RouterLink
    :to="to"
    :replace="replace"
    :aria-current="state === 'current' ? 'page' : undefined"
    :style="vt ? { viewTransitionName: vt, viewTransitionClass: 'sidebar' } : undefined"
    :class="[
      'press-row focus-inset text-callout flex min-h-10 items-center gap-3 rounded-xl px-3 py-1.5',
      state === 'current' ? 'bg-blue-paper text-primary font-semibold' : state === 'open' ? 'text-foreground font-semibold' : 'font-medium',
    ]"
  >
    <span v-if="icon" :class="['relative flex shrink-0', state ? 'text-primary' : 'text-muted-foreground']">
      <component :is="icon" class="size-5" aria-hidden="true" />
      <AdminMark v-if="admin" :ring="state === 'current' ? 'blue-paper' : 'card'" />
    </span>
    <span class="line-clamp-2 min-w-0 flex-1 leading-snug">{{ label }}</span>
    <slot name="end" />
  </RouterLink>
</template>
