// Tartans are drawn, not stored as pictures. A tartan is a threadcount (the
// stripe recipe, e.g. "K/32 Y4 K32 Y48 R/4") plus a palette mapping each
// colour code to a hex value. Colour letters are NOT a fixed palette (the
// Scottish Register uses 8 shades of red alone), so every tartan carries its
// own.
//
// Notation (Scottish Register / Scottish Tartans Authority):
//   R24          colour code + number of threads
//   K/2 ... Y/2  symmetric sett, half-count pivots: mirror, repeating pivots
//   /K4 ... Y4/  symmetric sett, full-count pivots: mirror without repeating
//   K4 ... Y4    no slashes: symmetric, full-count (the usual assumption)
//   ...B4 W2...  asymmetric: repeat as written
// The cloth is a 2/2 twill: where warp and weft cross, each shows half the
// time along 45° ribs, so crossings read as a 50/50 mix of the two colours.

export interface Tartan {
  id: string
  name: string
  threadcount: string
  palette: Record<string, string>
  /** Where it came from, for attribution. */
  source?: string
  sourceUrl?: string
  licence?: string
  author?: string
  /** Made by you in the app; only you see it. */
  custom?: boolean
}

interface Stripe {
  code: string
  count: number
}

const TOKEN = /^([A-Za-z]+)(\/)?(\d+)(\/)?$/

export function parseThreadcount(input: string): { stripes: Stripe[]; mode: 'half' | 'full' | 'asym' } | null {
  let text = input.trim()
  let asym = false
  if (text.startsWith('...') || text.endsWith('...')) {
    asym = true
    text = text.replace(/^\.\.\./, '').replace(/\.\.\.$/, '').trim()
  }
  const tokens = text.split(/[\s,]+/).filter(Boolean)
  if (!tokens.length) return null
  let halfPivot = false
  const stripes: Stripe[] = []
  for (const raw of tokens) {
    // Leading-slash full-count form: "/K4"
    const t = raw.replace(/^\//, '')
    const m = t.match(TOKEN)
    if (!m) return null
    const [, code, pre, count, post] = m
    if (pre || post) halfPivot = true
    const n = Number(count)
    if (!n) continue
    stripes.push({ code: code.toUpperCase(), count: n })
  }
  if (!stripes.length) return null
  const fullSlashes = tokens[0].startsWith('/') || tokens.at(-1)!.endsWith('/')
  return { stripes, mode: asym ? 'asym' : halfPivot && !fullSlashes ? 'half' : 'full' }
}

/** One full repeat of the sett as a thread-by-thread colour list. */
export function expandSett(t: Pick<Tartan, 'threadcount' | 'palette'>): string[] | null {
  const parsed = parseThreadcount(t.threadcount)
  if (!parsed) return null
  const { stripes, mode } = parsed
  let seq: Stripe[]
  if (mode === 'asym' || stripes.length === 1) seq = stripes
  else if (mode === 'half') seq = [...stripes, ...[...stripes].reverse()]
  else seq = [...stripes, ...stripes.slice(1, -1).reverse()]
  const out: string[] = []
  for (const s of seq) {
    const hex = t.palette[s.code] ?? t.palette[s.code.toUpperCase()] ?? '#888888'
    for (let i = 0; i < s.count; i++) out.push(hex)
  }
  return out.length ? out : null
}

const cache = new Map<string, string>()

/** Consecutive threads of one colour, as [colour, start, length] runs. */
function runs(threads: string[]) {
  const out: Array<[string, number, number]> = []
  threads.forEach((c, i) => {
    const last = out[out.length - 1]
    if (last && last[0] === c) last[2]++
    else out.push([c, i, 1])
  })
  return out
}

/**
 * A seamless tile of the cloth, `size` CSS pixels square, as a data URL.
 * Drawn at the size it's shown (2x for sharp screens): weft stripes, warp
 * stripes woven over them at half strength (where a real 2/2 twill mixes
 * the two), then a fine diagonal twill line at a fixed pitch. Drawing the
 * twill per thread instead aliases into moiré once a big sett is shrunk.
 */
export function tartanTile(t: Pick<Tartan, 'threadcount' | 'palette'>, size: number): string | null {
  const key = `${t.threadcount}|${JSON.stringify(t.palette)}|${size}`
  const hit = cache.get(key)
  if (hit) return hit
  const threads = expandSett(t)
  if (!threads || typeof document === 'undefined') return null
  const w = Math.max(4, Math.round((size * 2) / 4) * 4)
  const k = w / threads.length
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = w
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const bands = runs(threads)
  for (const [c, start, len] of bands) {
    ctx.fillStyle = c
    ctx.fillRect(0, start * k, w, len * k)
  }
  ctx.globalAlpha = 0.5
  for (const [c, start, len] of bands) {
    ctx.fillStyle = c
    ctx.fillRect(start * k, 0, len * k, w)
  }
  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#000'
  for (let y = 0; y < w; y++) {
    for (let x = (y % 4) - 4; x < w; x += 4) ctx.fillRect(x, y, 1, 1)
  }
  const url = canvas.toDataURL('image/png')
  cache.set(key, url)
  return url
}

/**
 * A CSS background layer of the cloth, for `--sash`. Real setts run from
 * ~50 to ~800 threads; they're shown at a size that reads well on a thin
 * sash rather than true to scale.
 */
export function tartanLayer(t: Pick<Tartan, 'threadcount' | 'palette'>, scale = 0.4): string | null {
  const n = expandSett(t)?.length
  if (!n) return null
  const size = Math.round(Math.min(240, Math.max(56, n * scale)))
  const url = tartanTile(t, size)
  return url ? `url(${url}) 0 0 / ${size}px ${size}px` : null
}

function luminance(hex: string) {
  const c = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrastWithWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05)

function darken(hex: string, amount: number) {
  const c = hex.replace('#', '')
  const ch = [0, 2, 4].map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) * (1 - amount)))
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** Colours by how much of the cloth they cover, most first. */
export function dominantColours(t: Pick<Tartan, 'threadcount' | 'palette'>): string[] {
  const threads = expandSett(t) ?? []
  const counts = new Map<string, number>()
  for (const c of threads) counts.set(c.toLowerCase(), (counts.get(c.toLowerCase()) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
}

/**
 * The dancer's accent colour: the most prominent colour that isn't close to
 * black, grey or white, darkened until white text on it passes WCAG AA.
 */
export function tartanAccents(t: Pick<Tartan, 'threadcount' | 'palette'>): string[] {
  const colours = dominantColours(t)
  const vivid = colours.filter((c) => {
    const l = luminance(c)
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
    const spread = Math.max(r, g, b) - Math.min(r, g, b)
    return l > 0.01 && l < 0.85 && spread > 40
  })
  const picks = vivid.length ? vivid : colours.slice(0, 1)
  return picks.map((c) => {
    let accent = c
    for (let i = 0; i < 10 && contrastWithWhite(accent) < 4.5; i++) accent = darken(accent, 0.12)
    return accent
  })
}

export const tartanAccent = (t: Pick<Tartan, 'threadcount' | 'palette'>) => tartanAccents(t)[0] ?? '#0065bd'

/** Valid enough to draw: parses, and every colour code has a hex. */
export function tartanProblem(t: Pick<Tartan, 'threadcount' | 'palette'>): string | null {
  const parsed = parseThreadcount(t.threadcount)
  if (!parsed) return 'Stripes need a colour letter and a thread count, like R24 K8.'
  const missing = [...new Set(parsed.stripes.map((s) => s.code))].filter((c) => !/^#[0-9a-f]{6}$/i.test(t.palette[c] ?? ''))
  if (missing.length) return `Pick a colour for ${missing.join(', ')}.`
  const total = expandSett(t)?.length ?? 0
  if (total < 8) return 'Add a few more threads.'
  if (total > 1200) return 'That’s more threads than a real sett. Try smaller counts.'
  return null
}

/**
 * Colours to build with, named plainly, using the Scottish Register's letter
 * codes so a typed threadcount like "G24 K4" just works.
 */
export const LOOM_COLOURS: { code: string; hex: string; label: string }[] = [
  { code: 'R', hex: '#C80000', label: 'Red' },
  { code: 'M', hex: '#78002C', label: 'Maroon' },
  { code: 'O', hex: '#EC5800', label: 'Orange' },
  { code: 'Y', hex: '#E8C000', label: 'Gold' },
  { code: 'LG', hex: '#6C9C3C', label: 'Light green' },
  { code: 'G', hex: '#006818', label: 'Green' },
  { code: 'DG', hex: '#003C1C', label: 'Dark green' },
  { code: 'AZ', hex: '#48A4C0', label: 'Sky blue' },
  { code: 'B', hex: '#2C2C80', label: 'Blue' },
  { code: 'DB', hex: '#141438', label: 'Navy' },
  { code: 'P', hex: '#780078', label: 'Purple' },
  { code: 'LP', hex: '#A888C8', label: 'Lilac' },
  { code: 'T', hex: '#A0703C', label: 'Tan' },
  { code: 'N', hex: '#888888', label: 'Grey' },
  { code: 'W', hex: '#F4F0E4', label: 'White' },
  { code: 'K', hex: '#101010', label: 'Black' },
]

/** Stripes from the centre out, mirrored like most tartans. */
export function stripesToTartan(stripes: { code: string; count: number }[]) {
  const palette: Record<string, string> = {}
  for (const s of stripes) palette[s.code] = LOOM_COLOURS.find((c) => c.code === s.code)?.hex ?? '#888888'
  const last = stripes.length - 1
  const threadcount = stripes
    .map((s, i) => (last > 0 && (i === 0 || i === last) ? `${s.code}/${s.count}` : `${s.code}${s.count}`))
    .join(' ')
  return { threadcount, palette }
}
