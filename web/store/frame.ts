// A phone for the store art, drawn in HTML: a titanium band, a black bezel,
// the screen with its status bar and home indicator, and the side buttons,
// lit from the top left. Our own drawing, not Apple's bezel artwork, so Scott
// and the props can overlap it (Apple's licence forbids that on theirs).
import type { Device } from './devices.ts'

/** The status bar's clock: the afternoon of the demo day (demo.ts), with the World finals under way. */
export const CLOCK = { time: '2:41', day: 'Sat Aug 29' }

export type Finish = 'natural' | 'white' | 'black'

const METAL: Record<
  Finish,
  { band: string; edge: string; button: string; side: string }
> = {
  natural: {
    band: 'linear-gradient(135deg,#f3f2ef 0%,#b9b8b3 22%,#e9e8e4 46%,#9c9b96 70%,#d6d5d0 100%)',
    edge: 'rgba(255,255,255,.75)',
    button: 'linear-gradient(90deg,#8e8d88,#d4d3ce 50%,#8e8d88)',
    side: '#a9a8a3',
  },
  white: {
    band: 'linear-gradient(135deg,#ffffff 0%,#d9dadc 24%,#f6f6f7 48%,#c4c6c9 72%,#eceded 100%)',
    edge: 'rgba(255,255,255,.9)',
    button: 'linear-gradient(90deg,#b8babd,#f1f2f3 50%,#b8babd)',
    side: '#c9cbce',
  },
  black: {
    band: 'linear-gradient(135deg,#6b6d72 0%,#2c2e33 24%,#55575c 48%,#232428 72%,#4a4c51 100%)',
    edge: 'rgba(255,255,255,.28)',
    button: 'linear-gradient(90deg,#26282c,#5d5f64 50%,#26282c)',
    side: '#3a3c40',
  },
}

export interface Phone {
  /** Its top left and width, in the slot's pixels (the band's outer edge). */
  x: number
  y: number
  w: number
  img: string
  device: Device
  finish?: Finish
  /** Turn it in space: degrees about the vertical (y) and horizontal (x) axes, and in the plane (z). */
  tilt?: { y?: number; x?: number; z?: number }
  /** How strong its shadow is, 0 to 1. */
  lift?: number
  /** The shadow's colour, as "r,g,b": tinted to the background it falls on. */
  shade?: string
  z?: number
}

/** The phone's height for a width, and the screen's own box inside it. */
export function phoneBox(w: number, device: Device) {
  const band = w * 0.0095
  const bezel = w * 0.0155
  const sw = w - 2 * (band + bezel)
  const sh = (sw * device.viewport.height) / device.viewport.width
  return { band, bezel, sw, sh, h: sh + 2 * (band + bezel) }
}

export function phone({
  x,
  y,
  w,
  img,
  device,
  finish = 'natural',
  tilt = {},
  lift = 1,
  shade = '16,24,40',
  z = 2,
}: Phone) {
  const { band, bezel, sw, sh, h } = phoneBox(w, device)
  const k = sw / device.viewport.width
  const r = device.radius * k
  const metal = METAL[finish]
  const t = `perspective(${(w * 7).toFixed(0)}px) rotateY(${tilt.y ?? 0}deg) rotateX(${tilt.x ?? 0}deg) rotate(${tilt.z ?? 0}deg)`
  const turned = Boolean(tilt.y || tilt.x)
  const depth = w * 0.075
  const slices = turned
    ? Array.from(
        { length: 14 },
        (_, i) =>
          `<div style="position:absolute;inset:0;border-radius:${(r + bezel + band).toFixed(1)}px;background:${metal.side};transform:translateZ(${((-(i + 1) * depth) / 14).toFixed(1)}px)"></div>`,
      ).join('')
    : ''
  const pt = (n: number) => `${(n * k).toFixed(1)}px`
  const btn = (side: 'left' | 'right', top: number, len: number) =>
    `<div style="position:absolute;${side}:${(-w * 0.0055).toFixed(1)}px;top:${(h * top).toFixed(1)}px;width:${(w * 0.0085).toFixed(1)}px;height:${(h * len).toFixed(1)}px;border-radius:${(w * 0.004).toFixed(1)}px;background:${metal.button}"></div>`
  const shadow =
    `0 ${(h * 0.035).toFixed(0)}px ${(h * 0.07).toFixed(0)}px rgba(${shade},${(0.22 * lift).toFixed(2)}),` +
    `0 ${(h * 0.012).toFixed(0)}px ${(h * 0.02).toFixed(0)}px rgba(${shade},${(0.16 * lift).toFixed(2)})`
  return (
    `<div style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;transform:${t};transform-origin:50% 40%;transform-style:preserve-3d;z-index:${z}">` +
    slices +
    // Buttons first, so the band covers their inner ends.
    btn('left', 0.155, 0.032) +
    btn('left', 0.215, 0.058) +
    btn('left', 0.285, 0.058) +
    btn('right', 0.235, 0.09) +
    btn('right', 0.45, 0.05) +
    `<div style="position:absolute;inset:0;border-radius:${(r + bezel + band).toFixed(1)}px;background:${metal.band};padding:${band.toFixed(1)}px;box-shadow:${shadow},inset 0 0 0 ${Math.max(1, w * 0.0012).toFixed(1)}px ${metal.edge}">` +
    `<div style="width:100%;height:100%;border-radius:${(r + bezel).toFixed(1)}px;background:#05070a;padding:${bezel.toFixed(1)}px;box-shadow:inset 0 0 0 ${Math.max(1, w * 0.001).toFixed(1)}px rgba(255,255,255,.08)">` +
    `<div style="position:relative;width:${sw.toFixed(1)}px;height:${sh.toFixed(1)}px;border-radius:${r.toFixed(1)}px;overflow:hidden;background:#f2f4f7 url('${img}') 0 0/100% 100% no-repeat">` +
    statusBar(device, k) +
    // The Dynamic Island, the home indicator, and a whisper of glass.
    (device.id === 'iphone'
      ? `<div style="position:absolute;top:${pt(11)};left:50%;width:${pt(126)};height:${pt(37)};margin-left:${pt(-63)};border-radius:${pt(19)};background:#000"></div>` +
        `<div style="position:absolute;bottom:${pt(8)};left:50%;width:${pt(140)};height:${pt(5)};margin-left:${pt(-70)};border-radius:${pt(3)};background:#101828"></div>`
      : '') +
    `<div style="position:absolute;inset:0;background:linear-gradient(125deg,rgba(255,255,255,.1) 0%,rgba(255,255,255,0) 34%)"></div>` +
    `</div></div></div></div>`
  )
}

export function statusBar(device: Device, k: number, ink = '#101828') {
  // k: pixels per point on this screen.
  const pt = (n: number) => `${(n * k).toFixed(1)}px`
  const top = device.id === 'iphone' ? 21 : device.id === 'ipad' ? 6 : 9
  const time = `<span style="font:600 ${pt(device.id === 'ipad' ? 13 : 17)}/1 -apple-system,system-ui;letter-spacing:-0.01em">${CLOCK.time}</span>`
  const day =
    device.id === 'ipad'
      ? `<span style="font:600 ${pt(13)}/1 -apple-system,system-ui;margin-left:${pt(6)}">${CLOCK.day}</span>`
      : ''
  const signal = `<svg width="${pt(18)}" height="${pt(12)}" viewBox="0 0 18 12"><g fill="${ink}"><rect x="0" y="7.5" width="3" height="4.5" rx="0.8"/><rect x="5" y="5" width="3" height="7" rx="0.8"/><rect x="10" y="2.5" width="3" height="9.5" rx="0.8"/><rect x="15" y="0" width="3" height="12" rx="0.8"/></g></svg>`
  const wifi = `<svg width="${pt(17)}" height="${pt(12)}" viewBox="0 0 17 12"><g fill="${ink}"><path d="M8.5 2.6c2.4 0 4.6.9 6.3 2.5l1.3-1.4C14 1.6 11.4.5 8.5.5S3 1.6.9 3.7l1.3 1.4C3.9 3.5 6.1 2.6 8.5 2.6z"/><path d="M8.5 6.3c1.4 0 2.7.5 3.7 1.4l1.3-1.4C12.2 5 10.4 4.2 8.5 4.2S4.8 5 3.5 6.3l1.3 1.4c1-.9 2.3-1.4 3.7-1.4z"/><path d="M8.5 9.9l2.2-2.3a3.2 3.2 0 0 0-4.4 0z"/></g></svg>`
  const battery = `<svg width="${pt(27)}" height="${pt(13)}" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.8" fill="none" stroke="${ink}" stroke-opacity="0.4"/><rect x="2" y="2" width="20" height="9" rx="2.5" fill="${ink}"/><path d="M25 4.5v4c.8-.3 1.5-1.1 1.5-2s-.7-1.7-1.5-2z" fill="${ink}" fill-opacity="0.4"/></svg>`
  const androidIcons = `<svg width="${pt(15)}" height="${pt(15)}" viewBox="0 0 15 15"><path d="M7.5 13.5L.5 4.6C2.4 3 4.8 2 7.5 2s5.1 1 7 2.6z" fill="${ink}"/></svg><svg width="${pt(14)}" height="${pt(14)}" viewBox="0 0 14 14"><path d="M13 13H1L13 1z" fill="${ink}"/></svg><svg width="${pt(8)}" height="${pt(14)}" viewBox="0 0 8 14"><rect x="0" y="1.5" width="8" height="12.5" rx="1.3" fill="${ink}"/><rect x="2.5" y="0" width="3" height="2" fill="${ink}"/></svg>`
  const right =
    device.platform === 'android'
      ? androidIcons
      : device.id === 'ipad'
        ? wifi + battery
        : signal + wifi + battery
  const left = device.platform === 'android' ? 22 : device.id === 'iphone' ? 46 : 20
  return (
    `<div style="position:absolute;inset:${pt(top)} ${pt(device.id === 'iphone' ? 34 : 20)} auto ${pt(left)};display:flex;align-items:center;justify-content:space-between;color:${ink};z-index:2">` +
    `<div style="display:flex;align-items:baseline">${time}${day}</div><div style="display:flex;gap:${pt(device.platform === 'android' ? 5 : 6)};align-items:center">${right}</div></div>`
  )
}
