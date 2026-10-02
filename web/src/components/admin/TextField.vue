<script setup lang="ts">
import { computed, useId } from 'vue'
import AdminField from '@/components/admin/AdminField.vue'
import SaveMark from '@/components/admin/SaveMark.vue'
import { useAutosave } from '@/composables/admin/useAutosave'
import { LINK_PROBLEM, looksLikeLink } from '@/lib/admin/collection'

// A text box that saves itself: shortly after typing stops, on Enter, and
// when focus leaves. Escape puts back the saved value. While the database
// changes underneath (another device), the box follows it unless you're
// mid-edit.

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null | undefined
    label: string
    save: (value: string) => unknown
    hint?: string
    type?: 'text' | 'number' | 'date' | 'datetime-local' | 'url' | 'email' | 'tel'
    multiline?: boolean
    rows?: number
    required?: boolean
    placeholder?: string
    autocomplete?: string
    inputmode?: 'text' | 'numeric' | 'decimal' | 'url' | 'email' | 'tel' | 'search' | 'none'
    validate?: (value: string) => string | null
    disabled?: boolean
    hideLabel?: boolean
    autofocus?: boolean
  }>(),
  { type: 'text', rows: 4 },
)

const id = useId()

const { draft, dirty, status, error, locked, input, commit, revert } = useAutosave({
  value: () => props.modelValue,
  save: (v) => props.save(v),
  label: () => props.label,
  required: () => props.required,
  validate: (v) => props.validate?.(v) ?? (props.type === 'url' && v && !looksLikeLink(v) ? LINK_PROBLEM : null),
  disabled: () => props.disabled,
})

function onInput(e: Event) {
  input((e.target as HTMLInputElement | HTMLTextAreaElement).value)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && dirty.value) {
    e.preventDefault()
    e.stopPropagation()
    revert()
  } else if (e.key === 'Enter' && !props.multiline && !e.isComposing) {
    e.preventDefault()
    void commit()
  }
}

const inputClass = computed(() => [
  'w-full rounded-xl px-3 text-base',
  locked.value ? 'bg-muted text-muted-foreground cursor-not-allowed shadow-[inset_0_0_0_1px_var(--border)]' : 'field',
  props.multiline ? 'min-h-24 py-2.5 leading-normal' : 'h-12 pr-10',
])
</script>

<template>
  <AdminField :label="label" :for="id" :hint="hint" :error="error" :required="required" :hide-label="hideLabel">
    <div class="relative">
      <textarea
        v-if="multiline"
        :id="id"
        :value="draft"
        :rows="rows"
        :placeholder="placeholder"
        :disabled="locked"
        :aria-invalid="!!error || undefined"
        :class="inputClass"
        @input="onInput"
        @blur="commit"
        @keydown="onKeydown"
      />
      <input
        v-else
        :id="id"
        :value="draft"
        :type="type"
        :placeholder="placeholder"
        :autocomplete="autocomplete ?? 'off'"
        :inputmode="inputmode"
        :disabled="locked"
        :autofocus="autofocus"
        :aria-invalid="!!error || undefined"
        :class="inputClass"
        @input="onInput"
        @change="type === 'date' || type === 'datetime-local' ? commit() : undefined"
        @blur="commit"
        @keydown="onKeydown"
      />
      <span
        v-if="!multiline"
        class="text-muted-foreground pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2"
        aria-hidden="true"
      >
        <SaveMark :status="status" />
      </span>
    </div>
  </AdminField>
</template>
