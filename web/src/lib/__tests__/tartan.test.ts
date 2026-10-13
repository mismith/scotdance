import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BLACK,
  CLOTH,
  MAX_STRIPES,
  PRESETS,
  clothBackground,
  clothInk,
  codeFor,
  formatSett,
  isCloth,
  isLightCloth,
  isWoven,
  paletteOf,
  parseSett,
  presetOf,
  recolor,
  remix,
  remixes,
  repeatOf,
  settle,
  solidOf,
  stripeAt,
  threadsIn,
  tidy,
  tileSize,
  weavePreset,
  type Hex,
} from '@/lib/tartan'

// Dancer tartans: a sett is the stripes from the middle out, mirrored, in
// four fixed widths; each letter is a colour (K and W are black and white,
// the rest come with the recipe).

/** A repeatable stand-in for Math.random. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32
    return seed / 2 ** 32
  }
}

describe('setts', () => {
  it('reads the builder’s notation and writes it back the same', () => {
    const stripes = parseSett('P40 K16 S16 K2 T2')
    expect(stripes).toEqual([
      { code: 'P', width: 40 },
      { code: 'K', width: 16 },
      { code: 'S', width: 16 },
      { code: 'K', width: 2 },
      { code: 'T', width: 2 },
    ])
    expect(formatSett(stripes!)).toBe('P40 K16 S16 K2 T2')
    expect(parseSett('  W40   P6 ')).toEqual([
      { code: 'W', width: 40 },
      { code: 'P', width: 6 },
    ])
  })

  it('refuses anything the builder can’t make: other widths, letters or lengths', () => {
    expect(parseSett('P41')).toBeNull()
    expect(parseSett('R40 K16')).toEqual([
      { code: 'R', width: 40 },
      { code: 'K', width: 16 },
    ])
    expect(parseSett('p40')).toBeNull()
    expect(parseSett('P/40 K4')).toBeNull()
    expect(parseSett('')).toBeNull()
    expect(parseSett(42)).toBeNull()
    expect(parseSett(Array(MAX_STRIPES + 1).fill('P2').join(' '))).toBeNull()
    expect(parseSett(Array(MAX_STRIPES).fill('P2').join(' '))).toHaveLength(MAX_STRIPES)
  })

  it('has nine presets that all parse, so with Plain they fill two rows of five', () => {
    expect(PRESETS).toHaveLength(9)
    for (const p of PRESETS) expect(parseSett(p.sett), p.name).not.toBeNull()
    expect(new Set(PRESETS.map((p) => p.sett)).size).toBe(PRESETS.length)
  })

  it('knows a preset however its colours are lettered, until it’s changed', () => {
    expect(presetOf({ color: 'dancer-2', sett: 'A16 K16', colors: { A: '#1d6a48' } })?.name).toBe('Reel')
    expect(presetOf(weavePreset('P16 K16', '#123456'))?.name).toBe('Reel')
    expect(presetOf({ color: 'dancer-2', sett: 'P16 K16 T2', colors: { P: '#1d6a48', T: '#e8c000' } })).toBeNull()
    expect(presetOf({ color: 'dancer-2', sett: 'P16 K16', colors: { P: '#b0102c' } })).toBeNull()
  })
})

describe('weaving', () => {
  it('mirrors a repeat out from the first stripe without doubling the pivots', () => {
    expect(repeatOf(['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd', 'c', 'b'])
    expect(repeatOf(['a', 'b'])).toEqual(['a', 'b'])
    expect(repeatOf(['a'])).toEqual(['a'])
    expect(threadsIn(parseSett('P40 K16 S16 K2 T2')!)).toBe(40 + 16 + 16 + 2 + 2 + 2 + 16 + 16)
  })

  it('finds the stripe at any point in the cloth, mirror and repeats included', () => {
    const s = parseSett('P40 K16 S16 K2 T2')!
    const at = (t: number) => stripeAt(s, t).index
    expect([0, 39, 40, 56, 72, 74, 76, 78, 94, 109, 110, -1].map(at)).toEqual([0, 0, 1, 2, 3, 4, 3, 2, 1, 1, 0, 1])
    expect(stripeAt(s, 75)).toEqual({ index: 4, width: 2 })
  })

  it('cuts every tile from cloth of one scale, clamped for tiny and huge setts', () => {
    expect(tileSize(32)).toBe(16)
    expect(tileSize(110)).toBe(34)
    expect(tileSize(102) % 2).toBe(0)
    expect(tileSize(1000)).toBe(200)
  })
})

describe('colours', () => {
  it('dyes cloth in the light theme’s dancer colours', () => {
    const css = readFileSync(`${process.cwd()}/src/style.css`, 'utf8')
    const root = css.slice(css.indexOf('\n:root {'), css.indexOf('\n}', css.indexOf('\n:root {')))
    for (const [id, hex] of Object.entries(CLOTH)) expect(root, id).toContain(`--${id}: ${hex};`)
  })

  it('weaves a preset in the dancer’s colour and the pair that goes with it, keeping only the colours it uses', () => {
    expect(weavePreset('P40 K16 S16 K2 T2', 'dancer-1')).toEqual({
      color: 'dancer-1',
      sett: 'P40 K16 S16 K2 T2',
      colors: { P: '#b0102c', S: '#14306b', T: '#e8c000' },
    })
    expect(weavePreset('P16 K16', '#123456').colors).toEqual({ P: '#123456' })
    // (Purple's pair is green and white: white is woven as W.)
    expect(weavePreset('P40 K16 S16 K2 T2', 'dancer-3')).toEqual({
      color: 'dancer-3',
      sett: 'P40 K16 S16 K2 W2',
      colors: { P: '#6a3fa0', S: '#1d6a48' },
    })
    expect(paletteOf(weavePreset('P16 K16', 'dancer-1'))).toEqual({ P: '#b0102c', K: '#1a1c22', W: '#f1ede2' })
  })

  it('weaves only what has a colour for every stripe', () => {
    expect(isWoven({ sett: 'P16 K16 W2', colors: { P: '#b0102c' } })).toBe(true)
    expect(isWoven({ sett: 'P16 R16', colors: { P: '#b0102c' } })).toBe(false)
    expect(tidy({ color: 'dancer-1', sett: 'P16 K16', colors: { P: '#b0102c', S: '#14306b' } }).colors).toEqual({ P: '#b0102c' })
  })

  it('letters a new colour with the next free capital, and black and white as K and W', () => {
    const colors: Record<string, Hex> = { A: '#b0102c' }
    expect(codeFor(colors, BLACK)).toBe('K')
    expect(codeFor(colors, '#F1EDE2')).toBe('W')
    expect(codeFor(colors, '#B0102C')).toBe('A')
    expect(codeFor(colors, '#123456')).toBe('B')
    expect(colors).toEqual({ A: '#b0102c', B: '#123456' })
  })

  it('reweaves a preset in a new colour, and repaints only the old colour’s stripes on anything else', () => {
    expect(recolor(weavePreset('P40 K16 S16 K2 T2', 'dancer-1'), 'dancer-5')).toEqual(weavePreset('P40 K16 S16 K2 T2', 'dancer-5'))
    const own = { color: 'dancer-1', sett: 'P40 A6 K2', colors: { P: '#b0102c', A: '#123456' } } as const
    expect(recolor(own, 'dancer-2')).toEqual({ color: 'dancer-2', sett: 'P40 A6 K2', colors: { P: '#1d6a48', A: '#123456' } })
  })

  it('moves the dancer’s colour once no stripe wears theirs: to the one painted, else the one woven most', () => {
    const t = { color: 'dancer-1', sett: 'P6 A40 K2', colors: { P: '#b0102c', A: '#14306b' } } as const
    expect(settle(t)).toBe(t)
    expect(settle({ ...t, colors: { P: '#e8c000', A: '#14306b' } }).color).toBe('dancer-9')
    expect(settle({ ...t, colors: { P: '#e8c000', A: '#14306b' } }, '#e8c000').color).toBe('#e8c000')
    expect(settle({ ...t, colors: { P: '#e8c000', A: '#ABCDEF' } }).color).toBe('#abcdef')
    // Black and white only when there’s nothing else.
    expect(settle({ color: 'dancer-1', sett: 'A16 K40', colors: { A: '#b5800a' } }).color).toBe('dancer-4')
    expect(settle({ color: 'dancer-1', sett: 'A16 K40', colors: { A: '#b5800a' } }, BLACK).color).toBe('dancer-4')
    expect(settle({ color: 'dancer-1', sett: 'W16 K40', colors: {} }).color).toBe('#1a1c22')
  })

  it('knows light cloth from dark, for the ink on it', () => {
    const lilt = weavePreset('W40 P6 W6 S16 W2 T2', 'dancer-7')
    expect(isLightCloth(parseSett(lilt.sett)!, paletteOf(lilt))).toBe(true)
    const fling = weavePreset('P40 K16 S16 K2 T2', 'dancer-1')
    expect(isLightCloth(parseSett(fling.sett)!, paletteOf(fling))).toBe(false)
    expect(clothInk('var(--cloth-abc)')).toEqual({ ink: 'var(--cloth-abc-ink)', halo: 'var(--cloth-abc-halo)' })
  })

  it('stands in a dot for cloth with the tartan’s first colour, and passes plain colours through', () => {
    expect(isCloth('var(--cloth-abc)')).toBe(true)
    expect(solidOf('var(--cloth-abc)')).toBe('var(--cloth-abc-solid)')
    expect(solidOf('var(--dancer-2)')).toBe('var(--dancer-2)')
    expect(solidOf('#12ab9f')).toBe('#12ab9f')
    expect(solidOf(null)).toBeNull()
  })

  it('wears the first colour where there’s no canvas to weave on', () => {
    expect(clothBackground(weavePreset('P16 K16', 'dancer-2'), 'a')).toBe('var(--dancer-2)')
    expect(clothBackground(weavePreset('P16 K16', '#12ab9f'), 'a')).toBe('#12ab9f')
  })
})

describe('ideas', () => {
  const fling = parseSett('P40 K16 S16 K2 T2')!

  it('remixes a sett into something new the builder can make, leaving the original alone', () => {
    const random = seeded(7)
    for (let i = 0; i < 200; i++) {
      const r = remix(fling, random)
      expect(parseSett(formatSett(r))).toEqual(r)
      expect(r.length).toBe(fling.length)
    }
    expect(formatSett(fling)).toBe('P40 K16 S16 K2 T2')
  })

  it('offers different ideas, none of them the sett itself', () => {
    const ideas = remixes(fling, 8, seeded(3))
    const keys = ideas.map(formatSett)
    expect(ideas).toHaveLength(8)
    expect(new Set(keys).size).toBe(8)
    expect(keys).not.toContain('P40 K16 S16 K2 T2')
  })
})
