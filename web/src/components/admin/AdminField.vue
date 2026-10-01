<script setup lang="ts">
// Label, hint and error around any control. The control gets `id` from the
// `for` prop so the label is clickable and read with it.
defineProps<{
  label: string
  for?: string
  hint?: string
  error?: string | null
  required?: boolean
  /** Visually hide the label (it's still read aloud). */
  hideLabel?: boolean
}>()
</script>

<template>
  <div class="space-y-1.5">
    <div v-if="!hideLabel" class="flex items-baseline justify-between gap-2">
      <label :for="$props.for" class="text-[0.9375rem] font-bold">
        {{ label }}<span v-if="required" class="text-muted-foreground font-semibold"> (required)</span>
      </label>
      <slot name="aside" />
    </div>
    <label v-else :for="$props.for" class="sr-only">{{ label }}</label>
    <slot />
    <p v-if="error" class="text-destructive text-sm font-semibold" role="alert">{{ error }}</p>
    <p v-else-if="hint" class="text-muted-foreground text-sm">{{ hint }}</p>
  </div>
</template>
