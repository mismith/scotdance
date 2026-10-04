import { computed, onScopeDispose, watch, type Ref } from 'vue'
import { useDnDProvider } from '@vue-dnd-kit/core'
import { useEventListener, useMediaQuery } from '@vueuse/core'
import type { CellLocation, EventLocation } from './builder'

// What can be dragged in the schedule builder. Each kind is also its
// drag-and-drop group, so drop zones only light up for what they accept.

export interface DragGroup {
  type: 'group'
  groupId: string
  index: number
  source: CellLocation | 'palette'
}
export interface DragJudge {
  type: 'judge'
  judgeId: string
  index: number
  source: CellLocation | 'palette'
}
export interface DragDance {
  type: 'dance'
  danceId?: string
  /** The row's id, when dragged from the schedule. */
  rowId: string
  index: number
  source: EventLocation | 'palette'
}
export interface DragEventData {
  type: 'event'
  eventId: string
  index: number
  blockId: string
}
export interface DragBlock {
  type: 'block'
  blockId: string
  index: number
}
export type DragData = DragGroup | DragJudge | DragDance | DragEventData | DragBlock

/** The payload makeDraggable wants: [which of the items is dragged, the items]. */
export const payload = (data: DragData): [number, DragData[]] => [0, [data]]

/** Drag starts after a few pixels, so clicks still click. */
export const ACTIVATION = { distance: 3 }

/**
 * On touch screens, drag only by the grip (so swiping elsewhere scrolls).
 * With a mouse, the whole item drags.
 */
export function useDragHandle() {
  const coarse = useMediaQuery('(pointer: coarse)')
  return computed(() => (coarse.value ? '[data-grip]' : ''))
}

/**
 * A grip's touch target: 44px square around it on touch screens, without
 * moving anything (the mouse look is unchanged).
 */
export const GRIP_TARGET =
  'pointer-coarse:relative pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:size-11 pointer-coarse:after:-translate-1/2'

/** The kind of item being dragged, and its data, if any. */
export function useDragType() {
  const provider = useDnDProvider()

  const entity = computed(() => {
    if (provider.state.value !== 'dragging') return null
    const el = provider.entities.initiatingDraggable
    return el ? (provider.entities.draggableMap.get(el) ?? null) : null
  })
  const activeDragGroup = computed(() => entity.value?.groups?.[0] ?? null)
  const activeDragPayload = computed<DragData | null>(() => {
    const p = entity.value?.payload?.()
    return (p?.[1]?.[0] as DragData | undefined) ?? null
  })
  const pointer = computed(() => provider.pointer.value?.current)

  return { provider, activeDragGroup, activeDragPayload, pointer }
}

/**
 * End a drag cleanly when the gesture is cut short. The drag kit only listens
 * for the pointer coming up, so after a cancelled touch (an incoming call, an
 * edge swipe), switching away, or a mouse released over another window, the
 * dragged item kept floating and the next tap anywhere dropped it. Call once,
 * inside the DnDProvider.
 *
 * (Not lostpointercapture: the kit never captures the pointer, and a touch's
 * own capture is let go after every lift, drops included.)
 */
export function useDragInterrupts() {
  const provider = useDnDProvider()
  const active = () => provider.state.value === 'dragging' || provider.state.value === 'activating'

  // The kit has no cancel to call, so go through its own ways out: Escape
  // puts a drag back, and a lift before it has started just forgets it.
  // (Neither bubbles, so only listeners on the document itself see them.)
  function abort() {
    if (provider.state.value === 'dragging') {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }))
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape' }))
    } else if (provider.state.value === 'activating') {
      document.dispatchEvent(new PointerEvent('pointerup', { isPrimary: true }))
    }
  }
  useEventListener(document, 'pointercancel', (e) => e.isPrimary && abort())
  useEventListener(document, 'visibilitychange', () => document.hidden && abort())
  useEventListener(window, 'blur', abort)

  // Nor does it tell pointers apart: a second finger mid-drag took the item
  // over. Keep it with the first until it lands.
  for (const type of ['pointerdown', 'pointermove', 'pointerup'] as const)
    useEventListener(
      window,
      type,
      (e) => {
        if (e.isPrimary === false && active()) e.stopImmediatePropagation()
      },
      { capture: true },
    )
}

/**
 * Scroll `el` while something is dragged near its edges, faster nearer the
 * edge. (The drag kit's own auto-scroll only runs while the container is
 * itself the drop target; here the targets are inside it, so it never did,
 * and on a phone nothing below the fold could be reached.)
 */
export function useEdgeScroll(el: Ref<HTMLElement | null>, edge = 48, speed = 16) {
  const provider = useDnDProvider()
  let frame = 0
  function step() {
    const box = el.value?.getBoundingClientRect()
    const p = provider.pointer.value?.current
    if (el.value && box && p && p.x >= box.left && p.x <= box.right && p.y >= box.top && p.y <= box.bottom) {
      const by = (near: number) => (near < edge ? Math.ceil(((edge - near) / edge) * speed) : 0)
      const dy = by(box.bottom - p.y) - by(p.y - box.top)
      const dx = by(box.right - p.x) - by(p.x - box.left)
      if (dx || dy) el.value.scrollBy(dx, dy)
    }
    frame = requestAnimationFrame(step)
  }
  watch(
    () => provider.state.value === 'dragging',
    (dragging) => {
      cancelAnimationFrame(frame)
      if (dragging) frame = requestAnimationFrame(step)
    },
  )
  onScopeDispose(() => cancelAnimationFrame(frame))
}

/** Where in a list of elements the pointer would insert (by their midpoints). */
export function insertIndex(
  container: HTMLElement | null,
  selector: string,
  at: number,
  axis: 'x' | 'y' = 'y',
): number | undefined {
  if (!container) return undefined
  const els = container.querySelectorAll(selector)
  for (let i = 0; i < els.length; i++) {
    const r = els[i].getBoundingClientRect()
    if (axis === 'y' ? at < r.top + r.height / 2 : at < r.left + r.width / 2) return i
  }
  return els.length
}

/** An index after removing the dragged item from before it. */
export const adjust = (to: number, from: number) => (to > from ? to - 1 : to)

/**
 * Where to draw the line showing where a drop would land: between the
 * elements matching `selector` in `container`, before the one at `index` (or
 * after the last). Drawn as one line that glides from gap to gap.
 */
export function dropLine(container: HTMLElement | null, selector: string, index: number) {
  if (!container || index < 0) return null
  const els = [...container.querySelectorAll<HTMLElement>(selector)]
  const top = container.getBoundingClientRect().top
  const at = els[index]?.getBoundingClientRect()
  const before = els[index - 1]?.getBoundingClientRect()
  const y = at && before ? (before.bottom + at.top) / 2 : at ? at.top - 2 : before ? before.bottom + 2 : top + 4
  return { transform: `translateY(${Math.round(y - top - 1)}px)` }
}
