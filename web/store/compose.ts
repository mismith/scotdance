// The art for one device: every shot side by side on one long strip.
// render.ts cuts the strip into the store's slots.
//
// Each slot is painted in one of the dancer colours (style.css), deep, with
// soft glows of its own and the next slot's colour, so the set reads as a
// run of bold colours in a store's search results. Type, phone and Scott go
// white on it. A shot's decor (Scott, the app's props) draws behind or in
// front of its phone.
import type { Device } from './devices.ts'
import { phone, phoneBox } from './frame.ts'
import { box, draw, leap } from './mark.ts'
import type { Shot } from './shots.ts'

const FONT = new URL(
  '../node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2',
  import.meta.url,
).href

// The dancer colours (style.css), deep (light mode) and luminous (dark mode).
const DEEP = {
  blue: '#0065bd',
  teal: '#00707a',
  pink: '#b0266e',
  orange: '#b04a00',
  purple: '#6a3fa0',
  green: '#1d6a48',
}
const GLOW = {
  blue: '#62aaf0',
  teal: '#3fc2c9',
  pink: '#ec6fae',
  orange: '#f28a3c',
  purple: '#9b75d6',
  green: '#3fa676',
}
type Hue = keyof typeof DEEP

/** Each slot's colour, in order. */
const HUES: Hue[] = ['blue', 'teal', 'pink', 'orange', 'purple', 'green', 'blue']

/** How one slot is painted. */
export interface Paint {
  /** The field, as CSS backgrounds (top layer first). */
  field: string
  ink: string
  muted: string
  /** Shadows, as "r,g,b", tinted to the field. */
  shade: string
}

const hex = (h: string, a: number) =>
  h +
  Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, '0')

export function paint(i: number): Paint {
  const h = HUES[i % HUES.length]
  const next = HUES[(i + 1) % HUES.length]
  const deep = DEEP[h]
  return {
    field:
      `radial-gradient(60% 34% at 50% 58%, ${hex(GLOW[h], 0.6)}, ${hex(GLOW[h], 0)} 70%),` +
      `radial-gradient(55% 30% at 94% 10%, ${hex(GLOW[next], 0.45)}, ${hex(GLOW[next], 0)} 70%),` +
      `radial-gradient(60% 34% at 2% 90%, ${hex('#ffffff', 0.16)}, ${hex('#ffffff', 0)} 70%),` +
      `linear-gradient(170deg, ${deep} 0%, color-mix(in oklab, ${deep} 82%, black) 100%)`,
    ink: '#ffffff',
    muted: 'rgba(255,255,255,.86)',
    shade: '10,16,30',
  }
}

export interface Raw {
  png: string
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** What a shot's decor draws with: its slot, the phone's box in the slot's own pixels, and its paint. */
export interface Ctx {
  W: number
  H: number
  /** The phone's outer edge, as laid out (before any turn). */
  r: Rect
  /** Scott's measure: a phone screen's width, or as much of a tablet's, so he's the same size on any device. */
  u: number
  device: Device
  paint: Paint
  /** Where the words end, in the slot's pixels. */
  words: number
}

export interface Decor {
  layer: 'back' | 'front'
  draw: (c: Ctx) => string
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/** The brand lockup's height (the mark and "ScotDance.app"), and the gap under it. */
const lockup = (device: Device) => device.art.title * 0.86

/** The sign-off's logo: its height, and the gap under it. */
const signMark = (device: Device) => device.art.title * 2.1
const signGap = (device: Device) => device.art.title * 0.42

/** Where the words end: the top margin, the lockup or sign-off logo if any, the title (one line on a sign-off, else two), a gap, one line of subtitle. */
export const wordsEnd = (device: Device, shot?: Shot) => {
  const { art } = device
  if (shot?.signoff) return art.top + signMark(device) + signGap(device) + art.title + art.sub * 1.95
  return (
    art.top + (shot?.brand ? lockup(device) : 0) + art.title * 1.0 * 2 + art.sub * 1.95
  )
}

/** Where a shot's phone sits, in its slot's own pixels. */
function place(device: Device, shot: Shot): Rect {
  const { slot, art } = device
  const p = shot.phone ?? {}
  const w = art.screen * (p.scale ?? 1)
  const h = phoneBox(w, device).h
  const y = wordsEnd(device, shot) + art.title * 0.42 + (p.dy ?? 0) * slot.height
  return { x: (slot.width - w) / 2 + (p.dx ?? 0) * slot.width, y, w, h }
}

/** The app's lockup (the sidebar's): Scott as the logo, and "ScotDance.app", in white. */
function brand(device: Device) {
  const mark = device.art.title * 0.5
  const j = leap(0)
  const b = box(j)
  const k = mark / Math.max(b.w, b.h)
  const svg =
    `<svg width="${(b.w * k).toFixed(0)}" height="${(b.h * k).toFixed(0)}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}">` +
    `${draw(j, { ink: '#ffffff' })}</svg>`
  return `<div class="brand" style="height:${mark}px;margin-bottom:${(lockup(device) - mark).toFixed(0)}px;gap:${(mark * 0.32).toFixed(0)}px;font-size:${(mark * 0.62).toFixed(0)}px">${svg}<span>ScotDance.app</span></div>`
}

/** The sign-off's logo: Scott as the logo, white, big, over the app's name. */
function signoff(device: Device) {
  const h = signMark(device)
  const j = leap(0)
  const b = box(j)
  return (
    `<div style="height:${h.toFixed(0)}px;margin-bottom:${signGap(device).toFixed(0)}px">` +
    `<svg width="${((b.w / b.h) * h).toFixed(0)}" height="${h.toFixed(0)}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}">${draw(j, { ink: '#ffffff' })}</svg></div>`
  )
}

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

export function compose(device: Device, shots: Shot[], raws: Record<string, Raw>) {
  const { width: W, height: H } = device.slot
  const { art } = device
  const parts: string[] = []
  shots.forEach((shot, i) => {
    const raw = raws[shot.scene]
    if (!raw) throw new Error(`No capture for "${shot.scene}" on ${device.id}`)
    const pt = paint(i)
    const r = place(device, shot)
    const left = i * W
    const ctx: Ctx = {
      W,
      H,
      r,
      u: Math.min(r.w, ((r.w * device.viewport.height) / device.viewport.width) * 0.46),
      device,
      paint: pt,
      words: wordsEnd(device, shot),
    }
    const layer = (which: Decor['layer'], z: number) => {
      const svg = (shot.decor ?? [])
        .filter((d) => d.layer === which)
        .map((d) => d.draw(ctx))
        .join('')
      return svg
        ? `<svg class="layer ${which}" style="z-index:${z};--shade:${pt.shade}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>`
        : ''
    }
    // Each slot is its own painted frame: nothing crosses into the next.
    parts.push(
      `<section class="slot" style="left:${left}px;background:${pt.field}">` +
        `<header style="left:${art.side}px;top:${art.top}px;width:${W - art.side * 2}px;color:${pt.ink}">` +
        (shot.brand ? brand(device) : '') +
        (shot.signoff ? signoff(device) : '') +
        `<h1>${esc(shot.title)
          .split('\n')
          .map((l) => `<span class="ln">${l}</span>`)
          .join('<br>')}</h1>` +
        (shot.sub
          ? `<p style="font-size:${art.sub}px;color:${pt.muted}">${esc(shot.sub)}</p>`
          : '') +
        `</header>` +
        layer('back', 1) +
        phone({
          x: r.x,
          y: r.y,
          w: r.w,
          img: raw.png,
          device,
          finish: 'white',
          tilt: shot.phone?.tilt,
          lift: 1.5,
          shade: pt.shade,
        }) +
        layer('front', 4) +
        `<div class="grain"></div>` +
        `</section>`,
    )
  })
  // Headlines: one size for the whole set, as big as the longest line allows, at most art.title.
  const fit = `<script>
document.fonts.ready.then(() => {
  const lines = [...document.querySelectorAll('h1 .ln')]
  const room = ${W - art.side * 2}
  const probe = 100
  document.querySelectorAll('h1').forEach((h) => (h.style.fontSize = probe + 'px'))
  const widest = Math.max(...lines.map((l) => l.getBoundingClientRect().width))
  const size = Math.min(${art.title}, Math.floor((probe * room) / widest))
  document.querySelectorAll('h1').forEach((h) => (h.style.fontSize = size + 'px'))
  document.body.dataset.ready = '1'
})
</script>`
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Atkinson;src:url('${FONT}') format('woff2');font-weight:200 800}
*{box-sizing:border-box}
html,body{margin:0}
#strip{position:relative;width:${W * shots.length}px;height:${H}px;overflow:hidden}
.slot{position:absolute;top:0;width:${W}px;height:${H}px;overflow:hidden}
.grain{position:absolute;inset:0;background-image:${GRAIN};background-size:320px;z-index:7;pointer-events:none;opacity:.07;mix-blend-mode:overlay}
.brand{display:flex;align-items:center;justify-content:center;font-weight:650;letter-spacing:-0.01em}
header{position:absolute;z-index:6;font-family:Atkinson,system-ui;text-align:center}
h1{margin:0;font-weight:800;letter-spacing:-0.04em;line-height:1;font-size:${art.title}px}
.ln{white-space:nowrap}
p{margin:${art.sub * 0.55}px 0 0;font-weight:500;letter-spacing:-0.01em;line-height:1.25}
.layer{position:absolute;left:0;top:0;overflow:hidden}
.layer.front{filter:drop-shadow(0 ${(H * 0.008).toFixed(0)}px ${(H * 0.012).toFixed(0)}px rgba(var(--shade),.28))}
</style></head><body><div id="strip">${parts.join('')}</div>${fit}</body></html>`
}

export const loadRaw = (dir: string, scene: string): Raw => ({
  png: `${dir}${scene}.png`,
})
