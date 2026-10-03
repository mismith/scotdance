<script setup lang="ts">
import { computed, onMounted, ref, useId, useSlots, watch } from 'vue'
import { X } from '@lucide/vue'
import { morphSupported, useMorph, type Morph } from '@/lib/morph'

const props = withDefaults(
  defineProps<{
    open: boolean
    /**
     * sheet: slides up on phones (a centred card on wider screens).
     * dropdown: a small panel anchored to whatever opened it (or to its
     * `[data-menu-anchor]` ancestor, e.g. the tab bar). center: a card in the
     * middle.
     */
    variant?: 'center' | 'sheet' | 'dropdown'
    size?: 'sm' | 'md'
    closable?: boolean
    /**
     * Everything grows out of the control that opened it and shrinks back
     * into it (lib/morph): pass the opener's useMorph() to drive it yourself,
     * or leave it out and the dialog morphs out of whatever was just pressed.
     * `false` for interruptions that ask for a decision (confirms): they
     * simply appear.
     */
    morph?: Morph | false
  }>(),
  { variant: 'center', size: 'sm', closable: true, morph: undefined },
)

const emit = defineEmits<{ close: [] }>()
const slots = useSlots()
const headerId = useId()

const dialogRef = ref<HTMLDialogElement | null>(null)

// The morph that animates this dialog: the opener's, our own, or none.
const own = useMorph()
const morph = computed(() => (props.morph === false ? null : (props.morph ?? own)))
const ownsMorph = computed(() => props.morph === undefined)
// Our own morph follows `open`; the dialog follows the morph, so it opens
// inside the morph's transition.
watch(
  () => props.open,
  (open) => {
    if (!ownsMorph.value) return
    if (open) void own.show()
    else void own.hide()
  },
)
const shown = computed(() => (ownsMorph.value ? own.open : props.open))
// (While closing, the dialog stays on screen for its morph but takes no more
// taps: inert as soon as `open` turns false. A quick double tap can't act twice.)

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
watch(shown, (open) => sync(open), { flush: 'post' })

onMounted(() => {
  if (props.morph !== false) (props.morph ?? own).setTarget(dialogRef.value)
  if (ownsMorph.value && props.open) void own.show()
  else if (shown.value) sync(true)
})

// When a morph animates the opening, the dialog's own slide/fade would fight
// it; with nothing on screen to grow from, it opens the ordinary way.
const morphing = computed(() => !!morph.value?.animated && morphSupported)

// A dropdown hangs under the control that opened it, lined up with the
// trigger's nearer edge (its right edge for controls on the right of the
// screen, its left edge for those on the left), never off screen. Low on the
// screen, with more room above, it opens upward instead; either way it's no
// taller than the room it has, and scrolls past that. A trigger inside a
// `[data-menu-anchor]` (the tab bar's pill) still lines up with itself, but
// clears that whole bar: above it on phones, below it on desktop.
const anchor = computed<Record<string, string> | undefined>(() => {
  const trigger = morph.value?.trigger
  if (props.variant !== 'dropdown' || !shown.value || !trigger?.isConnected) return undefined
  const r = trigger.getBoundingClientRect()
  const bar = (trigger.closest('[data-menu-anchor]') ?? trigger).getBoundingClientRect()
  // The panel is w-72 (18rem, so larger with bigger text), at most the
  // window less a 12px margin each side.
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const width = Math.min(18 * rem, innerWidth - 24)
  const leftSide = r.left + r.width / 2 < innerWidth / 2
  const want = leftSide ? r.left : r.right - width
  const left = Math.min(Math.max(12, want), innerWidth - width - 12)
  const below = innerHeight - bar.bottom - 18
  const above = bar.top - 18
  const up = below < 320 && above > below
  return {
    ...(up
      ? { top: 'auto', bottom: `${Math.round(innerHeight - bar.top + 6)}px` }
      : { top: `${Math.round(bar.bottom + 6)}px`, bottom: 'auto' }),
    left: `${Math.round(left)}px`,
    right: 'auto',
    maxHeight: `${Math.round(up ? above : below)}px`,
    transformOrigin: `${leftSide ? 'left' : 'right'} ${up ? 'bottom' : 'top'}`,
  }
})

function onBackdropClick(e: MouseEvent) {
  if (e.target === dialogRef.value) emit('close')
}

// Sheets on phones can be pulled down to close, from the grabber or header.
const drag = ref<{ y0: number; t0: number; dy: number } | null>(null)
const settling = ref(false)
function onDragStart(e: PointerEvent) {
  if (props.variant !== 'sheet' || !props.closable || matchMedia('(min-width: 48rem)').matches) return
  if (e.button !== 0 || (e.target as Element).closest('button, a, input, select, textarea, [role="button"]')) return
  drag.value = { y0: e.clientY, t0: performance.now(), dy: 0 }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onDragMove(e: PointerEvent) {
  if (!drag.value) return
  const dy = e.clientY - drag.value.y0
  // Downward 1:1; upward resists, like pulling on something pinned.
  drag.value.dy = dy > 0 ? dy : -Math.sqrt(-dy) * 2
}
function onDragEnd() {
  const d = drag.value
  if (!d) return
  drag.value = null
  const velocity = d.dy / Math.max(1, performance.now() - d.t0)
  if (d.dy > 120 || (d.dy > 24 && velocity > 0.6)) emit('close')
  else {
    settling.value = true
    setTimeout(() => (settling.value = false), 380)
  }
}
const dragStyle = computed(() =>
  drag.value ? { translate: `0 ${drag.value.dy}px`, transition: 'none' } : undefined,
)
</script>

<template>
  <dialog
    ref="dialogRef"
    tabindex="-1"
    :inert="!shown || !open"
    :data-morph-kind="variant === 'sheet' ? 'sheet' : 'float'"
    :aria-labelledby="slots.header && !$attrs['aria-label'] ? headerId : undefined"
    :style="[anchor, dragStyle]"
    :class="[
      // Reset native dialog defaults. The dialog itself takes focus on open
      // (see sync), so it draws no ring of its own. Each variant sets its own
      // max size: a general max-h/max-w-full here would win over theirs.
      'bg-raised border-0 p-0 text-inherit outline-none',
      // Width by size prop.
      variant !== 'dropdown' && (size === 'sm' ? 'w-full md:max-w-sm' : 'w-full md:max-w-md'),
      variant === 'dropdown' &&
        'fixed top-[calc(var(--chrome-top)+0.25rem)] bottom-auto left-auto right-(--dropdown-right,0.75rem) m-0 w-72 max-w-[calc(100vw-1.5rem)] max-h-[calc(100svh-var(--chrome-top)-1rem)] origin-top-right overflow-y-auto rounded-[1.375rem] p-1.5 shadow-(--shadow-raised)',
      // Layout per variant.
      variant === 'center' &&
        'fixed inset-x-0 top-[calc(var(--chrome-top)+1rem)] bottom-[calc(var(--chrome-bottom)+1rem)] m-auto h-fit rounded-3xl p-6 shadow-(--shadow-raised) max-h-[calc(100svh-var(--chrome-top)-var(--chrome-bottom)-4rem)] max-md:max-w-[calc(100vw-2rem)]',
      variant === 'sheet' && [
        // Flex only while open: a bare `flex` would beat the browser's
        // display:none for a closed dialog and leave it on the page, unseen.
        'flex-col shadow-(--shadow-raised) open:flex',
        // Mobile: pinned to the bottom, full-bleed, top-rounded.
        'max-md:fixed max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:m-0 max-md:max-h-[calc(100svh-3rem)] max-md:max-w-full max-md:rounded-t-[1.75rem]',
        // Desktop: match center (chrome-aware centred card).
        'md:fixed md:inset-x-0 md:top-[calc(var(--chrome-top)+1rem)] md:bottom-[calc(var(--chrome-bottom)+1rem)] md:m-auto md:h-fit md:max-h-[calc(100vh-var(--chrome-top)-var(--chrome-bottom)-4rem)] md:rounded-3xl',
      ],
      // Closed (resting) state, also the exit target. A sheet on a phone only
      // slides (no fade): it's a solid thing coming up from the edge.
      variant === 'sheet' ? 'md:opacity-0 max-md:translate-y-full md:scale-95' : 'opacity-0 scale-95',
      // Open state.
      variant === 'sheet' ? 'md:open:opacity-100 max-md:open:translate-y-0 md:open:scale-100' : 'open:opacity-100 open:scale-100',
      // Entry from-state via @starting-style.
      variant === 'sheet'
        ? 'md:starting:open:opacity-0 max-md:starting:open:translate-y-full md:starting:open:scale-95'
        : 'starting:open:opacity-0 starting:open:scale-95',
      // Transition: explicit property list incl. display so transition-discrete
      // can defer display:none until the visible properties finish. A morph
      // animates it instead (the page cross-fades the backdrop).
      morphing && !settling
        ? 'transition-none'
        : 'ease-snappy duration-[320ms] transition-[opacity,translate,scale,display] transition-discrete backdrop:transition-opacity',
      // Backdrop: menus float over the page without dimming it.
      variant === 'dropdown' ? 'backdrop:bg-transparent' : 'backdrop:bg-black/40',
      'backdrop:opacity-0 open:backdrop:opacity-100 starting:open:backdrop:opacity-0',
      'motion-reduce:transition-none motion-reduce:backdrop:transition-none',
    ]"
    @click="onBackdropClick"
    @cancel.prevent="emit('close')"
  >
    <div
      v-if="variant === 'sheet'"
      class="relative shrink-0 touch-none"
      @pointerdown="onDragStart"
      @pointermove="onDragMove"
      @pointerup="onDragEnd"
      @pointercancel="onDragEnd"
    >
      <!-- A grabber says "pull me down" on phones. -->
      <span class="bg-foreground/20 absolute top-2 left-1/2 h-[5px] w-9 -translate-x-1/2 rounded-full md:hidden" aria-hidden="true" />
      <header v-if="slots.header" class="flex items-center gap-3 border-b px-4 pt-5 pb-4 pr-3 md:pt-4">
        <div :id="headerId" class="min-w-0 flex-1 space-y-1">
          <slot name="header" />
        </div>
        <button
          v-if="closable"
          type="button"
          aria-label="Close"
          class="press text-muted-foreground relative flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--foreground)_7%,transparent)] after:absolute after:-inset-1"
          @click="emit('close')"
        >
          <X class="size-4" stroke-width="2.5" />
        </button>
      </header>
      <div v-else class="h-5 md:hidden" />
    </div>

    <button
      v-if="closable && variant !== 'dropdown' && !(variant === 'sheet' && slots.header)"
      type="button"
      aria-label="Close"
      class="press text-muted-foreground absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--foreground)_7%,transparent)] after:absolute after:-inset-1"
      @click="emit('close')"
    >
      <X class="size-4" stroke-width="2.5" />
    </button>

    <div v-if="variant === 'sheet'" class="overflow-y-auto">
      <slot />
    </div>
    <slot v-else-if="variant === 'dropdown'" />
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
