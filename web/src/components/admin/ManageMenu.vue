<script setup lang="ts">
import { Check, CircleAlert, CloudOff, History, LoaderCircle, Redo2, Undo2 } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import { useSaveStatus } from '@/composables/admin/useSaveStatus'
import { useMorph } from '@/lib/morph'

// Manage's undo menu, top right beside View: Undo and Redo (saying what
// they'd change; ⌘Z and ⇧⌘Z still work anywhere). Its button also says
// whether your changes are safe, in words, when there's something to say:
// "Saved" for a moment after each save, Saving…, Offline or Not saved;
// otherwise it's just the history icon (composables/admin/useSaveStatus).
// Not ⋯: that's each section's own menu, often right below it.
const props = defineProps<{
  undoLabel: string | null
  redoLabel: string | null
  canUndo: boolean
  canRedo: boolean
  busy: boolean
  undoKey: string
  redoKey: string
}>()
const emit = defineEmits<{ undo: []; redo: [] }>()

const menu = useMorph()
const save = useSaveStatus()
const SAVE_NOTE = {
  saved: 'Changes save as you go.',
  saving: 'Saving your changes…',
  offline: 'You’re offline. Changes can’t be saved until you’re back online.',
  error: 'Your last change wasn’t saved. Try it again.',
}
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
    aria-label="Undo and redo"
    aria-haspopup="dialog"
    :aria-expanded="menu.open"
    :title="save.state.value === 'error' ? (save.error.value ?? undefined) : undefined"
    :class="[
      'press flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-semibold whitespace-nowrap transition-colors',
      !save.shown.value
        ? ''
        : save.state.value === 'offline' || save.state.value === 'error'
          ? 'bg-destructive/10 text-destructive'
          : save.state.value === 'saved'
            ? 'text-done-foreground'
            : 'text-muted-foreground',
    ]"
    @click="menu.show($event)"
  >
    <span class="grid size-5 shrink-0 place-items-center" aria-hidden="true">
      <History v-if="!save.shown.value" class="size-5" />
      <CloudOff v-else-if="save.state.value === 'offline'" class="size-4" />
      <LoaderCircle v-else-if="save.state.value === 'saving'" class="size-4 animate-spin" />
      <CircleAlert v-else-if="save.state.value === 'error'" class="size-4" />
      <Check v-else class="size-4" stroke-width="2.75" />
    </span>
    <!-- The words open out beside it and fold away again. -->
    <span
      :class="[
        'grid transition-[grid-template-columns,opacity] duration-(--dur-base) ease-snappy motion-reduce:transition-opacity',
        save.shown.value ? 'grid-cols-[1fr] opacity-100' : 'grid-cols-[0fr] opacity-0',
      ]"
      aria-hidden="true"
    >
      <span class="min-w-0 overflow-hidden pr-1 pl-1">{{ save.label.value }}</span>
    </span>
  </button>
  <span role="status" aria-live="polite" class="sr-only">{{ save.label.value }}</span>

  <Dialog :open="menu.open" :morph="menu" variant="dropdown" aria-label="Undo and redo" @close="menu.hide()">
    <nav aria-label="Undo and redo" class="[&>div+div]:mt-1.5 [&>div+div]:border-t [&>div+div]:pt-1.5">
      <div>
        <p
          :class="[
            'text-callout flex items-start gap-2 px-3 pt-1.5 pb-2 font-medium',
            save.state.value === 'offline' || save.state.value === 'error' ? 'text-destructive' : 'text-muted-foreground',
          ]"
        >
          {{ SAVE_NOTE[save.state.value] }}
        </p>
      </div>
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
    </nav>
  </Dialog>
</template>
