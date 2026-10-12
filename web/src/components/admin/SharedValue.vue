<script setup lang="ts">
import { Lock } from '@lucide/vue'
import { useSharedSheet } from '@/composables/admin/useSharedParts'
import type { LinkPart } from '@/lib/linked'

// A field a linked competition shares from its main one (ADR 0007 §7): in
// its usual place, with its label, its value readable as it is, and a lock
// where you'd edit. Tapping it says why (the page's SharedSheet).
withDefaults(
  defineProps<{
    label: string
    part: LinkPart
    /** The value as text; or put anything else (a picture, rows) in the slot. */
    value?: string | null
    multiline?: boolean
    /** The section heading says it already. */
    hideLabel?: boolean
  }>(),
  { value: null },
)
const sheet = useSharedSheet()
</script>

<template>
  <div class="space-y-1.5">
    <span v-if="!hideLabel" class="text-callout block font-medium" aria-hidden="true">{{ label }}</span>
    <button
      type="button"
      :class="[
        'press bg-muted flex min-h-12 w-full gap-3 rounded-xl px-3 text-left text-base',
        multiline || $slots.default ? 'items-start py-3' : 'items-center',
      ]"
      @click="sheet?.explain(part, $event)"
    >
      <span class="sr-only">{{ label }}: </span>
      <span :class="['min-w-0 flex-1', multiline ? 'whitespace-pre-line' : 'truncate']">
        <slot>
          <template v-if="value?.trim()">{{ value }}</template>
          <span v-else class="text-muted-foreground">Nothing yet</span>
        </slot>
      </span>
      <Lock :class="['text-muted-foreground size-4 shrink-0', (multiline || $slots.default) && 'mt-1']" aria-hidden="true" />
      <span v-if="sheet" class="sr-only">. Shared from {{ sheet.mainName.value }}</span>
    </button>
  </div>
</template>
