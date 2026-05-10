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
  <div class="text-disclosure-heading flex items-center gap-3 px-1 py-2">
    <button
      type="button"
      :disabled="disabled"
      :aria-expanded="disabled ? undefined : expanded"
      class="flex min-w-0 items-baseline gap-1.5 text-left disabled:cursor-default"
      @click="$emit('toggle')"
    >
      <ChevronDown
        v-if="!disabled"
        :class="[
          'text-muted-foreground size-4 shrink-0 self-center transition-transform',
          expanded ? '' : '-rotate-90',
        ]"
      />
      <span v-else class="size-4 shrink-0 self-center" aria-hidden="true" />
      <span class="truncate">{{ label }}</span>
      <template v-if="$slots.count">
        <span aria-hidden="true">·</span>
        <span class="text-muted-foreground tabular-nums"><slot name="count" /></span>
      </template>
    </button>
    <span class="border-border flex-1 border-t" aria-hidden="true" />
    <slot />
  </div>
</template>
