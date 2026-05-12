<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import FavCount from '@/components/FavCount.vue'

defineProps<{
  label: string
  expanded?: boolean
  disabled?: boolean
  count?: number | string | null
  favs?: number
}>()

defineEmits<{ toggle: [] }>()
</script>

<template>
  <div
    :class="['text-disclosure-heading flex items-center gap-3 px-1 py-2']"
    @click="!disabled && $emit('toggle')"
  >
    <button
      type="button"
      :disabled="disabled"
      :aria-expanded="disabled ? undefined : expanded"
      class="flex min-w-0 items-baseline gap-1.5 text-left font-serif disabled:cursor-default"
      @click.stop="$emit('toggle')"
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
    </button>
    <span class="border-border flex-1 border-t" aria-hidden="true" />
    <span
      v-if="favs != null && typeof count === 'number'"
      class="text-muted-foreground font-sans text-base"
    >
      <FavCount :favs="favs" :total="count" />
    </span>
    <span
      v-else-if="count != null && count !== ''"
      class="text-muted-foreground font-sans text-base tabular-nums"
      >{{ count }}</span
    >
    <slot />
  </div>
</template>
