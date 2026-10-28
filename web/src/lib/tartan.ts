import type { DancerColor, DancerColorId } from '@/stores/dancerColors'

// A dancer's tartan, as a follower makes it: a recipe, never a picture.
//
// The recipe is a sett in the Scottish Register's threadcount notation, the
// stripes from the middle of the pattern out ("P40 K16 S16 K2 T2" is 40
// threads of P, 16 black, 16 of S, 2 black, 2 of T), mirrored like nearly
// every tartan and woven the same across and down, plus the colour each
// letter stands for. K and W are always black and white; any other capital
// is whatever colour the recipe gives it, so a tartan can have as many
// colours as it has stripes. A real tartan's threadcount has the same shape
// with its own colour letters, so one could be drawn by the same code one day.
//
// The builder works in four fixed widths, like Lego bricks: pieces swap for
// another size but never stretch.

export const WIDTHS = [2, 6, 16, 40] as const
export type Width = (typeof WIDTHS)[number]
export const WIDTH_NAMES: Record<Width, string> = { 2: 'Line', 6: 'Stripe', 16: 'Band', 40: 'Field' }
export const MAX_STRIPES = 14

export interface Stripe {
  /** A colour letter: K black, W white, any other capital from the recipe's colours. */
  code: string
  width: Width
}

export type Hex = `#${string}`
export const isHex = (s: unknown): s is Hex => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s)

/**
 * A follower's tartan for a dancer: the stripes, and the colour of each
 * letter in them (but K and W). `color` is the dancer's own colour, the one
 * their dots show; picking a new one repaints the stripes that were in it.
 */
export interface Tartan {
  color: DancerColor
  sett: string
  colors: Record<string, Hex>
}

/** Letters a recipe can give colours to: every capital but K and W. */
export const isColourCode = (c: string) => /^[A-JL-VX-Z]$/.test(c)
const TOKEN = /^([A-Z])(2|6|16|40)$/

/** "P40 K16 S16 K2 T2" as stripes, or null if it isn't one the builder makes. */
export function parseSett(sett: unknown): Stripe[] | null {
  if (typeof sett !== 'string') return null
  const tokens = sett.trim().split(/\s+/)
  if (!tokens[0] || tokens.length > MAX_STRIPES) return null
  const stripes: Stripe[] = []
  for (const t of tokens) {
    const m = t.match(TOKEN)
    if (!m) return null
    stripes.push({ code: m[1]!, width: Number(m[2]) as Width })
  }
  return stripes
}

export const formatSett = (stripes: readonly Stripe[]) => stripes.map((s) => s.code + s.width).join(' ')

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

/** The colours a stripe can take besides black and white (and the rainbow for any other). */
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
]
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
/** A colour's name, for labels and screen readers, or null for one of your own. */
export const swatchName = (hex: string) =>
  same(hex, BLACK) ? 'Black' : same(hex, WHITE) ? 'White' : (SWATCHES.find((s) => same(s.hex, hex))?.label ?? null)

export const clothHex = (color: DancerColor): Hex => (isHex(color) ? color : CLOTH[color])

// The colours a preset is woven in: the dancer's colour for P, and for S and
// T the pair real tartans put with it (Royal Stewart's navy and yellow with
// red, MacLeod's black and red with gold).
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
export const companionsOf = (color: DancerColor): [Hex, Hex] => (isHex(color) ? [NAVY, '#e8c000'] : COMPANIONS[color])

/**
 * Patterns to start from, named after dances rather than clans so nobody
 * takes one for a registered tartan. With Plain they fill two rows of five.
 * P is woven in the dancer's colour, S and T in the pair that goes with it.
 */
export const PRESETS = [
  { id: 'fling', name: 'Fling', sett: 'P40 K16 S16 K2 T2' },
  { id: 'sword', name: 'Sword', sett: 'S16 W2 S2 W2 S2 W16 P40 T2' },
  { id: 'reel', name: 'Reel', sett: 'P16 W16' },
  { id: 'jig', name: 'Jig', sett: 'P16 S6 W2 S6' },
  { id: 'hornpipe', name: 'Hornpipe', sett: 'K40 S6 K6 P16 K2 T2' },
  { id: 'lilt', name: 'Lilt', sett: 'W40 P6 W6 S16 W2 T2' },
  { id: 'flora', name: 'Flora', sett: 'P40 S6 W16 T2 W2 K2 W2 S16 P6 W2 P2 K2' },
  { id: 'strathspey', name: 'Strathspey', sett: 'P40 S2 P6 S2 P16 S40' },
  { id: 'seann', name: 'Seann Triubhas', sett: 'K6 S16 P40 S16 T2' },
] as const

/** A recipe's colours, kept to the letters its stripes use. */
function usedColours(stripes: readonly Stripe[], colors: Record<string, Hex>) {
  const out: Record<string, Hex> = {}
  for (const s of stripes) if (isColourCode(s.code) && colors[s.code]) out[s.code] = colors[s.code]!
  return out
}

/** A preset woven in a dancer's colour (a black or white in its pair is woven as K or W). */
export function weavePreset(sett: string, color: DancerColor): Tartan {
  const [S, T] = companionsOf(color)
  const roles: Record<string, Hex> = { P: clothHex(color), S, T }
  const stripes = (parseSett(sett) ?? []).map((x) => {
    const hex = roles[x.code]
    return { ...x, code: !hex ? x.code : same(hex, BLACK) ? 'K' : same(hex, WHITE) ? 'W' : x.code }
  })
  return { color, sett: formatSett(stripes), colors: usedColours(stripes, roles) }
}

/** Every letter's colour in a tartan, black and white included. */
export const paletteOf = (t: Pick<Tartan, 'colors'>): Record<string, Hex> => ({ ...t.colors, K: BLACK, W: WHITE })

/** Whether every stripe has a colour to be woven in. */
export const isWoven = (t: Pick<Tartan, 'sett' | 'colors'>) =>
  !!parseSett(t.sett)?.every((s) => s.code === 'K' || s.code === 'W' || isHex(t.colors[s.code]))

/** The stripes as they look (colour and width), for telling two recipes apart however they're lettered. */
const lookOf = (t: Pick<Tartan, 'sett' | 'colors'>) => {
  const p = paletteOf(t)
  return (parseSett(t.sett) ?? []).map((s) => `${p[s.code]?.toLowerCase()}${s.width}`).join(' ')
}
export const sameCloth = (a: Pick<Tartan, 'sett' | 'colors'>, b: Pick<Tartan, 'sett' | 'colors'>) => lookOf(a) === lookOf(b)

/** The preset a tartan still is, woven in its dancer's colour, if it is one. */
export const presetOf = (t: Tartan) => PRESETS.find((p) => sameCloth(t, weavePreset(p.sett, t.color))) ?? null

/**
 * A new colour for the dancer: a preset is woven again in it (its pair
 * changes too); anything else has its stripes in the old colour repainted.
 */
export function recolor(t: Tartan, color: DancerColor): Tartan {
  const preset = presetOf(t)
  if (preset) return weavePreset(preset.sett, color)
  const from = clothHex(t.color)
  const to = clothHex(color)
  return { color, sett: t.sett, colors: Object.fromEntries(Object.entries(t.colors).map(([k, v]) => [k, same(v, from) ? to : v])) }
}

/**
 * The letter for a colour in a recipe: K or W for black and white, the
 * letter it already has, or the next free one (added to `colors`).
 */
export function codeFor(colors: Record<string, Hex>, hex: Hex): string {
  if (same(hex, BLACK)) return 'K'
  if (same(hex, WHITE)) return 'W'
  const had = Object.entries(colors).find(([, v]) => same(v, hex))?.[0]
  if (had) return had
  const free = 'ABCDEFGHIJLMNOPQRSTUVXYZ'.split('').find((c) => !colors[c])!
  colors[free] = hex
  return free
}

/** A recipe tidied for saving: colours only for the letters its stripes use. */
export const tidy = (t: Tartan): Tartan => ({ ...t, colors: usedColours(parseSett(t.sett) ?? [], t.colors) })

/**
 * The dancer's colour kept true to the cloth: theirs while a stripe still
 * wears it, otherwise `painted` (the colour that just replaced it) or the
 * colour woven most, black and white last, so their dots match once every
 * stripe in it has gone.
 */
export function settle(t: Tartan, painted?: Hex): Tartan {
  const stripes = parseSett(t.sett) ?? []
  const p = paletteOf(t)
  const woven = (hex: string) => stripes.some((s) => same(p[s.code] ?? '', hex))
  if (!stripes.length || woven(clothHex(t.color))) return t
  const plain = (hex: string) => same(hex, BLACK) || same(hex, WHITE)
  const threads = new Map<Hex, number>()
  for (const s of repeatOf(stripes)) threads.set(p[s.code]!, (threads.get(p[s.code]!) ?? 0) + s.width)
  const most = [...threads].sort((a, b) => Number(plain(a[0])) - Number(plain(b[0])) || b[1] - a[1])[0]![0]
  const hex = painted && woven(painted) && !plain(painted) ? painted : most
  const id = (Object.keys(CLOTH) as DancerColorId[]).find((k) => same(CLOTH[k], hex))
  return { ...t, color: id ?? (hex.toLowerCase() as Hex) }
}

// Weaving.

type Run = readonly [hex: string, threads: number]

/** One repeat: the stripes, then back again without repeating the two pivots. */
export const repeatOf = <T>(stripes: readonly T[]): T[] =>
  stripes.length < 2 ? [...stripes] : [...stripes, ...stripes.slice(1, -1).reverse()]
/** Which stripe each place in the repeat is. */
export const repeatIndex = (n: number) => repeatOf([...Array(n).keys()])

export type Palette = Record<string, Hex>
export const runsOf = (stripes: readonly Stripe[], palette: Palette): Run[] =>
  repeatOf(stripes).map((s) => [palette[s.code] ?? BLACK, s.width] as const)
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
 * about 0.3px a thread, so a 40px avatar or a bib's band shows a whole
 * repeat or more rather than a corner of one. Clamped so a small check
 * keeps squares big enough to see and a huge sett keeps its finest lines.
 * Even, so the twill's 4px rib (at 2x) meets itself at the tile's edges.
 */
export const tileSize = (threads: number) => Math.max(16, Math.min(200, Math.round(threads * 0.15) * 2))

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/** Whether a tartan is mostly light (a white ground, say), so text on it takes ink rather than white. */
export function isLightCloth(stripes: readonly Stripe[], palette: Palette) {
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
export function clothTile(stripes: readonly Stripe[], palette: Palette, size: number): string | null {
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
export function clothImage(t: Pick<Tartan, 'sett' | 'colors'>, size?: number): string | null {
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
  const key = `${t.color}|${lookOf(t)}`
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
 * stripe, recolour one from the tartan's own colours or black and white,
 * resize one, trade two colours, flip the order). `random` is injectable for
 * tests.
 */
export function remix(stripes: readonly Stripe[], random: () => number = Math.random): Stripe[] {
  const codes = [...new Set([...stripes.map((x) => x.code), 'K', 'W'])]
  const colours = codes.filter(isColourCode)
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
      const others = codes.filter((c) => c !== x.code)
      x.code = others[pick(others.length)]!
    },
    () => {
      const x = s[pick(s.length)]!
      const others = WIDTHS.filter((w) => w !== x.width)
      x.width = others[pick(others.length)]!
    },
    () => {
      if (colours.length < 2) return
      const pair = [...colours]
      const a = pair.splice(pick(pair.length), 1)[0]!
      const b = pair[pick(pair.length)]!
      for (const x of s) x.code = x.code === a ? b : x.code === b ? a : x.code
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
