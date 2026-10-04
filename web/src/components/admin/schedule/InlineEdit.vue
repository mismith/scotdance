<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { htmlToText } from '@/lib/admin/richText'

// Text that becomes a field when clicked (or Enter on it). Saves on Enter or
// leaving the field; Escape cancels. Multiline saves on leaving, or ⌘/Ctrl+Enter.
// A dotted underline says it can be changed: on hover with a mouse and, for
// names, always on a touch screen, which has no hover.

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    autoEdit?: boolean
    required?: boolean
    multiline?: boolean
    readonly?: boolean
    label?: string
  }>(),
  {
    placeholder: '',
    autoEdit: false,
    required: true,
    multiline: false,
    readonly: false,
    label: undefined,
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// Notes are shown and edited as plain text, even where the old app stored HTML.
const text = computed(() => (props.multiline ? htmlToText(props.modelValue) : props.modelValue))

const editing = ref(false)
const draft = ref('')
const inputEl = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
const displayEl = ref<HTMLElement | null>(null)

async function startEdit() {
  if (props.readonly) return
  draft.value = text.value
  editing.value = true
  await nextTick()
  inputEl.value?.focus()
  inputEl.value?.select()
}

function finish(save: boolean) {
  if (!editing.value) return
  editing.value = false
  const value = draft.value.trim()
  if (save && !(props.required && !value) && value !== text.value)
    emit('update:modelValue', value)
  void nextTick(() => displayEl.value?.focus())
}

function onKeydown(e: KeyboardEvent) {
  e.stopPropagation()
  if (e.key === 'Escape') finish(false)
  else if (e.key === 'Enter' && (!props.multiline || e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    finish(true)
  }
}

onMounted(() => {
  if (props.autoEdit) void startEdit()
})
defineExpose({ startEdit })
</script>

<template>
  <span
    v-if="readonly"
    :class="[!text && 'opacity-50', multiline && 'whitespace-pre-wrap']"
    >{{ text || placeholder }}</span
  >
  <component
    :is="multiline ? 'textarea' : 'input'"
    v-else-if="editing"
    ref="inputEl"
    :value="draft"
    :placeholder="placeholder"
    :aria-label="label ?? placeholder"
    :rows="multiline ? 1 : undefined"
    class="bg-card text-foreground ring-ring m-0 field-sizing-content max-w-full rounded p-0 font-[inherit] leading-[inherit] ring-2 outline-none"
    :class="multiline ? 'block w-full resize-none' : 'inline-block'"
    @input="draft = ($event.target as HTMLInputElement).value"
    @pointerdown.stop
    @keydown="onKeydown"
    @blur="finish(true)"
  />
  <span
    v-else
    ref="displayEl"
    tabindex="0"
    role="button"
    :aria-label="label ? `${label}: ${text || placeholder}` : undefined"
    :class="[
      'decoration-foreground/40 focus-visible:ring-ring cursor-text rounded-sm underline-offset-2 outline-none hover:underline hover:decoration-dotted focus-visible:ring-2',
      !text && 'opacity-50',
      multiline ? 'whitespace-pre-wrap' : 'pointer-coarse:underline pointer-coarse:decoration-dotted',
    ]"
    @click.stop="startEdit"
    @pointerdown.stop
    @keydown.enter.prevent.stop="startEdit"
    @keydown.space.prevent.stop="startEdit"
    >{{ text || placeholder }}</span
  >
</template>
