<script setup lang="ts">
import { Ellipsis } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import { useMorph } from '@/lib/morph'

// A section's ⋯ menu, top right of its header, for what's rarely needed
// there. It grows out of its button and hangs under it; items get `row` for
// their look and call `close` when chosen.

defineProps<{ label: string }>()

// The one menu anatomy: inset rounded rows, medium labels, muted icons.
const ROW =
  'press-row focus-inset flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-base font-medium disabled:opacity-(--disabled-opacity) [&:not(.text-destructive)>svg]:text-muted-foreground [&>svg]:size-5 [&>svg]:shrink-0'

const menu = useMorph()
const close = () => void menu.hide()
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    aria-haspopup="dialog"
    :aria-expanded="menu.open"
    class="press text-muted-foreground hover:text-foreground flex size-11 shrink-0 items-center justify-center rounded-full"
    @click="menu.show($event)"
  >
    <Ellipsis class="size-5" />
  </button>
  <Dialog :open="menu.open" :morph="menu" variant="dropdown" :aria-label="label" @close="close">
    <nav :aria-label="label">
      <slot :row="ROW" :close="close" />
    </nav>
  </Dialog>
</template>
