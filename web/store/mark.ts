// Scott exactly as the logo draws him (src/lib/scott.ts): four limbs LIMB
// long and WIDTH thick with square-cut ends, meeting at a round hub, his head
// a dot NECK above it. Arms are straight, as in the mark; legs can bend at
// the knee, as in the launch's leap. How he acts is up to the strategy
// (shots.ts), not to new joints.
//
// Bearings are clockwise from straight up: 0 up, 90 right, 180 down, 270
// left. SVG space: x right, y down, his hub at the origin.
import { HEAD_R, LIMB, WIDTH, pose as launch } from '../src/lib/scott.ts'

const NECK = 171
const HUB = WIDTH / 2 + 4
const HALF = LIMB / 2

export interface Point {
  x: number
  y: number
}

/** A leg: one bearing (straight), or thigh and shin bearings (a bent knee). */
export type Leg = number | [number, number]

export interface Act {
  arms: [number, number]
  legs: [Leg, Leg]
  /** The head's bearing from the hub (0, straight up, as the logo). */
  head?: number
  /** How far the head floats, as a share of the logo's. */
  neck?: number
  /** Turn all of him, degrees clockwise, about the hub. */
  turn?: number
  /** Squash and stretch, in his own frame: [across, along]. Lengths change; the weight of his lines doesn't. */
  stretch?: [number, number]
}

export interface Joints {
  hub: Point
  hands: Point[]
  legs: { knee: Point; foot: Point }[]
  head: Point
}

const rad = (d: number) => (d * Math.PI) / 180
const dir = (bearing: number): Point => ({
  x: Math.sin(rad(bearing)),
  y: -Math.cos(rad(bearing)),
})
const at = (p: Point, d: Point, len: number): Point => ({
  x: p.x + d.x * len,
  y: p.y + d.y * len,
})

export function joints(a: Act): Joints {
  const o = { x: 0, y: 0 }
  const hands = a.arms.map((b) => at(o, dir(b), LIMB))
  const legs = a.legs.map((l) => {
    const [t, s] = typeof l === 'number' ? [l, l] : l
    const knee = at(o, dir(t), HALF)
    return { knee, foot: at(knee, dir(s), HALF) }
  })
  const head = at(o, dir(a.head ?? 0), NECK * (a.neck ?? 1))
  return move({ hub: o, hands, legs, head }, a.stretch, a.turn)
}

/** The launch's leap at `c` seconds (0, and the end of the leap, are the logo), as joints about the hub. */
export function leap(c: number): Joints {
  const p = launch(c)
  const to = (q: Point): Point => ({ x: q.x - p.hip.x, y: q.y - p.hip.y })
  return {
    hub: { x: 0, y: 0 },
    hands: p.hands.map(to),
    legs: p.legs.map((l) => ({ knee: to(l.knee), foot: to(l.foot) })),
    head: to(p.head),
  }
}

/** Stretch (in his own frame) and turn a set of joints about the hub. */
export function move(j: Joints, stretch?: [number, number], turn?: number): Joints {
  const [sx, sy] = stretch ?? [1, 1]
  const c = Math.cos(rad(turn ?? 0))
  const s = Math.sin(rad(turn ?? 0))
  const f = (p: Point): Point => {
    const x = p.x * sx
    const y = p.y * sy
    return { x: x * c - y * s, y: x * s + y * c }
  }
  return {
    hub: j.hub,
    hands: j.hands.map(f),
    legs: j.legs.map((l) => ({ knee: f(l.knee), foot: f(l.foot) })),
    head: f(j.head),
  }
}

const n = (v: number) => v.toFixed(1)
const P = (p: Point) => `${n(p.x)},${n(p.y)}`

/** Scott, as SVG markup about his hub, drawn exactly as the launch draws him. */
export function draw(j: Joints, opts: { ink?: string; opacity?: number } = {}) {
  const ink = opts.ink ?? '#0065bd'
  const limbs = [
    ...j.legs.map((l) => `${P(j.hub)} ${P(l.knee)} ${P(l.foot)}`),
    ...j.hands.map((h) => `${P(j.hub)} ${P(h)}`),
  ]
  return (
    `<g${opts.opacity != null ? ` opacity="${opts.opacity}"` : ''}>` +
    `<g fill="none" stroke="${ink}" stroke-width="${WIDTH}" stroke-linejoin="round">${limbs.map((p) => `<polyline points="${p}"/>`).join('')}</g>` +
    `<circle cx="${n(j.hub.x)}" cy="${n(j.hub.y)}" r="${HUB}" fill="${ink}"/>` +
    `<circle cx="${n(j.head.x)}" cy="${n(j.head.y)}" r="${HEAD_R}" fill="${ink}"/>` +
    `</g>`
  )
}

/** The box he fills (square ends and head included). */
export function box(j: Joints) {
  const pts = [j.hub, ...j.hands, ...j.legs.flatMap((l) => [l.knee, l.foot])]
  const w = WIDTH / 2
  const xs = [
    ...pts.map((p) => p.x - w),
    ...pts.map((p) => p.x + w),
    j.head.x - HEAD_R,
    j.head.x + HEAD_R,
  ]
  const ys = [
    ...pts.map((p) => p.y - w),
    ...pts.map((p) => p.y + w),
    j.head.y - HEAD_R,
    j.head.y + HEAD_R,
  ]
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}
