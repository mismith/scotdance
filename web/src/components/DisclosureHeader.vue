<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'

defineProps<{
  label: string
  expanded?: boolean
  disabled?: boolean
}>()

defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    class="text-disclosure-heading flex w-full items-center gap-3 px-1 py-2 text-left disabled:cursor-default"
    @click="$emit('toggle')"
  >
    <ChevronDown
      v-if="!disabled"
      :class="[
        'text-muted-foreground size-4 shrink-0 transition-transform',
        expanded ? '' : '-rotate-90',
      ]"
    />
    <span v-else class="size-4 shrink-0" aria-hidden="true" />
    <span class="flex min-w-0 items-baseline gap-1.5">
      <span class="truncate">{{ label }}</span>
      <template v-if="$slots.count">
        <span aria-hidden="true">·</span>
        <span class="text-muted-foreground tabular-nums"><slot name="count" /></span>
      </template>
    </span>
    <span class="border-border flex-1 border-t" aria-hidden="true" />
    <slot />
  </button>
</template>
