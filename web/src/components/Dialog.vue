<script setup lang="ts">
import { computed, onMounted, ref, useSlots, watch } from 'vue'
import { X } from '@lucide/vue'
import { morphSupported, type Morph } from '@/lib/morph'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** sheet: slides up on phones. menu: a small panel above the tab bar's right end. */
    variant?: 'center' | 'sheet' | 'menu'
    size?: 'sm' | 'md'
    closable?: boolean
    /** Grow out of (and shrink back into) whatever opened it. See lib/morph. */
    morph?: Morph
  }>(),
  { variant: 'center', size: 'sm', closable: true, morph: undefined },
)

const emit = defineEmits<{ close: [] }>()
const slots = useSlots()

const dialogRef = ref<HTMLDialogElement | null>(null)

function sync(open: boolean) {
  const el = dialogRef.value
  if (!el) return
  if (open && !el.open) {
    el.showModal()
    // Take focus on the dialog itself, not its first button: otherwise iOS
    // draws a focus ring on that button the moment a sheet or menu opens.
    el.focus({ preventScroll: true })
  }
  else if (!open && el.open) el.close()
}

// Post-flush, so a morph's snapshot sees the dialog already open or closed.
watch(
  () => props.open,
  (open) => sync(open),
  { flush: 'post' },
)

onMounted(() => {
  props.morph?.setTarget(dialogRef.value)
  if (props.open) sync(true)
})

// When a morph animates the opening, the dialog's own slide/fade would fight it.
const morphing = computed(() => !!props.morph && morphSupported)

function onBackdropClick(e: MouseEvent) {
  if (e.target === dialogRef.value) emit('close')
}
</script>

<template>
  <dialog
    ref="dialogRef"
    tabindex="-1"
    :inert="!open"
    :class="[
      // Reset native dialog defaults. The dialog itself takes focus on open
      // (see sync), so it draws no ring of its own.
      'bg-card max-h-full max-w-full border-0 p-0 text-inherit outline-none',
      // Width by size prop.
      variant !== 'menu' && (size === 'sm' ? 'w-full md:max-w-sm' : 'w-full md:max-w-md'),
      variant === 'menu' &&
        'fixed top-auto bottom-[calc(var(--chrome-bottom)+0.5rem)] left-auto right-[max(0.75rem,calc((100vw-32rem)/2))] m-0 w-72 max-w-[calc(100vw-1.5rem)] max-h-[calc(100svh-var(--chrome-top)-var(--chrome-bottom)-1rem)] origin-bottom-right overflow-y-auto rounded-3xl border shadow-lg',
      // Layout per variant.
      variant === 'center' &&
        'fixed inset-x-0 top-[calc(var(--chrome-top)+1rem)] bottom-[calc(var(--chrome-bottom)+1rem)] m-auto h-fit rounded-3xl p-6 shadow-lg max-h-[calc(100svh-var(--chrome-top)-var(--chrome-bottom)-4rem)] max-md:max-w-[calc(100vw-2rem)]',
      variant === 'sheet' && [
        'flex flex-col shadow-lg',
        // Mobile: pinned to bottom, full-bleed, top-rounded, overflow-visible
        // so the ::after bg extension can paint below the dialog box.
        'max-md:fixed max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:m-0 max-md:max-h-[calc(100svh-3rem)] max-md:rounded-t-3xl max-md:overflow-visible',
        // Mobile: visual-only background extension below the sheet so the
        // rubber-band overshoot doesn't expose the backdrop underneath.
        'max-md:after:pointer-events-none max-md:after:absolute max-md:after:inset-x-0 max-md:after:top-full max-md:after:h-32 max-md:after:bg-card',
        // Desktop: match center (chrome-aware centered card).
        'md:fixed md:inset-x-0 md:top-[calc(var(--chrome-top)+1rem)] md:bottom-[calc(var(--chrome-bottom)+1rem)] md:m-auto md:h-fit md:max-h-[calc(100vh-var(--chrome-top)-var(--chrome-bottom)-4rem)] md:rounded-3xl',
      ],
      // Closed (resting) state — also the exit target.
      'opacity-0',
      variant !== 'sheet' && 'scale-95',
      variant === 'sheet' && 'max-md:translate-y-full md:scale-95',
      // Open state.
      'open:opacity-100',
      variant !== 'sheet' && 'open:scale-100',
      variant === 'sheet' && 'max-md:open:translate-y-0 md:open:scale-100',
      // Entry from-state via @starting-style.
      'starting:open:opacity-0',
      variant !== 'sheet' && 'starting:open:scale-95',
      variant === 'sheet' &&
        'max-md:starting:open:translate-y-full md:starting:open:scale-95',
      // Transition — explicit property list incl. display so transition-discrete
      // can defer display:none until the visible properties finish animating.
      // A morph animates it instead (the page cross-fades the backdrop).
      morphing
        ? 'transition-none'
        : 'ease-rubber-band transition-[opacity,translate,scale,display] transition-discrete backdrop:transition-opacity',
      // Backdrop.
      variant === 'menu' ? 'backdrop:bg-black/20' : 'backdrop:bg-black/50',
      'backdrop:opacity-0 open:backdrop:opacity-100 starting:open:backdrop:opacity-0',
      'motion-reduce:transition-none motion-reduce:backdrop:transition-none',
    ]"
    @click="onBackdropClick"
    @cancel.prevent="emit('close')"
  >
    <header
      v-if="variant === 'sheet' && slots.header"
      class="flex items-center gap-3 border-b p-4 pr-3"
    >
      <div class="min-w-0 flex-1 space-y-1">
        <slot name="header" />
      </div>
      <button
        v-if="closable"
        type="button"
        class="bg-card hover:bg-accent flex h-11 shrink-0 items-center rounded-full border px-4 text-[0.9375rem] font-bold"
        @click="emit('close')"
      >
        Close
      </button>
    </header>

    <button
      v-if="closable && variant !== 'menu' && !(variant === 'sheet' && slots.header)"
      type="button"
      aria-label="Close"
      class="hover:bg-accent text-muted-foreground absolute top-2 right-2 z-10 flex size-11 items-center justify-center rounded-full"
      @click="emit('close')"
    >
      <X class="size-4" />
    </button>

    <div v-if="variant === 'sheet'" class="overflow-y-auto">
      <slot />
    </div>
    <slot v-else-if="variant === 'menu'" />
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
