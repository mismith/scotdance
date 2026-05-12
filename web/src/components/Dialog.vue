<script setup lang="ts">
import { nextTick, onMounted, ref, useSlots, watch } from 'vue'
import { X } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    variant?: 'center' | 'sheet'
    size?: 'sm' | 'md'
    closable?: boolean
  }>(),
  { variant: 'center', size: 'sm', closable: true },
)

const emit = defineEmits<{ close: [] }>()
const slots = useSlots()

const dialogRef = ref<HTMLDialogElement | null>(null)

function sync(open: boolean) {
  const el = dialogRef.value
  if (!el) return
  if (open && !el.open) el.showModal()
  else if (!open && el.open) el.close()
}

watch(
  () => props.open,
  (open) => {
    nextTick(() => sync(open))
  },
)

onMounted(() => {
  if (props.open) sync(true)
})

function onBackdropClick(e: MouseEvent) {
  if (e.target === dialogRef.value) emit('close')
}
</script>

<template>
  <dialog
    ref="dialogRef"
    :inert="!open"
    :class="[
      // Reset native dialog defaults.
      'bg-background max-h-full max-w-full border-0 p-0 text-inherit',
      // Width by size prop.
      size === 'sm' ? 'w-full md:max-w-sm' : 'w-full md:max-w-md',
      // Layout per variant.
      variant === 'center' &&
        'fixed inset-x-0 top-(--chrome-top) bottom-(--chrome-bottom) m-auto h-fit rounded-3xl p-6 shadow-lg max-h-[calc(100svh-var(--chrome-top)-var(--chrome-bottom)-2rem)] max-md:max-w-[calc(100vw-2rem)]',
      variant === 'sheet' && [
        'flex flex-col shadow-lg',
        // Mobile: pinned to bottom, full-bleed, top-rounded, overflow-visible
        // so the ::after bg extension can paint below the dialog box.
        'max-md:fixed max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:m-0 max-md:max-h-[calc(100svh-3rem)] max-md:rounded-t-3xl max-md:overflow-visible',
        // Mobile: visual-only background extension below the sheet so the
        // rubber-band overshoot doesn't expose the backdrop underneath.
        'max-md:after:pointer-events-none max-md:after:absolute max-md:after:inset-x-0 max-md:after:top-full max-md:after:h-32 max-md:after:bg-background',
        // Desktop: match center (chrome-aware centered card).
        'md:fixed md:inset-x-0 md:top-(--chrome-top) md:bottom-(--chrome-bottom) md:m-auto md:h-fit md:max-h-[calc(100vh-var(--chrome-top)-var(--chrome-bottom)-2rem)] md:rounded-3xl',
      ],
      // Closed (resting) state — also the exit target.
      'opacity-0',
      variant === 'center' && 'scale-95',
      variant === 'sheet' && 'max-md:translate-y-full md:scale-95',
      // Open state.
      'open:opacity-100',
      variant === 'center' && 'open:scale-100',
      variant === 'sheet' && 'max-md:open:translate-y-0 md:open:scale-100',
      // Entry from-state via @starting-style.
      'starting:open:opacity-0',
      variant === 'center' && 'starting:open:scale-95',
      variant === 'sheet' &&
        'max-md:starting:open:translate-y-full md:starting:open:scale-95',
      // Transition — explicit property list incl. display so transition-discrete
      // can defer display:none until the visible properties finish animating.
      'ease-rubber-band transition-[opacity,translate,scale,display] transition-discrete',
      // Backdrop.
      'backdrop:bg-black/50 backdrop:opacity-0 open:backdrop:opacity-100 starting:open:backdrop:opacity-0',
      'backdrop:transition-opacity',
      'motion-reduce:transition-none motion-reduce:backdrop:transition-none',
    ]"
    @click="onBackdropClick"
  >
    <header
      v-if="variant === 'sheet' && slots.header"
      class="flex items-start gap-3 border-b p-4 pr-2"
    >
      <div class="min-w-0 flex-1 space-y-1">
        <slot name="header" />
      </div>
      <button
        v-if="closable"
        type="button"
        title="Close"
        class="hover:bg-accent text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-full"
        @click="emit('close')"
      >
        <X class="size-4" />
      </button>
    </header>

    <button
      v-if="closable && !(variant === 'sheet' && slots.header)"
      type="button"
      title="Close"
      class="hover:bg-accent text-muted-foreground absolute top-2 right-2 z-10 flex size-11 items-center justify-center rounded-full"
      @click="emit('close')"
    >
      <X class="size-4" />
    </button>

    <div v-if="variant === 'sheet'" class="overflow-y-auto">
      <slot />
    </div>
    <div v-else class="space-y-4">
      <slot />
    </div>
  </dialog>
</template>

<style>
/* Lock background scroll while any native <dialog> is open. showModal()
   handles focus trap + inertness, but not scroll — this fills the gap. */
html:has(dialog[open]) {
  overflow: hidden;
}

</style>
