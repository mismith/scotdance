<script setup lang="ts">
import { ref } from 'vue'
import { Ellipsis } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'

// A section's ⋯ menu, top right of its header, for what's rarely needed
// there. It opens under its button; items get `row` for their look and
// call `close` when chosen.

defineProps<{ label: string }>()

const ROW =
  'flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-base font-bold hover:bg-accent focus-visible:-outline-offset-2 disabled:opacity-45 disabled:hover:bg-transparent'

const button = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const place = ref<Record<string, string>>({})
function show() {
  const r = button.value?.getBoundingClientRect()
  if (r) place.value = { top: `${r.bottom + 4}px`, right: `${Math.max(12, window.innerWidth - r.right)}px` }
  open.value = true
}
const close = () => (open.value = false)
</script>

<template>
  <button
    ref="button"
    type="button"
    :aria-label="label"
    aria-haspopup="dialog"
    :aria-expanded="open"
    class="text-muted-foreground hover:text-foreground hover:bg-accent flex size-11 shrink-0 items-center justify-center rounded-full"
    @click="show"
  >
    <Ellipsis class="size-5" />
  </button>
  <Dialog :open="open" variant="dropdown" :aria-label="label" :style="place" @close="close">
    <nav :aria-label="label" class="py-1">
      <slot :row="ROW" :close="close" />
    </nav>
  </Dialog>
</template>
