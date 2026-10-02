<script setup lang="ts">
// The one checkbox look: a soft square that fills blue and draws its tick.
// Visual only by default (a row that's role="checkbox" owns the state and
// the click); pass `as="button"` to make it the control itself.
const props = withDefaults(defineProps<{ checked: boolean; as?: 'span' | 'button'; disabled?: boolean }>(), { as: 'span' })
const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <component
    :is="props.as"
    :type="props.as === 'button' ? 'button' : undefined"
    :role="props.as === 'button' ? 'checkbox' : undefined"
    :aria-checked="props.as === 'button' ? props.checked : undefined"
    :aria-hidden="props.as === 'span' ? 'true' : undefined"
    :disabled="props.as === 'button' ? props.disabled : undefined"
    :class="[
      'inline-flex size-[1.375rem] shrink-0 items-center justify-center rounded-[0.4375rem] transition-[background-color,box-shadow] duration-(--dur-quick)',
      props.checked
        ? 'bg-primary-fill text-primary-foreground'
        : 'bg-card shadow-[inset_0_0_0_1.5px_var(--input)]',
    ]"
    @click="props.as === 'button' && emit('toggle')"
  >
    <svg viewBox="0 0 16 16" class="size-3.5" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        stroke-width="2.25"
        stroke-linecap="round"
        stroke-linejoin="round"
        pathLength="1"
        :class="[
          '[stroke-dasharray:1] transition-[stroke-dashoffset] duration-(--dur-base) ease-standard motion-reduce:transition-none',
          props.checked ? '[stroke-dashoffset:0]' : '[stroke-dashoffset:1]',
        ]"
      />
    </svg>
  </component>
</template>
