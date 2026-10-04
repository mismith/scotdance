// The app's own objects for the store art, drawn to match the app
// (components/NumberCard.vue, Medal.vue, DateTile.vue, DancerDayCard.vue's
// Next chip, ManageMenu.vue's Saved), and Scott placed in a scene.
import { draw, type Joints } from './mark.ts'

const BLUE = '#0065bd'
const INK = '#101828'
const n = (v: number) => v.toFixed(1)
let uid = 0
const id = (p: string) => `${p}${uid++}`

/** Scott at (x, y) (his hub), k times the logo's size. */
export function scott(
  j: Joints,
  x: number,
  y: number,
  k: number,
  opts: { ink?: string; opacity?: number; turn?: number } = {},
) {
  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${opts.turn ?? 0}) scale(${k})">${draw(j, opts)}</g>`
}

/** The competitor number card: white paper, a band in the dancer's colour, two safety pins, the number. (x, y) is its centre. */
export function numberCard(
  x: number,
  y: number,
  w: number,
  number: string,
  colour = '#00707a',
  turn = 0,
) {
  const h = w * 0.73
  const l = x - w / 2
  const t = y - h / 2
  const pin = (px: number, deg: number) =>
    `<rect x="${n(px - w * 0.1)}" y="${n(t + h * 0.08)}" width="${n(w * 0.2)}" height="${n(w * 0.045)}" rx="${n(w * 0.022)}" fill="#cfd5dc" stroke="rgba(0,0,0,.25)" stroke-width="${n(w * 0.006)}" transform="rotate(${deg} ${n(px)} ${n(t + h * 0.1)})"/>`
  const c = id('nc')
  return (
    `<g transform="rotate(${turn} ${n(x)} ${n(y)})">` +
    `<defs><clipPath id="${c}"><rect x="${n(l)}" y="${n(t)}" width="${n(w)}" height="${n(h)}" rx="${n(w * 0.09)}"/></clipPath></defs>` +
    `<rect x="${n(l)}" y="${n(t + w * 0.02)}" width="${n(w)}" height="${n(h)}" rx="${n(w * 0.09)}" fill="rgba(16,24,40,.12)"/>` +
    `<g clip-path="url(#${c})"><rect x="${n(l)}" y="${n(t)}" width="${n(w)}" height="${n(h)}" fill="#fff"/><rect x="${n(l)}" y="${n(t)}" width="${n(w)}" height="${n(h * 0.24)}" fill="${colour}"/></g>` +
    `<rect x="${n(l)}" y="${n(t)}" width="${n(w)}" height="${n(h)}" rx="${n(w * 0.09)}" fill="none" stroke="#dfe3e8" stroke-width="${n(w * 0.012)}"/>` +
    pin(l + w * 0.2, -24) +
    pin(l + w * 0.8, 24) +
    `<text x="${n(x)}" y="${n(t + h * 0.84)}" text-anchor="middle" font-family="'Atkinson Hyperlegible Next', Atkinson, sans-serif" font-weight="800" font-size="${n(w * 0.44)}" letter-spacing="-0.02em" fill="${INK}">${number}</text></g>`
  )
}

// The rosette's tiers (Medal.vue): a stronger tint, heavier ring and bolder tails the higher the place, and a halo for 1st.
const TIERS: Record<
  string,
  { body: string; ring: number; tails: number; halo: boolean }
> = {
  '1': { body: '#dbe8f5', ring: 2.5, tails: 1, halo: true },
  '2': { body: '#e2edf8', ring: 2, tails: 1, halo: false },
  '3': { body: '#e9f1fa', ring: 1.25, tails: 0.6, halo: false },
  rest: { body: '#f1f6fc', ring: 0.75, tails: 0.3, halo: false },
}

/** The placing rosette, as the app draws it (Medal.vue): blue ink on a blue tint, tails, a halo for 1st. (x, y) is the rosette's centre. */
export function rosette(x: number, y: number, size: number, place = '1', suffix = 'st') {
  const k = size / 34
  const t = TIERS[place] ?? TIERS.rest
  return (
    `<g transform="translate(${n(x - 17 * k)} ${n(y - 15 * k)}) scale(${n(k)})">` +
    `<path d="M11 22 L7 39 L13 35 L16 39 L17 24 Z M23 22 L27 39 L21 35 L18 39 L17 24 Z" fill="${BLUE}" opacity="${t.tails}"/>` +
    (t.halo ? `<circle cx="17" cy="15" r="17" fill="${BLUE}" opacity=".2"/>` : '') +
    `<circle cx="17" cy="15" r="${14 - t.ring / 2}" fill="${t.body}" stroke="${BLUE}" stroke-width="${t.ring}"/>` +
    `<circle cx="17" cy="15" r="10" fill="none" stroke="${BLUE}" stroke-opacity=".35" stroke-dasharray="2 2"/>` +
    `<text x="17" y="15" text-anchor="middle" dominant-baseline="central" font-family="'Atkinson Hyperlegible Next', Atkinson, sans-serif" font-weight="800" font-size="14" fill="${BLUE}">${place}<tspan font-size="8.4" dy="-6.3">${suffix}</tspan></text></g>`
  )
}

/** A competition's date as a little calendar page (DateTile.vue), pink because it's on today. (x, y) is its centre. */
export function dateTile(
  x: number,
  y: number,
  w: number,
  month = 'JUL',
  day = '18',
  weekday = 'Sat',
  turn = 0,
) {
  const h = w * 1.18
  const l = x - w / 2
  const t = y - h / 2
  const font = `font-family="'Atkinson Hyperlegible Next', Atkinson, sans-serif"`
  return (
    `<g transform="rotate(${turn} ${n(x)} ${n(y)})">` +
    `<rect x="${n(l)}" y="${n(t + w * 0.025)}" width="${n(w)}" height="${n(h)}" rx="${n(w * 0.27)}" fill="rgba(16,24,40,.1)"/>` +
    `<rect x="${n(l)}" y="${n(t)}" width="${n(w)}" height="${n(h)}" rx="${n(w * 0.27)}" fill="#fde7f1"/>` +
    `<text x="${n(x)}" y="${n(t + h * 0.27)}" text-anchor="middle" ${font} font-weight="700" font-size="${n(w * 0.2)}" letter-spacing="0.04em" fill="#c8166a">${month}</text>` +
    `<text x="${n(x)}" y="${n(t + h * 0.68)}" text-anchor="middle" ${font} font-weight="800" font-size="${n(w * 0.46)}" letter-spacing="-0.02em" fill="${INK}">${day}</text>` +
    `<text x="${n(x)}" y="${n(t + h * 0.88)}" text-anchor="middle" ${font} font-weight="500" font-size="${n(w * 0.17)}" fill="#4a5466">${weekday}</text></g>`
  )
}

/**
 * A dance still to come, as a dancer's day card has it: a clock, then when
 * its event starts and where ("From 12:15 pm · Platform A"), on paper.
 * (x, y) is its centre.
 */
export function whenChip(x: number, y: number, h: number, label = 'From 12:15 pm · Platform A', turn = 0) {
  const font = `font-family="'Atkinson Hyperlegible Next', Atkinson, sans-serif"`
  const fs = h * 0.42
  const w = h * 1.05 + label.length * fs * 0.5 + h * 0.5
  const l = x - w / 2
  const t = y - h / 2
  const cx = l + h * 0.56
  const r = h * 0.2
  const clock =
    `<circle cx="${n(cx)}" cy="${n(y)}" r="${n(r)}" fill="none" stroke="${INK}" stroke-width="${n(h * 0.06)}"/>` +
    `<path d="M${n(cx)},${n(y - r * 0.55)} L${n(cx)},${n(y)} L${n(cx + r * 0.45)},${n(y + r * 0.3)}" fill="none" stroke="${INK}" stroke-width="${n(h * 0.06)}" stroke-linecap="round" stroke-linejoin="round"/>`
  return (
    `<g transform="rotate(${turn} ${n(x)} ${n(y)})">` +
    `<rect x="${n(l)}" y="${n(t + h * 0.08)}" width="${n(w)}" height="${n(h)}" rx="${n(h / 2)}" fill="rgba(10,16,30,.22)"/>` +
    `<rect x="${n(l)}" y="${n(t)}" width="${n(w)}" height="${n(h)}" rx="${n(h / 2)}" fill="#fff"/>` +
    clock +
    `<text x="${n(l + h * 0.98)}" y="${n(y)}" dominant-baseline="central" ${font} font-weight="700" font-size="${n(fs)}" fill="${INK}">${label}</text></g>`
  )
}

/** The green "Saved" chip from Manage (ManageMenu.vue): a check, and that your changes are safe. (x, y) is its centre. */
export function savedChip(x: number, y: number, h: number, label = 'Saved', turn = 0) {
  const font = `font-family="'Atkinson Hyperlegible Next', Atkinson, sans-serif"`
  const fs = h * 0.46
  const w = h * 1.05 + label.length * fs * 0.55 + h * 0.5
  const l = x - w / 2
  const t = y - h / 2
  const cx = l + h * 0.55
  const tick = `M${n(cx - h * 0.16)},${n(y + h * 0.01)} L${n(cx - h * 0.04)},${n(y + h * 0.13)} L${n(cx + h * 0.18)},${n(y - h * 0.12)}`
  return (
    `<g transform="rotate(${turn} ${n(x)} ${n(y)})">` +
    `<rect x="${n(l)}" y="${n(t + h * 0.06)}" width="${n(w)}" height="${n(h)}" rx="${n(h / 2)}" fill="rgba(20,92,43,.16)"/>` +
    `<rect x="${n(l)}" y="${n(t)}" width="${n(w)}" height="${n(h)}" rx="${n(h / 2)}" fill="#ddf2e2"/>` +
    `<path d="${tick}" fill="none" stroke="#145c2b" stroke-width="${n(h * 0.09)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<text x="${n(l + h * 0.92)}" y="${n(y)}" dominant-baseline="central" ${font} font-weight="700" font-size="${n(fs)}" fill="#145c2b">${label}</text></g>`
  )
}

/**
 * A chip from the schedule builder's palette (BuilderChip.vue), lifted mid-drag:
 * white, a green bar for a dance, its grip, the name and its steps in grey.
 * (x, y) is its centre; h its height.
 */
export function dragChip(
  x: number,
  y: number,
  h: number,
  name: string,
  steps = '',
  turn = 0,
) {
  const font = `font-family="'Atkinson Hyperlegible Next', Atkinson, sans-serif"`
  const fs = h * 0.4
  const w =
    h * 0.62 + (name.length + (steps ? steps.length + 1 : 0)) * fs * 0.52 + h * 0.4
  const l = x - w / 2
  const t = y - h / 2
  const r = h * 0.24
  const grip = [-1, 0, 1]
    .flatMap((row) =>
      [-1, 1].map(
        (col) =>
          `<circle cx="${n(l + h * 0.36 + col * h * 0.055)}" cy="${n(y + row * h * 0.12)}" r="${n(h * 0.03)}" fill="#8a94a3"/>`,
      ),
    )
    .join('')
  const label = `<tspan fill="${INK}">${name}</tspan>${steps ? `<tspan fill="#6b7685"> ${steps}</tspan>` : ''}`
  return (
    `<g transform="rotate(${turn} ${n(x)} ${n(y)})">` +
    // The lifted shadow, soft and below.
    `<rect x="${n(l + h * 0.04)}" y="${n(t + h * 0.16)}" width="${n(w)}" height="${n(h)}" rx="${n(r)}" fill="rgba(10,16,30,.22)"/>` +
    `<rect x="${n(l)}" y="${n(t)}" width="${n(w)}" height="${n(h)}" rx="${n(r)}" fill="#fff"/>` +
    `<rect x="${n(l + h * 0.1)}" y="${n(t + h * 0.14)}" width="${n(h * 0.085)}" height="${n(h * 0.72)}" rx="${n(h * 0.0425)}" fill="oklch(0.76 0.12 195)"/>` +
    grip +
    `<text x="${n(l + h * 0.58)}" y="${n(y)}" dominant-baseline="central" ${font} font-weight="600" font-size="${n(fs)}">${label}</text></g>`
  )
}
