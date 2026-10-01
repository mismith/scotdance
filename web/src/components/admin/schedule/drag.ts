import { computed } from 'vue'
import { useDnDProvider } from '@vue-dnd-kit/core'
import { useMediaQuery } from '@vueuse/core'
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
