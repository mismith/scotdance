<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { Ellipsis, Eye, Redo2, Undo2 } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'

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

const button = ref<HTMLButtonElement | null>(null)
const open = ref(false)
function show() {
  // Line the menu's right edge up with the button.
  const r = button.value?.getBoundingClientRect()
  if (r) document.documentElement.style.setProperty('--dropdown-right', `${Math.max(12, window.innerWidth - r.right)}px`)
  open.value = true
}
function pick(what: 'undo' | 'redo') {
  open.value = false
  if (what === 'undo') emit('undo')
  else emit('redo')
}

const row =
  'flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-base font-bold hover:bg-accent focus-visible:-outline-offset-2 disabled:opacity-45 disabled:hover:bg-transparent'
</script>

<template>
  <button
    ref="button"
    type="button"
    aria-label="Undo, redo and more"
    aria-haspopup="dialog"
    :aria-expanded="open"
    class="hover:bg-accent flex size-9 items-center justify-center rounded-full"
    @click="show"
  >
    <Ellipsis class="size-5" />
  </button>

  <Dialog :open="open" variant="dropdown" aria-label="Undo, redo and more" @close="open = false">
    <nav aria-label="Undo, redo and more" class="divide-y">
      <div class="py-1">
        <button
          type="button"
          :class="row"
          :disabled="!props.canUndo || props.busy"
          :aria-label="props.undoLabel ? `Undo: ${props.undoLabel}` : 'Undo'"
          @click="pick('undo')"
        >
          <Undo2 class="text-primary size-5 shrink-0" />
          <span class="min-w-0 flex-1">
            <span class="block">Undo</span>
            <span class="text-muted-foreground block truncate text-sm font-medium">{{ props.undoLabel ?? 'Nothing to undo' }}</span>
          </span>
          <kbd class="text-muted-foreground font-sans text-sm font-semibold max-md:hidden">{{ props.undoKey }}</kbd>
        </button>
        <button
          type="button"
          :class="row"
          :disabled="!props.canRedo || props.busy"
          :aria-label="props.redoLabel ? `Redo: ${props.redoLabel}` : 'Redo'"
          @click="pick('redo')"
        >
          <Redo2 class="text-primary size-5 shrink-0" />
          <span class="min-w-0 flex-1">
            <span class="block">Redo</span>
            <span class="text-muted-foreground block truncate text-sm font-medium">{{ props.redoLabel ?? 'Nothing to redo' }}</span>
          </span>
          <kbd class="text-muted-foreground font-sans text-sm font-semibold max-md:hidden">{{ props.redoKey }}</kbd>
        </button>
      </div>
      <div class="py-1">
        <RouterLink :to="props.view" :class="row" @click="open = false">
          <Eye class="text-primary size-5 shrink-0" /> View the public page
        </RouterLink>
      </div>
    </nav>
  </Dialog>
</template>
