import { describe, expect, it } from 'vitest'
import { isBlank, levels, stretch, toGrey } from '@/lib/admin/sheetImage'
import { pageCount, sheetPages } from '@/lib/sheets'
import type { SheetsTree } from '@/types/competition'

// Judges' sheets (ADR 0013): a dance's pages, and how a photo of one is
// made clear before it uploads (lib/admin/sheetImage).

const page = (order?: number) => ({ url: 'https://x/p.webp', path: 'competitions/sheets/c1/p.webp', width: 1500, height: 2000, ...(order == null ? {} : { _order: order }) })

describe('sheetPages', () => {
  it('lists a dance’s pages in order: by _order, then as they were added', () => {
    const tree: SheetsTree = { g1: { d1: { '-b': page(2), '-a': page(1), '-d': page(), '-c': page() } } }
    expect(sheetPages(tree, 'g1', 'd1').map((p) => p.id)).toEqual(['-a', '-b', '-c', '-d'])
  })

  it('has none for a dance, an age group or a competition without any', () => {
    expect(sheetPages({ g1: { d1: { '-a': page(1) } } }, 'g1', 'd2')).toEqual([])
    expect(sheetPages({}, 'g2', 'd1')).toEqual([])
    expect(sheetPages(null, 'g1', 'd1')).toEqual([])
  })

  it('skips anything that isn’t a page (a hand edit)', () => {
    const tree = { g1: { d1: { '-a': page(1), '-b': 'nope', '-c': { url: 'https://x' }, '-d': { ...page(4), width: 0 } } } } as unknown as SheetsTree
    expect(sheetPages(tree, 'g1', 'd1').map((p) => p.id)).toEqual(['-a'])
  })

  it('says how many pages only when there’s more than one', () => {
    expect(pageCount(1)).toBe('')
    expect(pageCount(3)).toBe('3 pages')
  })
})

// RGBA pixels from grey shades.
const pixels = (...shades: number[]) => new Uint8ClampedArray(shades.flatMap((v) => [v, v, v, 255]))

describe('making a photo of a sheet clear', () => {
  it('turns pixels grey by how bright they look (green brightest, blue least)', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255])
    toGrey(data)
    const [red, green, blue] = [data[0], data[4], data[8]]
    expect(green).toBeGreaterThan(red)
    expect(red).toBeGreaterThan(blue)
    expect([data[1], data[2]]).toEqual([red, red])
    expect(data[3]).toBe(255)
  })

  it('finds the ink and the paper of a photo taken in poor light', () => {
    // A grey page (paper at 180) with a little dark grey ink (60).
    const histogram = toGrey(pixels(...Array(90).fill(180), ...Array(10).fill(60)))
    expect(levels(histogram)).toEqual({ black: 60, white: 180 })
  })

  it('leaves a flat picture (a blank page, a dark blur) as it is', () => {
    expect(levels(toGrey(pixels(...Array(100).fill(128))))).toBeNull()
    expect(levels(new Uint32Array(256))).toBeNull()
  })

  it('knows a blank page (an export’s last one, or a scan it couldn’t draw) from a sparse one', () => {
    expect(isBlank(toGrey(pixels(...Array(10000).fill(255))))).toBe(true)
    expect(isBlank(toGrey(pixels(...Array(9999).fill(255), 30)))).toBe(true)
    // One line of print on a page is still a page.
    expect(isBlank(toGrey(pixels(...Array(9990).fill(255), ...Array(10).fill(30))))).toBe(false)
    expect(isBlank(new Uint32Array(256))).toBe(false)
  })

  it('lifts the paper to white and drops the ink to black', () => {
    const data = pixels(180, 60, 120)
    stretch(data, { black: 60, white: 180 })
    expect([data[0], data[4]]).toEqual([255, 0])
    expect(data[8]).toBeGreaterThan(100)
    expect(data[8]).toBeLessThan(155)
    expect(data[3]).toBe(255)
  })
})
