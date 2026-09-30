<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue'
import { ChevronDown } from '@lucide/vue'
import Popover from '@/components/Popover.vue'
import { useExpandedPill } from '@/composables/useExpandedPill'
import { injectPillRow } from '@/composables/usePillRow'

const props = defineProps<{
  id: string
  ariaLabel?: string
  /** Show a small accent dot on the compact button to signal that this
   *  pill is narrowing results from a "show everything" baseline. */
  active?: boolean
}>()

const emit = defineEmits<{
  (e: 'open'): void
  (e: 'close'): void
}>()

const { isOpen, anyOpen, open, close, toggle } = useExpandedPill(props.id)

const compactRef = useTemplateRef<HTMLElement>('compact')
const rowRef = injectPillRow()

// Popover anchors to the row so the overlay spans the full row width
// (minus the X area), and morphs out of the compact pill's footprint.
const anchorEl = computed<HTMLElement | null>(() => rowRef?.value ?? null)
const morphEl = computed<HTMLElement | null>(() => compactRef.value)

watch(isOpen, (v) => {
  if (v) emit('open')
  else emit('close')
})

defineExpose({ open, close })
</script>

<template>
  <Popover
    :open="isOpen"
    :anchor="anchorEl"
    :morph-from="morphEl"
    overlap
    match-anchor-width
    :width-offset-px="56"
    closable
    @update:open="(v) => (v ? open() : close())"
  >
    <template #trigger>
      <button
        ref="compact"
        v-tap-feedback
        type="button"
        :class="[
          'bg-card hover:bg-accent pointer-events-auto relative inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-full border px-4 font-sans text-[0.9375rem] font-bold whitespace-nowrap shadow-sm transition-colors',
          anyOpen ? 'pointer-events-none opacity-0' : '',
        ]"
        :aria-label="ariaLabel"
        :aria-expanded="isOpen"
        @click="toggle"
      >
        <slot name="compact" />
        <ChevronDown class="text-muted-foreground -mr-1 size-4 shrink-0" aria-hidden="true" />
      </button>
    </template>

    <template #default="{ close: closePopover }">
      <div class="min-h-12 w-full overflow-x-auto">
        <slot name="expanded" :close="closePopover" />
      </div>
    </template>
  </Popover>
</template>
