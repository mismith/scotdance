<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { Ellipsis, Eye, Redo2, Undo2 } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import { useMorph } from '@/lib/morph'

// Manage's ⋯ menu, top right beside your account: Undo and Redo (saying
// what they'd change), and the public page. ⌘Z and ⇧⌘Z still work anywhere.
const props = defineProps<{
  undoLabel: string | null
  redoLabel: string | null
  canUndo: boolean
  canRedo: boolean
  busy: boolean
  undoKey: string
  redoKey: string
  view: RouteLocationRaw
}>()
const emit = defineEmits<{ undo: []; redo: [] }>()

const menu = useMorph()
function pick(what: 'undo' | 'redo') {
  void menu.hide()
  if (what === 'undo') emit('undo')
  else emit('redo')
}

// The one menu anatomy: inset rounded rows, medium labels, muted icons.
const row =
  'press-row focus-inset flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-base font-medium disabled:opacity-(--disabled-opacity) [&>svg]:text-muted-foreground [&>svg]:size-5 [&>svg]:shrink-0'
</script>

<template>
  <button
    type="button"
    aria-label="Undo, redo and more"
    aria-haspopup="dialog"
    :aria-expanded="menu.open"
    class="press flex size-9 items-center justify-center rounded-full"
    @click="menu.show($event)"
  >
    <Ellipsis class="size-5" />
  </button>

  <Dialog :open="menu.open" :morph="menu" variant="dropdown" aria-label="Undo, redo and more" @close="menu.hide()">
    <nav aria-label="Undo, redo and more" class="[&>div+div]:mt-1.5 [&>div+div]:border-t [&>div+div]:pt-1.5">
      <div>
        <button
          type="button"
          :class="row"
          :disabled="!props.canUndo || props.busy"
          :aria-label="props.undoLabel ? `Undo: ${props.undoLabel}` : 'Undo'"
          @click="pick('undo')"
        >
          <Undo2 />
          <span class="min-w-0 flex-1">
            <span class="block">Undo</span>
            <span class="text-muted-foreground block truncate text-sm font-normal">{{ props.undoLabel ?? 'Nothing to undo' }}</span>
          </span>
          <kbd class="text-muted-foreground font-sans text-sm max-md:hidden">{{ props.undoKey }}</kbd>
        </button>
        <button
          type="button"
          :class="row"
          :disabled="!props.canRedo || props.busy"
          :aria-label="props.redoLabel ? `Redo: ${props.redoLabel}` : 'Redo'"
          @click="pick('redo')"
        >
          <Redo2 />
          <span class="min-w-0 flex-1">
            <span class="block">Redo</span>
            <span class="text-muted-foreground block truncate text-sm font-normal">{{ props.redoLabel ?? 'Nothing to redo' }}</span>
          </span>
          <kbd class="text-muted-foreground font-sans text-sm max-md:hidden">{{ props.redoKey }}</kbd>
        </button>
      </div>
      <div>
        <RouterLink :to="props.view" :class="row" @click="menu.dismiss()">
          <Eye /> View the public page
        </RouterLink>
      </div>
    </nav>
  </Dialog>
</template>
