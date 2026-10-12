import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CLOTH,
  MAX_STRIPES,
  PRESETS,
  clothBackground,
  clothInk,
  formatSett,
  isCloth,
  isLightCloth,
  paletteOf,
  parseSett,
  presetFor,
  remix,
  remixes,
  repeatOf,
  solidOf,
  stripeAt,
  threadsIn,
  tileSize,
} from '@/lib/tartan'

// Dancer tartans: a sett is the stripes from the middle out, mirrored, in
// four fixed widths; colours are roles that each follower fills in.

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
      { role: 'P', width: 40 },
      { role: 'K', width: 16 },
      { role: 'S', width: 16 },
      { role: 'K', width: 2 },
      { role: 'T', width: 2 },
    ])
    expect(formatSett(stripes!)).toBe('P40 K16 S16 K2 T2')
    expect(parseSett('  W40   P6 ')).toEqual([
      { role: 'W', width: 40 },
      { role: 'P', width: 6 },
    ])
  })

  it('refuses anything the builder can’t make: other widths, colours or lengths', () => {
    expect(parseSett('P41')).toBeNull()
    expect(parseSett('R40 K16')).toBeNull()
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
    expect(presetFor('P16 K16')?.name).toBe('Reel')
    expect(presetFor('P16 K16 T2')).toBeNull()
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
    expect(tileSize(32)).toBe(36)
    expect(tileSize(110)).toBe(66)
    expect(tileSize(102) % 2).toBe(0)
    expect(tileSize(1000)).toBe(220)
  })
})

describe('colours', () => {
  it('dyes cloth in the light theme’s dancer colours', () => {
    const css = readFileSync(`${process.cwd()}/src/style.css`, 'utf8')
    const root = css.slice(css.indexOf('\n:root {'), css.indexOf('\n}', css.indexOf('\n:root {')))
    for (const [id, hex] of Object.entries(CLOTH)) expect(root, id).toContain(`--${id}: ${hex};`)
  })

  it('pairs second and third colours with the first until someone chooses their own', () => {
    expect(paletteOf({ color: 'dancer-1' })).toMatchObject({ P: '#b0102c', S: '#14306b', T: '#e8c000', K: '#1a1c22', W: '#f1ede2' })
    expect(paletteOf({ color: 'dancer-1', third: '#48a4c0' })).toMatchObject({ S: '#14306b', T: '#48a4c0' })
    expect(paletteOf({ color: '#123456' })).toMatchObject({ P: '#123456', S: '#14306b', T: '#e8c000' })
  })

  it('knows light cloth from dark, for the ink on it', () => {
    const lilt = parseSett('W40 P6 W6 S16 W2 T2')!
    expect(isLightCloth(lilt, paletteOf({ color: 'dancer-7' }))).toBe(true)
    expect(isLightCloth(parseSett('P40 K16 S16 K2 T2')!, paletteOf({ color: 'dancer-1' }))).toBe(false)
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
    expect(clothBackground({ color: 'dancer-2', sett: 'P16 K16' }, 'a')).toBe('var(--dancer-2)')
    expect(clothBackground({ color: '#12ab9f', sett: 'P16 K16' }, 'a')).toBe('#12ab9f')
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
