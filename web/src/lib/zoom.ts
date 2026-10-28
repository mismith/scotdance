// Pinch-zoom maths for the sheet viewer (components/SheetViewer.vue). A
// picture is fitted inside a stage, then scaled about the stage's centre
// and moved by (x, y): a point p of the fitted picture (from its centre)
// shows at (x, y) + scale × p from the stage's centre.

export interface Size {
  width: number
  height: number
}
export interface Point {
  x: number
  y: number
}
export interface View extends Point {
  scale: number
}

export const FITTED: View = { scale: 1, x: 0, y: 0 }

/** The picture's size when it just fits inside `room`. */
export function fit(picture: Size, room: Size): Size {
  if (!picture.width || !picture.height || room.width <= 0 || room.height <= 0) return { width: 0, height: 0 }
  const k = Math.min(room.width / picture.width, room.height / picture.height)
  return { width: picture.width * k, height: picture.height * k }
}

/** How far it can move each way at `scale` before an edge comes away from the stage's. */
export function bounds(fitted: Size, stage: Size, scale: number): Point {
  return {
    x: Math.max(0, (fitted.width * scale - stage.width) / 2),
    y: Math.max(0, (fitted.height * scale - stage.height) / 2),
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** The same view, kept within 1..max and its bounds. Back at 1, it's centred. */
export function clampView(view: View, fitted: Size, stage: Size, max: number): View {
  const scale = clamp(view.scale, 1, max)
  if (scale <= 1.001) return { ...FITTED }
  const b = bounds(fitted, stage, scale)
  return { scale, x: clamp(view.x, -b.x, b.x), y: clamp(view.y, -b.y, b.y) }
}

/** Zoom to `scale`, keeping whatever is under `at` (from the stage's centre) under it. */
export function zoomAt(view: View, scale: number, at: Point): View {
  const k = scale / view.scale
  return { scale, x: at.x - (at.x - view.x) * k, y: at.y - (at.y - view.y) * k }
}

/** Past an edge a drag gives way less and less, as iOS lists do. */
export function rubber(over: number, size: number): number {
  if (!size) return 0
  const sign = Math.sign(over)
  const d = Math.abs(over)
  return sign * (1 - 1 / ((d * 0.55) / size + 1)) * size
}

/** A pan position, eased once it's past its bound. */
export function eased(value: number, bound: number, size: number): number {
  if (value > bound) return bound + rubber(value - bound, size)
  if (value < -bound) return -bound + rubber(value + bound, size)
  return value
}

/** A scale, eased once it's past 1 or `max` (a pinch can overshoot either, a little). */
export function easedScale(scale: number, max: number): number {
  if (scale > max) return max * (1 + rubber(scale / max - 1, 1) * 0.5)
  if (scale < 1) return 1 - rubber(1 - scale, 1) * 0.5
  return scale
}
