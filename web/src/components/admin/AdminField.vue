<script setup lang="ts">
import { computed, useId } from 'vue'

// Label, hint and error around any control. The control gets `id` from the
// `for` prop so the label is clickable and read with it, and binds the slot's
// `describedby` so the hint or error is read after it. A required control
// says so itself (aria-required), so "(required)" is only for the eye.
const props = defineProps<{
  label: string
  for?: string
  hint?: string
  error?: string | null
  required?: boolean
  /** Visually hide the label (it's still read aloud). */
  hideLabel?: boolean
}>()

defineSlots<{ default?: (props: { describedby: string | undefined }) => unknown; aside?: () => unknown }>()

const uid = useId()
// One id for whichever shows: the error replaces the hint.
const noteId = computed(() => `${props.for ?? uid}-note`)
const describedby = computed(() => (props.error || props.hint ? noteId.value : undefined))
</script>

<template>
  <div class="space-y-1.5">
    <div v-if="!hideLabel" class="flex items-baseline justify-between gap-2">
      <label :for="$props.for" class="text-callout font-medium">
        {{ label }}<span v-if="required" class="text-muted-foreground font-normal" aria-hidden="true"> (required)</span>
      </label>
      <slot name="aside" />
    </div>
    <label v-else :for="$props.for" class="sr-only">{{ label }}</label>
    <slot :describedby="describedby" />
    <p v-if="error" :id="noteId" class="text-destructive text-sm font-medium" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="noteId" class="text-muted-foreground text-sm">{{ hint }}</p>
  </div>
</template>
