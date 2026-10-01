<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/vue'
import { Plus, X } from '@lucide/vue'

// A small menu over an "Add…" button: suggestions to pick from, or type a
// new name. Arrow keys move, Enter picks, Escape closes.

export interface AddPopoverItem {
  key: string
  label: string
}

const props = withDefaults(
  defineProps<{
    anchor: HTMLElement | null
    open: boolean
    items: AddPopoverItem[]
    placeholder?: string
  }>(),
  { placeholder: 'Type a name…' },
)
const emit = defineEmits<{
  close: []
  select: [item: AddPopoverItem]
  add: [text: string]
}>()

const floatingEl = ref<HTMLElement | null>(null)
const { floatingStyles } = useFloating(
  computed(() => props.anchor),
  floatingEl,
  {
    placement: 'bottom-start',
    middleware: [
      offset(({ rects }) => -rects.reference.height),
      size({
        apply({ rects, elements }) {
          // As wide as the button, but never wider than the screen.
          elements.floating.style.minWidth = `min(${rects.reference.width}px, calc(100vw - 1rem))`
        },
      }),
      flip(),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  },
)

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
watch(
  () => props.open,
  (open) => {
    if (!open) return
    search.value = ''
    highlight.value = 0
  },
)
// Focus the field as soon as it's there.
watch(inputEl, (el) => el?.focus())

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
  if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key) || e.isComposing)
    return
  e.preventDefault()
  if (e.key === 'Escape') {
    emit('close')
    props.anchor?.focus()
  } else if (e.key === 'Enter') pick(highlight.value)
  else if (total.value)
    highlight.value =
      (highlight.value + (e.key === 'ArrowDown' ? 1 : -1) + total.value) % total.value
}
</script>

<template>
  <Teleport to="body">
    <template v-if="open">
      <div class="fixed inset-0 z-40" @click="emit('close')" />
      <div
        ref="floatingEl"
        class="bg-popover text-popover-foreground z-50 max-w-[calc(100vw-1rem)] min-w-56 overflow-hidden rounded-xl border shadow-lg"
        :style="floatingStyles"
      >
        <div class="flex items-center border-b">
          <input
            ref="inputEl"
            v-model="search"
            type="text"
            :placeholder="placeholder"
            :aria-label="placeholder"
            class="placeholder:text-muted-foreground h-11 min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
            @keydown.stop="onKeydown"
          />
          <button
            type="button"
            aria-label="Close"
            class="hover:bg-accent mr-1 flex size-7 shrink-0 items-center justify-center rounded-full"
            @click="emit('close')"
          >
            <X class="size-4" />
          </button>
        </div>
        <div class="max-h-64 overflow-y-auto p-1" role="listbox">
          <button
            v-for="(item, i) in filtered"
            :key="item.key"
            type="button"
            role="option"
            :aria-selected="highlight === i"
            :class="[
              'flex min-h-11 w-full items-center rounded-lg px-3 py-1.5 text-left text-base',
              highlight === i && 'bg-accent',
            ]"
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
            :class="[
              'flex min-h-11 w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-left text-base font-bold',
              highlight === filtered.length && 'bg-accent',
            ]"
            @click="onClick($event, filtered.length)"
            @mouseenter="highlight = filtered.length"
          >
            <Plus class="size-4" /> Add “{{ search.trim() }}”
          </button>
          <p v-if="!total" class="text-muted-foreground px-3 py-2.5 text-sm">
            Type a name to add one.
          </p>
        </div>
      </div>
    </template>
  </Teleport>
</template>
