// Hand-drawn marks for SVG: a felt-tip road that wobbles, pen loops that
// overshoot, lumpy marker dots. Everything is seeded, so a drawing comes out
// the same every time it's drawn.

export interface Pt {
  x: number
  y: number
}

/** A seeded random number generator, 0 to 1. */
export function rng(seed: number) {
  let s = Math.imul(seed, 2654435761) >>> 0 || 1
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296
}

/** A smooth wiggle between about -1 and 1, its own shape for each generator. */
export function noise(r: () => number) {
  const p = [r() * 6.28, r() * 6.28, r() * 6.28]
  return (t: number) =>
    0.5 * Math.sin(t * 0.9 + p[0]) +
    0.3 * Math.sin(t * 2.3 + p[1]) +
    0.2 * Math.sin(t * 5.3 + p[2])
}

const f1 = (n: number) => n.toFixed(1)
export const line = (pts: Pt[]) =>
  'M' + pts.map((p) => `${f1(p.x)} ${f1(p.y)}`).join(' L')

/** Each point's unit normal, from its neighbours. */
export function normals(P: Pt[]): Pt[] {
  return P.map((_, i) => {
    const a = P[Math.max(0, i - 1)]
    const b = P[Math.min(P.length - 1, i + 1)]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const l = Math.hypot(dx, dy) || 1
    return { x: -dy / l, y: dx / l }
  })
}

export interface RoadPoint extends Pt {
  /** Distance along the road. */
  s: number
  /** Which stretch, from stop seg to stop seg + 1. */
  seg: number
}

/**
 * The road through the stops, a soft S between each pair, sampled every few
 * pixels: the points, the index of each stop among them, and how far along
 * the road each stop is.
 */
export function sampleRoad(stops: Pt[]) {
  const P: RoadPoint[] = stops.length ? [{ ...stops[0], s: 0, seg: 0 }] : []
  const at = stops.length ? [0] : []
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    const dy = (b.y - a.y) / 2
    const n = Math.max(4, Math.ceil((Math.hypot(b.x - a.x, b.y - a.y) * 1.2) / 4))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const u = 1 - t
      const x = (u * u * u + 3 * u * u * t) * a.x + (3 * u * t * t + t * t * t) * b.x
      const y =
        u * u * u * a.y +
        3 * u * u * t * (a.y + dy) +
        3 * u * t * t * (b.y - dy) +
        t * t * t * b.y
      const p = P[P.length - 1]
      P.push({ x, y, s: p.s + Math.hypot(x - p.x, y - p.y), seg: i })
    }
    at.push(P.length - 1)
  }
  return { P, at, along: at.map((i) => P[i].s), total: P.at(-1)?.s ?? 0 }
}

/** A line moved side to side a little, as a hand would. */
export function wobble(P: RoadPoint[], amp: number, r: () => number, scale = 22): Pt[] {
  const nz = noise(r)
  const N = normals(P)
  return P.map((p, i) => ({
    x: p.x + N[i].x * amp * nz(p.s / scale),
    y: p.y + N[i].y * amp * nz(p.s / scale),
  }))
}

/** A pen loop: starts anywhere, goes round once and overshoots. */
export function loop(
  c: Pt,
  rx: number,
  ry: number,
  r: () => number,
  over = 0.4,
  tilt = 0,
) {
  const a0 = r() * 6.28
  const nz = noise(r)
  const pts: Pt[] = []
  for (let k = 0; k <= 44; k++) {
    const a = a0 + (k / 44) * (6.283 + over)
    const m = 1 + 0.06 * nz(a * 1.3) + (k / 44) * 0.07
    const x = Math.cos(a) * rx * m
    const y = Math.sin(a) * ry * m
    pts.push({
      x: c.x + x * Math.cos(tilt) - y * Math.sin(tilt),
      y: c.y + x * Math.sin(tilt) + y * Math.cos(tilt),
    })
  }
  return line(pts)
}

/** A marker dot: a slightly lumpy disc. */
export function blob(c: Pt, rad: number, r: () => number, lump = 0.07) {
  const nz = noise(r)
  const n = 22
  const pts = Array.from({ length: n }, (_, k) => {
    const a = (k / n) * 6.283
    const m = 1 + lump * nz(a * 1.7)
    return { x: c.x + Math.cos(a) * rad * m, y: c.y + Math.sin(a) * rad * m }
  })
  let d = `M${f1((pts[0].x + pts[n - 1].x) / 2)} ${f1((pts[0].y + pts[n - 1].y) / 2)}`
  pts.forEach((p, k) => {
    const q = pts[(k + 1) % n]
    d += ` Q${f1(p.x)} ${f1(p.y)} ${f1((p.x + q.x) / 2)} ${f1((p.y + q.y) / 2)}`
  })
  return d + 'Z'
}

/** A stroke across the road at c, along its normal n, slightly bowed. */
export function across(c: Pt, n: Pt, len: number, r: () => number, bend = 1) {
  const t = { x: n.y, y: -n.x }
  const b = (r() - 0.5) * bend
  const a = { x: c.x - (n.x * len) / 2 + t.x * b, y: c.y - (n.y * len) / 2 + t.y * b }
  const z = { x: c.x + (n.x * len) / 2 - t.x * b, y: c.y + (n.y * len) / 2 - t.y * b }
  return `M${f1(a.x)} ${f1(a.y)} Q${f1(c.x + t.x * b * 2)} ${f1(c.y + t.y * b * 2)} ${f1(z.x)} ${f1(z.y)}`
}

/** A quick underline from x0 to x1, dipping a little and lifting at the end. */
export function underline(x0: number, x1: number, y: number) {
  return `M${f1(x0)} ${f1(y + 0.5)} Q${f1((x0 + x1) / 2)} ${f1(y + 2.4)} ${f1(x1)} ${f1(y - 1)}`
}
