// The store shots, in order. The first three are what search results show,
// so they tell one day at a competition (the World Championship final at
// Cowal, demo.ts): the result lands, who's on next, and when. The rest go
// feature by feature, and the last is the sign-off.
//
// Headlines are two lines, broken where written; subtitles one short line.
// The copy reuses the app's own lines (About) where they fit.
//
// Every slot has one big thing beside its phone: the app's own objects at
// poster size (a 1st-place rosette, the number cards, the Next chip, the
// date tile, rosettes, a schedule chip mid-drag). Scott only ever appears as
// the logo itself: in the app's lockup on the first slot, and big in the
// confetti on the last. His leap is saved for the app's own launch.
import type { Ctx, Decor } from './compose.ts'
import { box, joints, leap } from './mark.ts'
import { dateTile, dragChip, nextChip, numberCard, rosette, scott } from './props.ts'

export interface Shot {
  scene: string
  title: string
  sub?: string
  /** The app's lockup (Scott as the logo, and "ScotDance.app") above the headline. */
  brand?: boolean
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

// Confetti, seeded so every run is the same: scattered through a band (the
// open space round the mark), never inside `skip` (the mark itself),
// thicker near it.
const CONFETTI = ['#ffffff', '#ffd34d', '#7ee0e6', '#ff9ccb', '#ffb36b', '#c8b2ff']
interface Area {
  x: number
  y: number
  w: number
  h: number
}
function confetti(band: Area, skip: Area, size: number, count = 24) {
  let seed = 11
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const cx = skip.x + skip.w / 2
  const bits: string[] = []
  for (let tries = 0, n = 0; n < count && tries < 6000; tries++) {
    const x = band.x + rand() * band.w
    const y = band.y + rand() * band.h
    const inSkip =
      x > skip.x - size &&
      x < skip.x + skip.w + size &&
      y > skip.y - size &&
      y < skip.y + skip.h + size
    // Thicker near it: farther out, fewer survive.
    if (inSkip || rand() > 1 - Math.min(0.8, Math.abs(x - cx) / band.w)) continue
    const w = size * (0.7 + rand() * 0.6)
    const colour = CONFETTI[n++ % CONFETTI.length]
    bits.push(
      rand() < 0.35
        ? `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(w / 2).toFixed(1)}" fill="${colour}"/>`
        : `<rect x="${(x - w / 2).toFixed(0)}" y="${(y - w * 1.1).toFixed(0)}" width="${w.toFixed(1)}" height="${(w * 2.2).toFixed(1)}" rx="${(w / 3).toFixed(1)}" fill="${colour}" transform="rotate(${(rand() * 180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`,
    )
  }
  return bits.join('')
}

/** Slot 1: a giant 1st-place rosette hanging off the phone's right edge, beside Freya's 1st. */
export const firstPlace: Decor = {
  layer: 'front',
  draw: (c) => {
    const p = at(c)
    const size = p.u(0.44)
    const rx = inside(c, p.R(-0.02), size / 2)
    const ry = p.T(0.72)
    return `<g transform="rotate(10 ${rx.toFixed(0)} ${ry.toFixed(0)})">${rosette(rx, ry, size)}</g>`
  },
}

/** The last slot: the logo, big, above the phone, in a burst of confetti. */
export const finaleLogo: Decor = {
  layer: 'front',
  draw: (c) => {
    const p = at(c)
    const j = leap(0)
    const b = box(j)
    const top = c.words + p.u(0.06)
    const k = Math.min((0.5 * c.W) / b.w, (p.T(-0.06) - top) / b.h)
    const hx = c.W / 2
    const hy = top - b.y * k
    const w = b.w * k
    return (
      confetti(
        {
          x: Math.max(c.W * 0.04, hx - w * 1.1),
          y: c.words + p.u(0.02),
          w: Math.min(c.W * 0.92, w * 2.2),
          h: p.T(-0.02) - c.words - p.u(0.02),
        },
        { x: hx + b.x * k, y: hy + b.y * k, w, h: b.h * k },
        p.u(0.026),
      ) + scott(j, hx, hy, k, { ink: '#ffffff' })
    )
  },
}

/** The last slot, the other way: Scott's star jump above the phone, wearing his number, in confetti. */
export const finaleStar: Decor = {
  layer: 'front',
  draw: (c) => {
    const p = at(c)
    const star = joints({ arms: [313, 47], legs: [244, 116], neck: 1.05 })
    const b = box(star)
    const top = c.words + p.u(0.04)
    const k = Math.min((0.74 * c.W) / b.w, (p.T(0.0) - top) / b.h)
    const hx = c.W / 2
    const hy = top - b.y * k
    const w = b.w * k
    return (
      confetti(
        {
          x: Math.max(c.W * 0.04, hx - w * 0.85),
          y: c.words + p.u(0.02),
          w: Math.min(c.W * 0.92, w * 1.7),
          h: p.T(-0.02) - c.words - p.u(0.02),
        },
        { x: hx + b.x * k, y: hy + b.y * k, w, h: b.h * k },
        p.u(0.026),
        20,
      ) +
      scott(star, hx, hy, k, { ink: '#ffffff' }) +
      numberCard(hx + 8 * k, hy + 34 * k, 215 * k, '145', '#00707a', -6)
    )
  },
}

/** Slot 2: the three dancers' number cards, big, in their colours, over the phone's top. */
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

/** Slot 3: the amber Next chip, poster size, across the phone's top. */
export const next: Decor = {
  layer: 'front',
  draw: (c) => {
    const p = at(c)
    return nextChip(
      inside(c, p.L(0.42), p.u(0.42)),
      p.T(0.05),
      p.u(0.16),
      'Next · Platform A',
      -6,
    )
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
    scene: 'results',
    title: 'Results,\nas they happen',
    sub: 'No more waiting by the results board.',
    brand: true,
    phone: { dx: -0.03, dy: 0.02 },
    decor: [firstPlace],
  },
  {
    scene: 'home',
    title: 'Follow\nyour dancers',
    sub: 'Your dancer, or your whole studio, at a glance.',
    phone: { dy: 0.05 },
    decor: [cards],
  },
  {
    scene: 'schedule',
    title: 'Know when\nthey’re on',
    sub: 'See who’s dancing next, and where.',
    phone: { dx: 0.04, dy: 0.05, tilt: { y: 11, z: 2 } },
    decor: [next],
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
    title: 'From the warm-up\nto the awards',
    sub: 'Made by a Highland dance family, for yours.',
    phone: { dy: 0.17 },
    decor: [finaleLogo],
  },
]
