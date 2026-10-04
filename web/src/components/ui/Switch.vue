<script setup lang="ts">
import { selectionHaptic } from '@/lib/haptics'

// The one switch: an iOS-sized track with a thumb that springs across. Use
// it bare (with an aria-label or aria-labelledby), or wrap it in a label row.
// Only for settings that take effect at once; anything that asks first is a
// button, not a switch.
const model = defineModel<boolean>({ required: true })
const props = defineProps<{ disabled?: boolean; busy?: boolean }>()

function toggle() {
  if (props.disabled || props.busy) return
  model.value = !model.value
  selectionHaptic()
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="model"
    :disabled="disabled"
    :aria-busy="busy || undefined"
    :class="[
      'relative inline-flex h-[1.875rem] w-[3.125rem] shrink-0 items-center rounded-full p-0.5 transition-colors duration-(--dur-quick)',
      'disabled:opacity-(--disabled-opacity)',
      // High contrast mode drops the fills: draw it in system colours instead.
      'forced-colors:outline-1 forced-colors:-outline-offset-1 forced-colors:outline-[ButtonText] forced-colors:outline forced-color-adjust-none',
      // Off keeps an edge, like a field's, so the track shows (3:1).
      model
        ? 'bg-primary-fill forced-colors:bg-[Highlight]'
        : 'bg-[color-mix(in_oklab,var(--foreground)_16%,transparent)] shadow-[inset_0_0_0_1px_var(--input)] forced-colors:bg-[Canvas]',
      busy && 'opacity-70',
    ]"
    @click="toggle"
  >
    <span
      :class="[
        'block size-[1.625rem] rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25),0_0_0_0.5px_rgb(0_0_0/0.06)]',
        'transition-[translate,width] duration-(--dur-slow) ease-elastic motion-reduce:transition-none',
        model ? 'translate-x-5 forced-colors:bg-[HighlightText]' : 'translate-x-0 forced-colors:bg-[ButtonText]',
      ]"
      aria-hidden="true"
    />
  </button>
</template>
