// The store shots, in order. The first three are what search results show,
// so they tell one day at a competition (the World Championship final at
// Cowal, demo.ts): who you follow, when they're on, and their results as they
// come in. The rest go feature by feature, and the last is the sign-off.
//
// Headlines are two lines, broken where written; subtitles one short line.
// The copy reuses the app's own lines (About) where they fit.
//
// Every slot has one big thing beside its phone: the app's own objects at
// poster size (the number cards, a dance's start time, a 3rd-place rosette, the
// date tile, rosettes, a schedule chip mid-drag). Scott only ever appears as
// the logo itself: in the app's lockup on the first slot, and big over the
// app's name on the last. His leap is saved for the app's own launch.
import type { Ctx, Decor } from './compose.ts'
import { dateTile, dragChip, numberCard, rosette, whenChip } from './props.ts'

export interface Shot {
  scene: string
  title: string
  sub?: string
  /** The app's lockup (Scott as the logo, and "ScotDance.app") above the headline. */
  brand?: boolean
  /** The sign-off: the logo, big, over the title (the app's name) and subtitle. */
  signoff?: boolean
  /** Moves the phone: dx, dy in slot widths and heights; scale; and a turn in space. */
  phone?: {
    dx?: number
    dy?: number
    scale?: number
    tilt?: { y?: number; x?: number; z?: number }
  }
  decor?: Decor[]
}

// Decor is measured in u, a phone screen's width (compose.ts), from the
// phone's edges, so it's the same size on a phone or a tablet.
const at = (c: Ctx) => ({
  /** From the phone's left edge, in u. */
  L: (d: number) => c.r.x + d * c.u,
  /** From its right edge, in u. */
  R: (d: number) => c.r.x + c.r.w - d * c.u,
  /** From its top edge, in u. */
  T: (d: number) => c.r.y + d * c.u,
  /** A length in u. */
  u: (d: number) => d * c.u,
})

/** Keep a thing `half` wide (each side) inside the slot, with a margin. */
const inside = (c: Ctx, x: number, half: number) =>
  Math.max(half + 0.03 * c.W, Math.min(c.W - half - 0.03 * c.W, x))

/** Slot 3: a giant 3rd-place rosette hanging off the phone's right edge, beside the 3rd place. */
export const thirdPlace: Decor = {
  layer: 'front',
  draw: (c) => {
    const p = at(c)
    const size = p.u(0.44)
    const rx = inside(c, p.R(-0.02), size / 2)
    const ry = p.T(0.975)
    return `<g transform="rotate(10 ${rx.toFixed(0)} ${ry.toFixed(0)})">${rosette(rx, ry, size, '3', 'rd')}</g>`
  },
}

/** Slot 1: the three dancers' number cards, big, in their colours, over the phone's top. */
export const cards: Decor = {
  layer: 'front',
  draw: (c) => {
    const p = at(c)
    const w = p.u(0.36)
    const x = inside(c, c.r.x + c.r.w / 2, w * 1.4)
    const y = p.T(0.02)
    return (
      numberCard(x - w * 0.86, y + w * 0.16, w, '114', '#b0266e', -12) +
      numberCard(x + w * 0.86, y + w * 0.2, w, '145', '#00707a', 10) +
      numberCard(x, y - w * 0.06, w, '170', '#b04a00', -2)
    )
  },
}

/** Slot 2: when a dance starts and where, as a day card has it, poster size across the phone's top. */
export const when: Decor = {
  layer: 'front',
  draw: (c) => {
    const p = at(c)
    return whenChip(inside(c, p.L(0.48), p.u(0.48)), p.T(0.05), p.u(0.15), 'From 12:15 pm · Platform A', -5)
  },
}

/** Slot 4: the date tile, poster size, on the phone's top right: Cowal starts on Thursday the 27th. */
export const date: Decor = {
  layer: 'front',
  draw: (c) => {
    const p = at(c)
    const w = p.u(0.46)
    return dateTile(inside(c, p.R(0.12), w / 2), p.T(0.1), w, 'AUG', '27', 'Thu', 9)
  },
}

/** Slot 5: a fan of her rosettes, poster size, over the phone's top. */
export const rosettes: Decor = {
  layer: 'front',
  draw: (c) => {
    const p = at(c)
    const s = p.u(0.34)
    const x = c.r.x + c.r.w / 2
    const y = p.T(-0.05)
    const one = (dx: number, turn: number, place: string, suffix: string) =>
      `<g transform="rotate(${turn} ${(x + dx * s).toFixed(0)} ${y.toFixed(0)})">${rosette(x + dx * s, y, s, place, suffix)}</g>`
    return one(0.78, 14, '3', 'rd') + one(-0.78, -14, '2', 'nd') + one(0, -2, '1', 'st')
  },
}

/** Slot 6: a dance from the builder's palette, poster size, lifted mid-drag over the phone. */
export const dragging: Decor = {
  layer: 'front',
  draw: (c) => {
    const p = at(c)
    const h = p.u(0.15)
    return dragChip(
      inside(c, p.R(0.3), p.u(0.36)),
      p.T(0.08),
      h,
      'Highland Fling',
      '(4)',
      -7,
    )
  },
}

export const SHOTS: Shot[] = [
  {
    scene: 'home',
    title: 'Follow\nyour dancers',
    sub: 'Your dancer, or your whole studio, at a glance.',
    brand: true,
    phone: { dy: 0.05 },
    decor: [cards],
  },
  {
    scene: 'schedule',
    title: 'Know when\nthey’re on',
    sub: 'Their platform, start time and place in the draw.',
    phone: { dx: 0.04, dy: 0.05, tilt: { y: 11, z: 2 } },
    decor: [when],
  },
  {
    scene: 'results',
    title: 'Results,\nas they happen',
    sub: 'Even when you can’t be there.',
    phone: { dx: -0.03, dy: 0.02 },
    decor: [thirdPlace],
  },
  {
    scene: 'calendar',
    title: 'Find your next\ncompetition',
    sub: 'From local games to the World Championships.',
    phone: { dx: -0.03, dy: 0.05 },
    decor: [date],
  },
  {
    scene: 'dancer',
    title: 'Every result,\non record',
    sub: 'All their placings, season after season.',
    phone: { dy: 0.07, tilt: { y: -10, z: -1.5 } },
    decor: [rosettes],
  },
  {
    scene: 'builder',
    title: 'Run the day,\nwithout the paper',
    sub: 'Build the schedule and post results, for free.',
    phone: { dx: -0.04, dy: 0.05 },
    decor: [dragging],
  },
  {
    scene: 'overview',
    title: 'ScotDance.app',
    sub: 'From the warm-up to the awards',
    signoff: true,
    phone: { dy: 0.02 },
  },
]
