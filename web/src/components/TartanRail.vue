<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useElementSize } from '@vueuse/core'
import { Plus } from '@lucide/vue'
import { selectionHaptic } from '@/lib/haptics'
import { WIDTH_NAMES, swatchName, type Palette, type Stripe, type Width } from '@/lib/tartan'

// A tartan's stripes as a row of bricks, from the middle of the pattern out:
// each as wide as its piece (scaled down together if they'd overflow, never
// below a grabbable sliver), in its colour. Tap one to choose it; drag one
// along the row to move it (its neighbours slide aside as it passes, and
// `preview` reports the order so the cloth can reweave mid-drag); arrow keys
// move the focused one. The + at the end adds a stripe.
export type Brick = Stripe & { id: number }

const props = defineProps<{
  bricks: Brick[]
  palette: Palette
  selected: number | null
  canAdd: boolean
}>()
const emit = defineEmits<{
  select: [id: number]
  move: [from: number, to: number]
  preview: [order: Brick[] | null]
  add: []
}>()

// Base widths in px: wide enough to grab even a line, in proportion enough to read as the cloth.
const UNIT: Record<Width, number> = { 2: 18, 6: 26, 16: 38, 40: 60 }
const MIN = 12
const GAP = 4
const ADD = 44

const rail = useTemplateRef<HTMLElement>('rail')
const { width } = useElementSize(rail)
// Scaled to fit; bricks that would go under MIN stay at MIN and the rest share what's left.
const widths = computed(() => {
  const room = width.value - (props.canAdd ? ADD + GAP : 0) - GAP * (props.bricks.length - 1)
  const need = props.bricks.reduce((n, b) => n + UNIT[b.width], 0)
  if (room <= 0 || need <= room) return props.bricks.map((b) => UNIT[b.width])
  let scale = room / need
  const small = props.bricks.filter((b) => UNIT[b.width] * scale < MIN)
  if (small.length) scale = Math.max(0, room - MIN * small.length) / (need - small.reduce((n, b) => n + UNIT[b.width], 0))
  return props.bricks.map((b) => Math.max(MIN, UNIT[b.width] * scale))
})

const labelOf = (b: Brick, i: number) =>
  `${WIDTH_NAMES[b.width]} in ${(swatchName(props.palette[b.code] ?? '') ?? 'your own colour').toLowerCase()}, ${i + 1} of ${props.bricks.length}`

const brickEls = () => [...(rail.value?.querySelectorAll<HTMLElement>('[data-brick]') ?? [])]

/** Put focus on a brick (after it's removed or put down, focus has somewhere to be). */
async function focus(id: number) {
  await nextTick()
  brickEls()
    .find((el) => el.dataset.brick === String(id))
    ?.focus()
}
defineExpose({ focus })

// Dragging: the brick follows the finger; the ones it passes slide over by
// its width. Nothing in the DOM moves until the drop, when `move` reorders
// the list and Vue redraws it. One finger at a time.
const dragging = ref<{ index: number; dx: number; to: number; step: number } | null>(null)
let pointer: number | null = null
let suppressClick = false

function onPointerDown(e: PointerEvent, index: number) {
  if (e.button > 0 || !e.isPrimary || pointer != null) return
  const rects = brickEls().map((el) => el.getBoundingClientRect())
  const from = rects[index]
  if (!from) return
  pointer = e.pointerId
  const x0 = e.clientX
  const step = from.width + GAP
  let moved = false
  let lastTo = index

  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== pointer) return
    const dx = ev.clientX - x0
    if (!moved) {
      if (Math.abs(dx) < 6) return
      moved = true
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
    }
    ev.preventDefault()
    const centre = from.left + from.width / 2 + dx
    let to = 0
    rects.forEach((r, i) => {
      if (i !== index && centre > r.left + r.width / 2) to++
    })
    dragging.value = { index, dx, to, step }
    if (to !== lastTo) {
      lastTo = to
      selectionHaptic()
      const order = [...props.bricks]
      order.splice(to, 0, ...order.splice(index, 1))
      emit('preview', order)
    }
  }
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== pointer) return
    pointer = null
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    const d = dragging.value
    dragging.value = null
    if (!moved) return
    suppressClick = true
    setTimeout(() => (suppressClick = false))
    emit('preview', null)
    if (d && ev.type === 'pointerup' && d.to !== index) emit('move', index, d.to)
  }
  window.addEventListener('pointermove', move, { passive: false })
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

// Where each brick sits mid-drag: the dragged one under the finger, the
// ones it has passed shifted by its width.
function shift(i: number) {
  const d = dragging.value
  if (!d) return undefined
  if (i === d.index) return `translateX(${d.dx}px)`
  if (d.index < i && i <= d.to) return `translateX(${-d.step}px)`
  if (d.to <= i && i < d.index) return `translateX(${d.step}px)`
  return undefined
}

function onClick(b: Brick) {
  if (suppressClick) return
  emit('select', b.id)
}

function onKeydown(e: KeyboardEvent, index: number) {
  const by = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
  const to = index + by
  if (!by || to < 0 || to >= props.bricks.length) return
  e.preventDefault()
  emit('move', index, to)
  void focus(props.bricks[index]!.id)
}
</script>

<template>
  <div ref="rail" class="flex h-11 items-stretch" :style="{ gap: `${GAP}px` }">
    <button
      v-for="(b, i) in bricks"
      :key="b.id"
      :data-brick="b.id"
      type="button"
      :aria-pressed="selected === b.id"
      :aria-label="labelOf(b, i)"
      aria-description="Arrow keys move it"
      :class="[
        'relative shrink-0 cursor-grab touch-none rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.14),inset_0_2px_0_rgb(255_255_255/0.2)] forced-colors:border',
        selected === b.id && 'outline-foreground z-1 outline-3 outline-offset-1',
        dragging?.index === i
          ? 'z-2 scale-108 cursor-grabbing shadow-[0_10px_22px_rgb(0_0_0/0.3),inset_0_0_0_1px_rgb(0_0_0/0.14)]'
          : dragging && 'transition-transform duration-(--dur-quick) ease-standard motion-reduce:transition-none',
      ]"
      :style="{ width: `${widths[i]}px`, background: palette[b.code], transform: shift(i) }"
      @pointerdown="onPointerDown($event, i)"
      @click="onClick(b)"
      @keydown="onKeydown($event, i)"
    />
    <button
      v-if="canAdd"
      type="button"
      aria-label="Add a stripe"
      class="press text-muted-foreground hover:text-foreground flex shrink-0 items-center justify-center rounded-md shadow-[inset_0_0_0_1.5px_var(--strong)]"
      :style="{ width: `${ADD}px` }"
      @click="emit('add')"
    >
      <Plus class="size-5" stroke-width="2.5" aria-hidden="true" />
    </button>
  </div>
</template>
