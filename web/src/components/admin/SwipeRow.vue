<script setup lang="ts">
import { ref } from 'vue'
import { Trash2 } from '@lucide/vue'
import { tapHaptic } from '@/lib/haptics'

// A list row that slides left under a finger to delete it, as on iOS. Once
// the swipe starts, the row follows the finger wherever it goes (up, down,
// off the row) and nothing happens until it's let go: past the line (or
// flung left) it deletes; anywhere short of that, it springs back. Touch and
// pen only, so a mouse still clicks, selects text and drags the handles. A
// shortcut only, hidden from screen readers: the item itself has Delete too.

// Classes go on the part that slides, which is the row people see.
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  /** Deletes the item, asking first if that matters. The row waits for it, then springs back if it's still here. */
  remove: () => unknown
  disabled?: boolean
}>()

const LINE = 0.45 // of the row's width
const SLOP = 10 // px the finger moves before it counts as a swipe (or not)
const FLING = 0.6 // px/ms

const offset = ref(0)
const following = ref(false)
const armed = ref(false)
// The action stays once shown (zero wide at rest), so the row slides back over it.
const shown = ref(false)

let start: { id: number; x: number; y: number } | null = null
// The page holds still under the finger: while the move leans left (so it
// may be a swipe) and for the whole swipe, wherever the finger goes.
// touch-action: pan-y alone does in Chrome, but not always on iOS.
let holding = false
let width = 0
let last = { x: 0, t: 0 }
let velocity = 0
let endedAt = -Infinity
let deleting = false

// Past the end the row gives less and less, like iOS's rubber band.
const band = (over: number) => (1 - 1 / ((over * 0.55) / width + 1)) * width

function down(e: PointerEvent) {
  if (props.disabled || deleting || e.pointerType === 'mouse' || !e.isPrimary) return
  // A drag handle reorders instead.
  if ((e.target as Element).closest('[data-handle]')) return
  start = { id: e.pointerId, x: e.clientX, y: e.clientY }
}

function move(e: PointerEvent) {
  if (start?.id !== e.pointerId) return
  const dx = e.clientX - start.x
  const dy = e.clientY - start.y
  if (!following.value) {
    holding = -dx > Math.abs(dy)
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP) return
    // Only a clearly sideways move to the left is a swipe; anything else
    // (scrolling, most likely) is left to the page.
    if (-dx < Math.abs(dy) * 1.5) {
      start = null
      holding = false
      return
    }
    const el = e.currentTarget as HTMLElement
    width = el.offsetWidth
    velocity = 0
    following.value = shown.value = true
    el.setPointerCapture(e.pointerId)
  } else if (e.timeStamp > last.t) {
    velocity = 0.8 * ((e.clientX - last.x) / (e.timeStamp - last.t)) + 0.2 * velocity
  }
  last = { x: e.clientX, t: e.timeStamp }
  offset.value = dx > 0 ? band(dx) : dx < -width ? -width - band(-dx - width) : dx
  const past = -offset.value > width * LINE
  if (past !== armed.value) {
    armed.value = past
    if (past) tapHaptic()
  }
}

async function end(e: PointerEvent) {
  if (start?.id !== e.pointerId) return
  start = null
  holding = false
  if (!following.value) return
  following.value = false
  endedAt = performance.now()
  const flung =
    e.timeStamp - last.t < 100 && velocity < -FLING && -offset.value > width * 0.2
  try {
    if (e.type === 'pointerup' && (armed.value || flung)) {
      deleting = true
      armed.value = true
      offset.value = -width
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        await new Promise((r) => setTimeout(r, 250))
      await props.remove()
    }
  } finally {
    // Back in place: short of the line, cancelled, or kept when asked.
    deleting = false
    offset.value = 0
    armed.value = false
  }
}

function hold(e: TouchEvent) {
  if (holding && e.cancelable) e.preventDefault()
}

// A swipe isn't a tap, whatever the browser makes of it.
function click(e: MouseEvent) {
  if (performance.now() - endedAt > 400) return
  e.preventDefault()
  e.stopPropagation()
}
</script>

<template>
  <div class="relative overflow-hidden">
    <div
      v-if="shown"
      aria-hidden="true"
      :class="[
        'bg-destructive-fill text-destructive-foreground absolute inset-y-0 right-0 flex items-center justify-center overflow-hidden',
        !following &&
          'ease-snappy transition-[width] duration-(--dur-slow) motion-reduce:transition-none',
      ]"
      :style="{ width: `${Math.max(0, -offset)}px` }"
    >
      <!-- Centred until past the line, then it jumps to the row's edge and grows. -->
      <span
        :class="[
          'ease-standard transition-[flex-grow] duration-(--dur-quick) motion-reduce:transition-none',
          armed ? 'grow-0' : 'grow',
        ]"
      />
      <span
        :class="[
          'ease-elastic flex shrink-0 flex-col items-center gap-0.5 px-5 text-sm font-semibold transition-transform duration-(--dur-slow) motion-reduce:transition-none',
          armed && 'scale-120',
        ]"
      >
        <Trash2 class="size-5" />
        Delete
      </span>
      <span class="grow" />
    </div>
    <div
      v-bind="$attrs"
      :class="[
        'relative touch-pan-y touch-pinch-zoom',
        !following &&
          // (box-shadow too: a pressed row's tint fades as it springs back.)
          'ease-snappy transition-[transform,box-shadow] duration-(--dur-slow) motion-reduce:transition-none',
      ]"
      :style="offset ? { transform: `translateX(${offset}px)` } : undefined"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="end"
      @pointercancel="end"
      @touchmove="hold"
      @click.capture="click"
    >
      <slot />
    </div>
  </div>
</template>
