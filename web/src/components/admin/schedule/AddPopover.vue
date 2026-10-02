<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Plus } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import type { Morph } from '@/lib/morph'

// A small menu that grows out of an "Add…" button: suggestions to pick from,
// or type a new name. Arrow keys move, Enter picks, Escape closes. The button
// opens it with `morph.toggle($event)`.

export interface AddPopoverItem {
  key: string
  label: string
}

const props = withDefaults(
  defineProps<{
    morph: Morph
    items: AddPopoverItem[]
    placeholder?: string
  }>(),
  { placeholder: 'Type a name…' },
)
const emit = defineEmits<{
  select: [item: AddPopoverItem]
  add: [text: string]
}>()

const search = ref('')
const highlight = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? props.items.filter((i) => i.label.toLowerCase().includes(q)) : props.items
})
const canAdd = computed(
  () =>
    search.value.trim().length > 0 &&
    !filtered.value.some(
      (i) => i.label.toLowerCase() === search.value.trim().toLowerCase(),
    ),
)
const total = computed(() => filtered.value.length + (canAdd.value ? 1 : 0))

watch(search, () => (highlight.value = 0))
// Fresh each time, with the keyboard in the field (after the dialog takes focus).
watch(
  () => props.morph.open,
  async (open) => {
    if (!open) return
    search.value = ''
    highlight.value = 0
    await nextTick()
    inputEl.value?.focus()
  },
  { flush: 'post' },
)

// Stays open after picking, to add a few in a row. The list changes under
// the pointer as it does, so the second click of a double click is ignored
// (it would add whatever moved up under it).
function onClick(e: MouseEvent, i: number) {
  if (e.detail < 2) pick(i)
}
function pick(i: number) {
  if (i < filtered.value.length) emit('select', filtered.value[i])
  else if (canAdd.value) emit('add', search.value.trim())
  search.value = ''
  inputEl.value?.focus()
}

function onKeydown(e: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key) || e.isComposing) return
  e.preventDefault()
  if (e.key === 'Enter') pick(highlight.value)
  else if (total.value)
    highlight.value =
      (highlight.value + (e.key === 'ArrowDown' ? 1 : -1) + total.value) % total.value
}

const row = 'press-row flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-base font-medium'
</script>

<template>
  <Dialog :open="morph.open" :morph="morph" variant="dropdown" :aria-label="placeholder" @close="morph.hide()">
    <input
      ref="inputEl"
      v-model="search"
      type="text"
      :placeholder="placeholder"
      :aria-label="placeholder"
      class="field h-11 w-full rounded-xl px-3 text-base"
      @keydown.stop="onKeydown"
    />
    <div class="mt-1.5 max-h-64 overflow-y-auto" role="listbox" :aria-label="placeholder">
      <button
        v-for="(item, i) in filtered"
        :key="item.key"
        type="button"
        role="option"
        :aria-selected="highlight === i"
        :class="[row, highlight === i && '[--row-tint:var(--tint-hover)]']"
        @click="onClick($event, i)"
        @mouseenter="highlight = i"
      >
        {{ item.label }}
      </button>
      <button
        v-if="canAdd"
        type="button"
        role="option"
        :aria-selected="highlight === filtered.length"
        :class="[row, 'text-primary', highlight === filtered.length && '[--row-tint:var(--tint-hover)]']"
        @click="onClick($event, filtered.length)"
        @mouseenter="highlight = filtered.length"
      >
        <Plus class="size-5 shrink-0" /> Add “{{ search.trim() }}”
      </button>
      <p v-if="!total" class="text-muted-foreground px-3 py-2.5 text-sm">
        Type a name to add one.
      </p>
    </div>
  </Dialog>
</template>
