<script setup lang="ts">
import { useAutosave } from '@/composables/admin/useAutosave'

// One name of an entry's dancer (a first or a last name). In a Dancers card
// it's a box without its own border, the card around it being the field;
// `boxed`, it's a field of its own. With `save` it saves itself as TextField
// does (shortly after typing stops, on Enter, on leaving; Escape puts back the
// saved value); without, it's part of an add form. With `list`, it's a
// combobox over that list of names dancing here (DancersField).

const props = defineProps<{
  id: string
  modelValue: string
  /** Read aloud, and in "First name can’t be empty." */
  label: string
  placeholder?: string
  save?: (value: string) => unknown
  required?: boolean
  disabled?: boolean
  boxed?: boolean
  describedby?: string
  /** The suggestions' listbox, while it's open. */
  list?: string
  /** The highlighted suggestion's id. */
  active?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  error: [message: string | null]
  paste: [e: ClipboardEvent]
  keydown: [e: KeyboardEvent]
  /** What's in the box as it's typed, saved or not. */
  typed: [value: string]
}>()

const auto = useAutosave({
  value: () => props.modelValue,
  save: (v) => props.save?.(v),
  label: () => props.label,
  required: () => props.required,
  disabled: () => props.disabled,
})

function onInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  emit('typed', v)
  if (props.save) {
    auto.input(v)
    emit('error', null)
  } else emit('update:modelValue', v)
}
async function commit() {
  if (!props.save) return
  await auto.commit()
  emit('error', auto.error.value)
}
// A suggestion picked over what's typed: drop the draft, unsaved.
defineExpose({ revert: () => auto.revert() })

function onKeydown(e: KeyboardEvent) {
  emit('keydown', e)
  if (!props.save || e.defaultPrevented) return
  if (e.key === 'Escape' && auto.dirty.value) {
    e.preventDefault()
    e.stopPropagation()
    auto.revert()
    emit('error', null)
  } else if (e.key === 'Enter' && !e.isComposing) {
    e.preventDefault()
    void commit()
  }
}
</script>

<template>
  <input
    :id="id"
    :value="save ? auto.draft.value : modelValue"
    :aria-label="boxed ? undefined : label"
    :aria-describedby="describedby"
    :aria-required="required || undefined"
    :role="list !== undefined ? 'combobox' : undefined"
    :aria-autocomplete="list !== undefined ? 'list' : undefined"
    :aria-expanded="list !== undefined ? !!list : undefined"
    :aria-controls="list || undefined"
    :aria-activedescendant="active"
    :placeholder="placeholder"
    :disabled="disabled || auto.locked.value"
    autocomplete="off"
    autocapitalize="words"
    spellcheck="false"
    enterkeyhint="next"
    :class="[
      'placeholder:text-muted-foreground h-12 w-full min-w-0 px-3 text-base disabled:cursor-not-allowed',
      boxed ? 'field rounded-xl' : 'bg-transparent outline-none',
    ]"
    @input="onInput"
    @blur="commit"
    @keydown="onKeydown"
    @paste="(e) => emit('paste', e)"
  />
</template>
