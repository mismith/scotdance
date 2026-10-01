<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { Check, LoaderCircle } from '@lucide/vue'
import AdminField from '@/components/admin/AdminField.vue'
import { canEdit, friendlyError } from '@/lib/admin/write'

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
const asText = (v: unknown) => (v == null ? '' : String(v))

const draft = ref(asText(props.modelValue))
const dirty = ref(false)
const status = ref<'idle' | 'saving' | 'saved'>('idle')
const error = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
let savedTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.modelValue,
  (v) => {
    if (!dirty.value) draft.value = asText(v)
  },
)

const locked = computed(() => props.disabled || !canEdit.value)

function onInput(e: Event) {
  draft.value = (e.target as HTMLInputElement | HTMLTextAreaElement).value
  dirty.value = true
  error.value = null
  clearTimeout(timer)
  timer = setTimeout(commit, 900)
}

async function commit() {
  clearTimeout(timer)
  if (!dirty.value) return
  const value = draft.value.trim()
  if (props.required && !value) {
    error.value = `${props.label} can’t be empty.`
    return
  }
  const invalid = props.validate?.(value)
  if (invalid) {
    error.value = invalid
    return
  }
  if (value === asText(props.modelValue).trim()) {
    dirty.value = false
    return
  }
  status.value = 'saving'
  try {
    await props.save(value)
    dirty.value = false
    draft.value = value
    status.value = 'saved'
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => (status.value = 'idle'), 1600)
  } catch (e) {
    status.value = 'idle'
    error.value = friendlyError(e)
  }
}

function revert() {
  clearTimeout(timer)
  draft.value = asText(props.modelValue)
  dirty.value = false
  error.value = null
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

// Leaving the page mid-edit still saves.
onBeforeUnmount(() => {
  if (dirty.value) void commit()
  clearTimeout(savedTimer)
})

const inputClass = computed(() => [
  'bg-card w-full rounded-xl border-2 px-3 text-base outline-none transition-colors',
  error.value ? 'border-destructive' : 'border-strong focus:border-primary',
  locked.value && 'bg-muted text-muted-foreground cursor-not-allowed',
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
        class="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
        aria-hidden="true"
      >
        <LoaderCircle v-if="status === 'saving'" class="size-4 animate-spin" />
        <Check v-else-if="status === 'saved'" class="text-done-foreground size-4" />
      </span>
    </div>
  </AdminField>
</template>
