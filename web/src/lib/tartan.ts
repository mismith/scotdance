import type { DancerColor, DancerColorId } from '@/stores/dancerColors'

// A dancer's tartan, as a follower makes it: a recipe, never a picture.
//
// The recipe is a sett in the Scottish Register's threadcount notation, the
// stripes from the middle of the pattern out ("P40 K16 S16 K2 T2" is 40
// threads of the first colour, 16 black, 16 of the second, 2 black, 2 of the
// third), mirrored like nearly every tartan and woven the same across and
// down. Letters are roles, not fixed colours: P, S and T are the follower's
// first, second and third colours, K and W a fixed black and white. A real
// tartan's threadcount has the same shape with its own colour letters, so one
// could be drawn by the same code one day.
//
// The builder works in four fixed widths, like Lego bricks: pieces swap for
// another size but never stretch.

export type Role = 'P' | 'S' | 'T' | 'K' | 'W'
export const ROLES: readonly Role[] = ['P', 'S', 'T', 'K', 'W']
export const WIDTHS = [2, 6, 16, 40] as const
export type Width = (typeof WIDTHS)[number]
export const WIDTH_NAMES: Record<Width, string> = { 2: 'Line', 6: 'Stripe', 16: 'Band', 40: 'Field' }
export const MAX_STRIPES = 14

export interface Stripe {
  role: Role
  width: Width
}

export type Hex = `#${string}`
export const isHex = (s: unknown): s is Hex => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s)

/** A follower's tartan for a dancer. Second and third go with the first colour until chosen. */
export interface Tartan {
  color: DancerColor
  sett: string
  second?: Hex
  third?: Hex
}

const TOKEN = /^([PSTKW])(2|6|16|40)$/

/** "P40 K16 S16 K2 T2" as stripes, or null if it isn't one the builder makes. */
export function parseSett(sett: unknown): Stripe[] | null {
  if (typeof sett !== 'string') return null
  const tokens = sett.trim().split(/\s+/)
  if (!tokens[0] || tokens.length > MAX_STRIPES) return null
  const stripes: Stripe[] = []
  for (const t of tokens) {
    const m = t.match(TOKEN)
    if (!m) return null
    stripes.push({ role: m[1] as Role, width: Number(m[2]) as Width })
  }
  return stripes
}

export const formatSett = (stripes: readonly Stripe[]) => stripes.map((s) => s.role + s.width).join(' ')

/**
 * Patterns to start from, named after dances rather than clans so nobody
 * takes one for a registered tartan. With Plain they fill two rows of five.
 */
export const PRESETS = [
  { id: 'fling', name: 'Fling', sett: 'P40 K16 S16 K2 T2' },
  { id: 'sword', name: 'Sword', sett: 'S16 K2 S2 K2 S2 K16 P40 T2' },
  { id: 'reel', name: 'Reel', sett: 'P16 K16' },
  { id: 'jig', name: 'Jig', sett: 'P40 T2' },
  { id: 'hornpipe', name: 'Hornpipe', sett: 'K40 S6 K6 P16 K2 T2' },
  { id: 'lilt', name: 'Lilt', sett: 'W40 P6 W6 S16 W2 T2' },
  { id: 'flora', name: 'Flora', sett: 'P40 S6 K16 T2 K2 W2 K2 S16 P6 K2 P2 W2' },
  { id: 'strathspey', name: 'Strathspey', sett: 'P40 S2 P6 S2 P16 S40' },
  { id: 'seann', name: 'Seann Triubhas', sett: 'K6 S16 P40 S16 T2' },
] as const

export const presetFor = (sett: string) => PRESETS.find((p) => p.sett === sett) ?? null

// Colours. Cloth is dyed, so it keeps the light theme's palette in both
// themes (the same values as --dancer-1…9 in style.css; a test keeps them in step).
export const CLOTH: Record<DancerColorId, Hex> = {
  'dancer-1': '#b0102c',
  'dancer-2': '#1d6a48',
  'dancer-3': '#6a3fa0',
  'dancer-4': '#b5800a',
  'dancer-5': '#0065bd',
  'dancer-6': '#00707a',
  'dancer-7': '#b0266e',
  'dancer-8': '#b04a00',
  'dancer-9': '#14306b',
}
export const BLACK: Hex = '#1a1c22'
export const WHITE: Hex = '#f1ede2'

/** Colours for the second and third, named for screen readers and the stripe panel. */
export const SWATCHES: ReadonlyArray<{ hex: Hex; label: string }> = [
  { hex: CLOTH['dancer-1'], label: 'Red' },
  { hex: CLOTH['dancer-2'], label: 'Green' },
  { hex: CLOTH['dancer-3'], label: 'Purple' },
  { hex: CLOTH['dancer-4'], label: 'Gold' },
  { hex: CLOTH['dancer-5'], label: 'Blue' },
  { hex: CLOTH['dancer-6'], label: 'Teal' },
  { hex: CLOTH['dancer-7'], label: 'Pink' },
  { hex: CLOTH['dancer-8'], label: 'Orange' },
  { hex: CLOTH['dancer-9'], label: 'Navy' },
  { hex: '#e8c000', label: 'Yellow' },
  { hex: '#48a4c0', label: 'Sky' },
  { hex: WHITE, label: 'White' },
  { hex: BLACK, label: 'Black' },
]
export const swatchName = (hex: string) => SWATCHES.find((s) => s.hex.toLowerCase() === hex.toLowerCase())?.label ?? null

// Second and third colours that go with each first colour, the way real
// tartans pair them (Royal Stewart's navy and yellow with red, MacLeod's
// black and red with gold), until someone picks their own.
const NAVY = CLOTH['dancer-9']
const COMPANIONS: Record<DancerColorId, [Hex, Hex]> = {
  'dancer-1': [NAVY, '#e8c000'],
  'dancer-2': [NAVY, '#e8c000'],
  'dancer-3': [CLOTH['dancer-2'], WHITE],
  'dancer-4': [BLACK, CLOTH['dancer-1']],
  'dancer-5': [CLOTH['dancer-2'], WHITE],
  'dancer-6': [NAVY, '#e8c000'],
  'dancer-7': [NAVY, WHITE],
  'dancer-8': [NAVY, WHITE],
  'dancer-9': [CLOTH['dancer-2'], CLOTH['dancer-1']],
}

export const clothHex = (color: DancerColor): Hex => (isHex(color) ? color : CLOTH[color])

/** Every role's colour in a tartan. */
export function paletteOf(t: Pick<Tartan, 'color' | 'second' | 'third'>): Record<Role, Hex> {
  const [second, third] = isHex(t.color) ? [NAVY, '#e8c000' as Hex] : COMPANIONS[t.color]
  return { P: clothHex(t.color), S: t.second ?? second, T: t.third ?? third, K: BLACK, W: WHITE }
}

// Weaving.

type Run = readonly [hex: string, threads: number]

/** One repeat: the stripes, then back again without repeating the two pivots. */
export const repeatOf = <T>(stripes: readonly T[]): T[] =>
  stripes.length < 2 ? [...stripes] : [...stripes, ...stripes.slice(1, -1).reverse()]
/** Which stripe each place in the repeat is. */
export const repeatIndex = (n: number) => repeatOf([...Array(n).keys()])

export const runsOf = (stripes: readonly Stripe[], palette: Record<Role, Hex>): Run[] =>
  repeatOf(stripes).map((s) => [palette[s.role], s.width] as const)
export const threadsIn = (stripes: readonly Stripe[]) => repeatOf(stripes).reduce((n, s) => n + s.width, 0)

/** Bands along one edge, `k` pixels a thread, as [start, end) in whole pixels. */
export function bandsAlong(runs: readonly Run[], k: number, length: number, each: (hex: string, a: number, b: number, i: number) => void) {
  let threads = 0
  for (let i = 0; Math.round(threads * k) < length && i < 10_000; i++) {
    const j = i % runs.length
    const [hex, n] = runs[j]!
    each(hex, Math.round(threads * k), Math.round((threads + n) * k), j)
    threads += n
  }
}

let twillTile: HTMLCanvasElement | null = null
/**
 * Weft across, warp over it at half strength (where a 2/2 twill crosses,
 * each colour shows half the time), then a fine diagonal rib at a fixed
 * pitch. A rib drawn per thread would turn to moiré once a sett is shrunk.
 */
export function weave(ctx: CanvasRenderingContext2D, w: number, h: number, runs: readonly Run[], k: number) {
  ctx.globalAlpha = 1
  bandsAlong(runs, k, h, (hex, a, b) => {
    ctx.fillStyle = hex
    ctx.fillRect(0, a, w, b - a)
  })
  ctx.globalAlpha = 0.5
  bandsAlong(runs, k, w, (hex, a, b) => {
    ctx.fillStyle = hex
    ctx.fillRect(a, 0, b - a, h)
  })
  if (!twillTile) {
    twillTile = document.createElement('canvas')
    twillTile.width = twillTile.height = 4
    const t = twillTile.getContext('2d')
    if (t) for (let i = 0; i < 4; i++) t.fillRect(i, i, 1, 1)
  }
  const rib = ctx.createPattern(twillTile, 'repeat')
  if (rib) {
    ctx.globalAlpha = 0.14
    ctx.fillStyle = rib
    ctx.fillRect(0, 0, w, h)
  }
  ctx.globalAlpha = 1
}

/**
 * A tile's width in CSS pixels: every look is cut from cloth of one scale,
 * clamped so a small check still shows a few squares on a 40px avatar and a
 * big sett still shows its pattern on a number card. Even, so the twill's
 * 4px rib (at 2x) meets itself at the tile's edges.
 */
export const tileSize = (threads: number) => Math.max(36, Math.min(220, Math.round(threads * 0.3) * 2))

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/** Whether a tartan is mostly light (a white ground, say), so text on it takes ink rather than white. */
export function isLightCloth(stripes: readonly Stripe[], palette: Record<Role, Hex>) {
  const runs = runsOf(stripes, palette)
  const total = runs.reduce((n, [, t]) => n + t, 0)
  return runs.reduce((sum, [hex, t]) => sum + luminance(hex) * t, 0) / total > 0.4
}

// Tiles drawn lately, oldest first (a Map keeps insertion order), so swatches
// and the loom's edits don't pile up data URLs for the whole session.
const tiles = new Map<string, string>()
const TILES_KEPT = 64
let scratch: HTMLCanvasElement | null = null
let noCanvas = typeof document === 'undefined'

/** One seamless repeat as a data URL, `size` CSS pixels square, drawn at 2x. Null without a canvas. */
export function clothTile(stripes: readonly Stripe[], palette: Record<Role, Hex>, size: number): string | null {
  const key = `${formatSett(stripes)}|${Object.values(palette).join()}|${size}`
  const hit = tiles.get(key)
  if (hit) {
    tiles.delete(key)
    tiles.set(key, hit)
    return hit
  }
  if (noCanvas) return null
  scratch ??= document.createElement('canvas')
  const px = Math.max(8, Math.round(size * 2))
  scratch.width = scratch.height = px
  const ctx = scratch.getContext('2d')
  if (ctx) weave(ctx, px, px, runsOf(stripes, palette), px / threadsIn(stripes))
  const url = ctx ? scratch.toDataURL('image/png') : null
  // (No 2D canvas here, as in tests: remember, and wear plain colours.)
  if (!url?.startsWith('data:image/png')) {
    noCanvas = true
    return null
  }
  tiles.set(key, url)
  if (tiles.size > TILES_KEPT) tiles.delete(tiles.keys().next().value!)
  return url
}

/** A tartan as a CSS background, a repeat `size` CSS pixels wide (a swatch shows the whole repeat). */
export function clothImage(t: Pick<Tartan, 'color' | 'sett' | 'second' | 'third'>, size?: number): string | null {
  const stripes = parseSett(t.sett)
  if (!stripes) return null
  const s = size ?? tileSize(threadsIn(stripes))
  const url = clothTile(stripes, paletteOf(t), s)
  return url ? `url("${url}") 0 0 / ${s}px ${s}px` : null
}

// Every place a dancer's look shows takes it as a CSS background. A tartan's
// data URL is long, so each dancer's is defined once, as custom properties on
// :root in a style sheet of its own, and rows carry only `var(--cloth-…)`.
// When their tartan changes (every edit on the loom), that dancer's rule is
// updated in place rather than added to. Alongside the cloth: its first
// colour (`-solid`) for dots too small to show it, and text on it (`-ink`,
// with a `-halo` behind: dark on light cloth).
const slots = new Map<string, { rule: CSSStyleRule; key: string }>()
let sheet: CSSStyleSheet | null = null

const solidOfColor = (color: DancerColor) => (isHex(color) ? color : `var(--${color})`)

/**
 * A dancer's tartan as a background for `--dc` (see `sash`), kept under
 * `slot` (their id), or its first colour where there's no canvas.
 */
export function clothBackground(t: Tartan, slot: string): string {
  const name = `--cloth-${slot.replace(/[^\w-]/g, '_')}`
  const key = `${t.color}|${t.sett}|${t.second ?? ''}|${t.third ?? ''}`
  const held = slots.get(name)
  if (held?.key === key) return `var(${name})`
  const image = noCanvas ? null : clothImage(t)
  if (!image) return solidOfColor(t.color)
  const light = isLightCloth(parseSett(t.sett)!, paletteOf(t))
  const props: Record<string, string> = {
    [name]: image,
    [`${name}-solid`]: solidOfColor(t.color),
    [`${name}-ink`]: light ? '#0c0f13' : '#ffffff',
    [`${name}-halo`]: light ? 'rgb(255 255 255 / 0.7)' : 'rgb(0 0 0 / 0.7)',
  }
  if (held) {
    for (const [k, v] of Object.entries(props)) held.rule.style.setProperty(k, v)
    held.key = key
  } else {
    if (!sheet) {
      const el = document.createElement('style')
      el.dataset.cloths = ''
      document.head.append(el)
      sheet = el.sheet
    }
    if (!sheet) return solidOfColor(t.color)
    const at = sheet.insertRule(`:root { ${Object.entries(props).map(([k, v]) => `${k}: ${v};`).join(' ')} }`, sheet.cssRules.length)
    slots.set(name, { rule: sheet.cssRules[at] as CSSStyleRule, key })
  }
  return `var(${name})`
}

export const isCloth = (bg: string | null | undefined): bg is string => !!bg?.startsWith('var(--cloth-')
const part = (bg: string, suffix: string) => bg.replace(/\)$/, `-${suffix})`)
/** A look's one colour, for a dot too small to show cloth: a tartan's first colour, else the colour itself. */
export const solidOf = (bg: string | null | undefined) => (isCloth(bg) ? part(bg, 'solid') : bg)
/** Text on a tartan's cloth, and the halo that keeps it legible over every stripe. */
export const clothInk = (bg: string) => ({ ink: part(bg, 'ink'), halo: part(bg, 'halo') })

// The builder.

/** Which stripe sits `t` threads into the repeat, and how wide it is. */
export function stripeAt(stripes: readonly Stripe[], t: number): { index: number; width: number } {
  const order = repeatIndex(stripes.length)
  const total = threadsIn(stripes)
  let x = ((t % total) + total) % total
  for (const i of order) {
    const w = stripes[i]!.width
    if (x < w) return { index: i, width: w }
    x -= w
  }
  return { index: 0, width: stripes[0]!.width }
}

/**
 * A remix of a sett: one or two small changes (swap neighbours, move a
 * stripe, recolour one, resize one, trade two colours, flip the order).
 * `random` is injectable for tests.
 */
export function remix(stripes: readonly Stripe[], random: () => number = Math.random): Stripe[] {
  const s = stripes.map((x) => ({ ...x }))
  const pick = (n: number) => Math.floor(random() * n)
  const changes = [
    () => {
      if (s.length < 2) return
      const i = pick(s.length - 1)
      ;[s[i], s[i + 1]] = [s[i + 1]!, s[i]!]
    },
    () => {
      if (s.length < 3) return
      const [x] = s.splice(pick(s.length), 1)
      s.splice(pick(s.length + 1), 0, x!)
    },
    () => {
      const x = s[pick(s.length)]!
      const others = ROLES.filter((r) => r !== x.role)
      x.role = others[pick(others.length)]!
    },
    () => {
      const x = s[pick(s.length)]!
      const others = WIDTHS.filter((w) => w !== x.width)
      x.width = others[pick(others.length)]!
    },
    () => {
      const pair: Role[] = ['P', 'S', 'T']
      const a = pair.splice(pick(3), 1)[0]!
      const b = pair[pick(2)]!
      for (const x of s) x.role = x.role === a ? b : x.role === b ? a : x.role
    },
    () => void s.reverse(),
  ]
  const n = 1 + pick(2)
  for (let i = 0; i < n; i++) changes[pick(changes.length)]!()
  return s
}

/** `count` different remixes of a sett, none the sett itself. */
export function remixes(stripes: readonly Stripe[], count: number, random: () => number = Math.random): Stripe[][] {
  const seen = new Set([formatSett(stripes)])
  const out: Stripe[][] = []
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const r = remix(stripes, random)
    const key = formatSett(r)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}
