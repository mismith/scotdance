<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCw } from '@lucide/vue'
import Dialog from '@/components/Dialog.vue'
import { selectionHaptic } from '@/lib/haptics'
import { FITTED, bounds, clampView, eased, easedScale, fit, zoomAt, type Point, type View } from '@/lib/zoom'
import type { SheetPage } from '@/types/competition'

// A dance's judges' sheet, page by page, in a sheet over the results. Pinch
// (or double-tap) to read the small print, drag to look around, swipe for
// the next page. With a mouse or trackpad: double-click, pinch or Ctrl and
// scroll, the + and − buttons, and the arrow keys.

const props = defineProps<{ open: boolean; title: string; subtitle?: string; pages: SheetPage[]; startAt?: number }>()
const emit = defineEmits<{ close: [] }>()

const PAD = 16 // between the paper and the stage's edges at fit
const index = ref(0)
const view = reactive<View>({ ...FITTED })
const drag = ref(0) // the pages' sideways offset while swiping
const settling = ref(false) // the view eases to where it's going (not while a finger holds it)
const turning = ref(false) // the pages slide to the next one
const stage = ref<HTMLElement | null>(null)
const size = reactive({ width: 0, height: 0 })
const status = reactive<Record<string, 'loading' | 'ready' | 'failed'>>({})
const retries = reactive<Record<string, number>>({})
const announcement = ref('')

const count = computed(() => props.pages.length)
const page = computed(() => props.pages[index.value] ?? null)
// The tallest page sets the stage's shape, so turning pages doesn't jump.
const shape = computed(() => {
  const tallest = Math.max(...props.pages.map((p) => p.height / p.width), 0.5)
  return `1 / ${tallest}`
})
const room = computed(() => ({ width: size.width - PAD * 2, height: size.height - PAD * 2 }))
const fitted = (p: SheetPage) => fit(p, room.value)
// Up to one and a half times the picture's own pixels: no further, or it blurs.
const maxScale = (p: SheetPage) => {
  const f = fitted(p)
  return f.width ? Math.min(8, Math.max(2.5, (p.width / f.width) * 1.5)) : 1
}
const zoomed = computed(() => view.scale > 1.01)

let resize: ResizeObserver | null = null
watch(stage, (el) => {
  resize?.disconnect()
  if (!el) return
  resize = new ResizeObserver(([entry]) => {
    size.width = entry.contentRect.width
    size.height = entry.contentRect.height
    if (page.value) Object.assign(view, clampView(view, fitted(page.value), size, maxScale(page.value)))
  })
  resize.observe(el)
})
onBeforeUnmount(() => resize?.disconnect())

watch(
  () => props.open,
  (open) => {
    if (!open) return
    index.value = Math.min(Math.max(props.startAt ?? 0, 0), Math.max(count.value - 1, 0))
    Object.assign(view, FITTED)
    drag.value = 0
    announcement.value = ''
    void nextTick(() => stage.value?.focus({ preventScroll: true }))
  },
)

// A page taken off while it's open: stay on one that's still there.
watch(count, (n) => {
  if (index.value > n - 1) index.value = Math.max(0, n - 1)
})

// --- Moving the view

let settleTimer = 0
function settleTo(target: View) {
  settling.value = true
  Object.assign(view, target)
  window.clearTimeout(settleTimer)
  settleTimer = window.setTimeout(() => (settling.value = false), 320)
}
function stopSettling() {
  window.clearTimeout(settleTimer)
  settling.value = false
}
const settled = (v: View) => (page.value ? clampView(v, fitted(page.value), size, maxScale(page.value)) : { ...FITTED })

function zoomBy(factor: number, at: Point = { x: 0, y: 0 }) {
  if (!page.value) return
  settleTo(settled(zoomAt(view, view.scale * factor, at)))
}

let turnTimer = 0
function go(to: number) {
  const next = Math.min(Math.max(to, 0), count.value - 1)
  turning.value = true
  drag.value = 0
  window.clearTimeout(turnTimer)
  turnTimer = window.setTimeout(() => (turning.value = false), 400)
  if (next === index.value) return
  index.value = next
  Object.assign(view, FITTED)
  selectionHaptic()
  announcement.value = `Page ${next + 1} of ${count.value}`
}

// --- Fingers, mouse and pen

const pointers = new Map<number, Point>()
type Gesture =
  | { kind: 'swipe'; from: Point; axis: 'x' | 'y' | null }
  | { kind: 'pan'; from: Point; start: View }
  | { kind: 'pinch'; distance: number; middle: Point; start: View }
let gesture: Gesture | null = null
let down = { t: 0, x: 0, y: 0, moved: false }
let lastTap = { t: 0, x: 0, y: 0 }
let lastMiddle: Point = { x: 0, y: 0 }
let samples: Array<{ t: number } & Point> = []

function local(e: { clientX: number; clientY: number }): Point {
  const r = stage.value!.getBoundingClientRect()
  return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 }
}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const middle = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

function begin() {
  const ps = [...pointers.values()]
  if (ps.length >= 2) {
    // A second finger: whatever the first was doing becomes a pinch.
    drag.value = 0
    gesture = { kind: 'pinch', distance: distance(ps[0], ps[1]) || 1, middle: middle(ps[0], ps[1]), start: { ...view } }
    lastMiddle = gesture.middle
  } else if (ps.length === 1) {
    gesture = zoomed.value ? { kind: 'pan', from: ps[0], start: { ...view } } : { kind: 'swipe', from: ps[0], axis: null }
    samples = []
  } else gesture = null
}

function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  if (!page.value) return
  stage.value?.setPointerCapture(e.pointerId)
  const p = local(e)
  pointers.set(e.pointerId, p)
  stopSettling()
  if (pointers.size === 1) down = { t: e.timeStamp, x: p.x, y: p.y, moved: false }
  begin()
}

function onPointerMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId) || !gesture || !page.value) return
  const p = local(e)
  pointers.set(e.pointerId, p)
  if (!down.moved && distance(p, down) > 6) down.moved = true
  samples.push({ t: e.timeStamp, ...p })
  while (samples.length > 2 && e.timeStamp - samples[0].t > 100) samples.shift()
  const f = fitted(page.value)
  const max = maxScale(page.value)

  if (gesture.kind === 'pinch') {
    const [a, b] = [...pointers.values()]
    if (!b) return
    const m = middle(a, b)
    const scale = easedScale((gesture.start.scale * distance(a, b)) / gesture.distance, max)
    // What was under the fingers when they met stays under them.
    const c = { x: (gesture.middle.x - gesture.start.x) / gesture.start.scale, y: (gesture.middle.y - gesture.start.y) / gesture.start.scale }
    Object.assign(view, { scale, x: m.x - scale * c.x, y: m.y - scale * c.y })
    lastMiddle = m
  } else if (gesture.kind === 'pan') {
    const b = bounds(f, size, view.scale)
    view.x = eased(gesture.start.x + p.x - gesture.from.x, b.x, size.width)
    view.y = eased(gesture.start.y + p.y - gesture.from.y, b.y, size.height)
  } else {
    const dx = p.x - gesture.from.x
    const dy = p.y - gesture.from.y
    if (!gesture.axis && Math.hypot(dx, dy) > 8) gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    if (gesture.axis !== 'x' || count.value < 2) return
    // Past the first or last page it gives way, then springs back.
    const atEnd = (dx > 0 && index.value === 0) || (dx < 0 && index.value === count.value - 1)
    drag.value = atEnd ? eased(dx, 0, size.width) : dx
  }
}

function velocity(): Point {
  if (samples.length < 2) return { x: 0, y: 0 }
  const a = samples[0]
  const b = samples[samples.length - 1]
  const dt = Math.max(b.t - a.t, 1)
  return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt }
}

function onPointerUp(e: PointerEvent, cancelled = false) {
  if (!pointers.has(e.pointerId)) return
  const p = local(e)
  pointers.delete(e.pointerId)
  const was = gesture
  if (pointers.size) {
    // One finger lifted from a pinch: carry on moving it with the other.
    if (was?.kind === 'pinch') {
      const [rest] = [...pointers.values()]
      gesture = { kind: 'pan', from: rest, start: { ...view } }
      samples = []
    }
    return
  }
  gesture = null
  if (!was || !page.value) return

  if (was.kind === 'pinch') {
    const max = maxScale(page.value)
    // Over-pinched: ease back to the most it goes, around where the fingers were.
    const target = view.scale > max ? zoomAt(view, max, lastMiddle) : view
    settleTo(settled(target))
  } else if (was.kind === 'pan') {
    // A flick carries on a little.
    const v = velocity()
    settleTo(settled({ scale: view.scale, x: view.x + v.x * 140, y: view.y + v.y * 140 }))
  } else if (was.axis === 'x') {
    const v = velocity().x
    const far = Math.abs(drag.value) > size.width * 0.2 || Math.abs(v) > 0.35
    go(far && !cancelled ? index.value - Math.sign(drag.value || v) : index.value)
  }

  // A tap, then another on the same spot: zoom in there, or back out.
  if (cancelled || down.moved || e.timeStamp - down.t > 300) return
  if (e.timeStamp - lastTap.t < 320 && distance(p, lastTap) < 30) {
    lastTap = { t: 0, x: 0, y: 0 }
    if (zoomed.value) settleTo({ ...FITTED })
    else {
      const f = fitted(page.value)
      const scale = Math.min(maxScale(page.value), Math.max(2, (page.value.width / f.width) * 0.6))
      settleTo(settled(zoomAt(view, scale, p)))
    }
  } else lastTap = { t: e.timeStamp, x: p.x, y: p.y }
}

// Trackpad pinches arrive as Ctrl + scroll; plain scrolling moves a zoomed page.
let wheelTurned = 0
function onWheel(e: WheelEvent) {
  if (!page.value) return
  e.preventDefault()
  stopSettling()
  if (e.ctrlKey || e.metaKey) {
    const scale = view.scale * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.01))
    Object.assign(view, settled(zoomAt(view, scale, local(e))))
  } else if (zoomed.value) {
    Object.assign(view, settled({ scale: view.scale, x: view.x - e.deltaX, y: view.y - e.deltaY }))
  } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 20 && e.timeStamp - wheelTurned > 500) {
    wheelTurned = e.timeStamp
    go(index.value + Math.sign(e.deltaX))
  }
}

// Keys work wherever focus is while it's open (the dialog takes it on opening).
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (props.open && !e.defaultPrevented) onKeydown(e)
})
// Safari on a Mac pinches with its own gesture events, not Ctrl + scroll.
// (On iPhone, fingers come as pointers too: those pinch already, so this
// only stops the page zooming.)
interface GestureEvent extends UIEvent {
  scale: number
  clientX: number
  clientY: number
}
let gestureFrom: View | null = null
useEventListener(stage, 'gesturestart', (e: Event) => {
  e.preventDefault()
  gestureFrom = pointers.size ? null : { ...view }
})
useEventListener(stage, 'gesturechange', (e: Event) => {
  e.preventDefault()
  if (!gestureFrom || !page.value) return
  const g = e as GestureEvent
  Object.assign(view, settled(zoomAt(gestureFrom, gestureFrom.scale * g.scale, local(g))))
})
useEventListener(stage, 'gestureend', (e: Event) => {
  e.preventDefault()
  gestureFrom = null
})

function onKeydown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.target instanceof HTMLElement && e.target.matches('input, textarea, select')) return
  const step = 80
  const keys: Record<string, () => void> = {
    ArrowLeft: () => (zoomed.value ? settleTo(settled({ ...view, x: view.x + step })) : go(index.value - 1)),
    ArrowRight: () => (zoomed.value ? settleTo(settled({ ...view, x: view.x - step })) : go(index.value + 1)),
    ArrowUp: () => zoomed.value && settleTo(settled({ ...view, y: view.y + step })),
    ArrowDown: () => zoomed.value && settleTo(settled({ ...view, y: view.y - step })),
    '+': () => zoomBy(1.6),
    '=': () => zoomBy(1.6),
    '-': () => zoomBy(1 / 1.6),
    '0': () => settleTo({ ...FITTED }),
  }
  const run = keys[e.key]
  if (!run) return
  e.preventDefault()
  run()
}

// --- Each page's picture: drawn at its own size and scaled down to fit, so
// zooming in shows real pixels rather than a blown-up thumbnail.

function pictureStyle(p: SheetPage, i: number) {
  const f = fitted(p)
  const k = f.width / p.width || 0
  const v = i === index.value ? view : FITTED
  return {
    width: `${p.width}px`,
    height: `${p.height}px`,
    marginLeft: `${-p.width / 2}px`,
    marginTop: `${-p.height / 2}px`,
    transform: `translate(${v.x}px, ${v.y}px) scale(${v.scale * k})`,
    // Lines that stay a hairline on screen, however it's scaled.
    boxShadow: k ? `0 ${2 / k}px ${10 / k}px rgb(0 0 0 / 0.16), 0 0 0 ${1 / (k * v.scale)}px rgb(0 0 0 / 0.08)` : undefined,
  }
}
const paperStyle = (p: SheetPage) => {
  const f = fitted(p)
  return { width: `${f.width}px`, height: `${f.height}px`, marginLeft: `${-f.width / 2}px`, marginTop: `${-f.height / 2}px` }
}
const src = (p: SheetPage) => (retries[p.id] ? `${p.url}${p.url.includes('?') ? '&' : '?'}retry=${retries[p.id]}` : p.url)
function retry(p: SheetPage) {
  retries[p.id] = (retries[p.id] ?? 0) + 1
  status[p.id] = 'loading'
}
const alt = (i: number) => `${props.title}, judges’ sheet${count.value > 1 ? `, page ${i + 1} of ${count.value}` : ''}`
</script>

<template>
  <Dialog :open="open" variant="sheet" size="lg" @close="emit('close')">
    <template #header>
      <h2 class="text-title truncate">{{ title }}</h2>
      <p class="text-muted-foreground text-callout truncate">
        {{ [subtitle, count > 1 ? `Page ${index + 1} of ${count}` : null].filter(Boolean).join(' · ') }}
      </p>
    </template>

    <div
      ref="stage"
      tabindex="0"
      role="group"
      aria-roledescription="carousel"
      :aria-label="`${title}, judges’ sheet`"
      :style="{ aspectRatio: shape }"
      :class="[
        'focus-inset relative w-full touch-none overflow-hidden select-none',
        'max-h-[calc(100svh-13rem)] md:max-h-[calc(100svh-var(--chrome-top)-var(--chrome-bottom)-12rem)]',
        zoomed ? 'cursor-grab active:cursor-grabbing' : 'pointer-fine:cursor-zoom-in',
      ]"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp($event)"
      @pointercancel="onPointerUp($event, true)"
      @lostpointercapture="onPointerUp($event, true)"
      @wheel="onWheel"
      @dragstart.prevent
    >
      <div
        :class="['absolute inset-0 flex', turning && 'ease-snappy transition-[translate] duration-(--dur-slow) motion-reduce:transition-none']"
        :style="{ translate: `calc(${-index * 100}% + ${drag}px) 0` }"
      >
        <div
          v-for="(p, i) in pages"
          :key="p.id"
          :aria-hidden="i !== index || undefined"
          :role="count > 1 ? 'group' : undefined"
          :aria-roledescription="count > 1 ? 'slide' : undefined"
          :aria-label="count > 1 ? `Page ${i + 1} of ${count}` : undefined"
          class="relative h-full w-full shrink-0"
        >
          <!-- The paper, until the picture is in -->
          <div
            v-if="status[p.id] !== 'ready'"
            class="absolute top-1/2 left-1/2 rounded-[2px] bg-white shadow-(--shadow-raised)"
            :style="paperStyle(p)"
          >
            <div v-if="status[p.id] === 'failed'" class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-neutral-700">
              <p class="text-base font-semibold">This page didn’t load.</p>
              <button
                type="button"
                class="press text-callout inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900/8 px-4 font-semibold text-neutral-900"
                @pointerdown.stop
                @click="retry(p)"
              >
                <RotateCw class="size-4" /> Try again
              </button>
            </div>
            <div v-else class="absolute inset-0 animate-pulse bg-neutral-900/4 motion-reduce:animate-none" />
          </div>
          <img
            v-show="status[p.id] !== 'failed'"
            :src="src(p)"
            :alt="alt(i)"
            :width="p.width"
            :height="p.height"
            :loading="Math.abs(i - index) <= 1 ? 'eager' : 'lazy'"
            decoding="async"
            draggable="false"
            :class="[
              'absolute top-1/2 left-1/2 max-w-none origin-center rounded-[2px] bg-white [-webkit-touch-callout:none]',
              status[p.id] === 'ready' ? 'opacity-100' : 'opacity-0',
              i === index && settling
                ? 'ease-snappy transition-[transform,opacity] duration-300 motion-reduce:transition-none'
                : 'transition-opacity duration-(--dur-base)',
            ]"
            :style="pictureStyle(p, i)"
            @load="status[p.id] = 'ready'"
            @error="status[p.id] = 'failed'"
          />
        </div>
      </div>
    </div>

    <div class="flex min-h-15 items-center gap-2 px-4 pt-2 pb-[calc(var(--safe-bottom)+0.75rem)]">
      <!-- Touch: how to zoom. Mouse and trackpad: buttons for it. -->
      <p class="text-muted-foreground min-w-0 flex-1 text-sm pointer-fine:hidden">
        {{ zoomed ? 'Double-tap to see the whole page' : 'Pinch or double-tap to zoom in' }}
      </p>
      <!-- (Screen readers on phones get them too: they can't pinch the page.) -->
      <div class="sr-only flex-1 items-center gap-1 pointer-fine:not-sr-only pointer-fine:flex">
        <button
          type="button"
          aria-label="Zoom out"
          :disabled="!zoomed"
          class="press text-primary flex size-11 items-center justify-center rounded-full disabled:opacity-(--disabled-opacity)"
          @click="zoomBy(1 / 1.6)"
        >
          <Minus class="size-5" />
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          :disabled="!!page && view.scale >= maxScale(page) - 0.01"
          class="press text-primary flex size-11 items-center justify-center rounded-full disabled:opacity-(--disabled-opacity)"
          @click="zoomBy(1.6)"
        >
          <Plus class="size-5" />
        </button>
      </div>
      <template v-if="count > 1">
        <button
          type="button"
          aria-label="Previous page"
          :disabled="index === 0"
          class="press text-primary sr-only size-11 items-center justify-center rounded-full disabled:opacity-(--disabled-opacity) pointer-fine:not-sr-only pointer-fine:flex"
          @click="go(index - 1)"
        >
          <ChevronLeft class="size-5" />
        </button>
        <div class="flex items-center gap-2 px-1" aria-hidden="true">
          <span
            v-for="(p, i) in pages"
            :key="p.id"
            :class="['size-2 rounded-full transition-colors duration-(--dur-base)', i === index ? 'bg-foreground' : 'bg-foreground/20']"
          />
        </div>
        <button
          type="button"
          aria-label="Next page"
          :disabled="index === count - 1"
          class="press text-primary sr-only size-11 items-center justify-center rounded-full disabled:opacity-(--disabled-opacity) pointer-fine:not-sr-only pointer-fine:flex"
          @click="go(index + 1)"
        >
          <ChevronRight class="size-5" />
        </button>
      </template>
    </div>
    <p class="sr-only" aria-live="polite">{{ announcement }}</p>
  </Dialog>
</template>
