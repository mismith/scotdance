import { describe, expect, it } from 'vitest'
import { FITTED, bounds, clampView, eased, easedScale, fit, rubber, zoomAt } from '@/lib/zoom'

// The sheet viewer's pinch-zoom maths (lib/zoom.ts).

const stage = { width: 400, height: 500 }

describe('fit', () => {
  it('fits a tall page by its height and a wide one by its width', () => {
    expect(fit({ width: 1000, height: 2000 }, stage)).toEqual({ width: 250, height: 500 })
    expect(fit({ width: 2000, height: 1000 }, stage)).toEqual({ width: 400, height: 200 })
  })

  it('is empty before the stage has a size, or for a page without one', () => {
    expect(fit({ width: 1000, height: 2000 }, { width: 0, height: 0 })).toEqual({ width: 0, height: 0 })
    expect(fit({ width: 0, height: 0 }, stage)).toEqual({ width: 0, height: 0 })
  })
})

describe('bounds and clampView', () => {
  const fitted = { width: 400, height: 500 }

  it("can't move at all at fit", () => {
    expect(bounds(fitted, stage, 1)).toEqual({ x: 0, y: 0 })
  })

  it('moves as far as the zoomed page overhangs the stage, each way', () => {
    expect(bounds(fitted, stage, 2)).toEqual({ x: 200, y: 250 })
  })

  it('keeps a zoomed view inside those bounds, and its scale within 1..max', () => {
    expect(clampView({ scale: 2, x: 900, y: -900 }, fitted, stage, 4)).toEqual({ scale: 2, x: 200, y: -250 })
    expect(clampView({ scale: 9, x: 0, y: 0 }, fitted, stage, 4).scale).toBe(4)
  })

  it('centres the page again once it is back at fit', () => {
    expect(clampView({ scale: 0.7, x: 40, y: 40 }, fitted, stage, 4)).toEqual(FITTED)
  })
})

describe('zoomAt', () => {
  it('keeps the point under the fingers where it is', () => {
    const at = { x: 100, y: -50 }
    const before = { scale: 1.5, x: 20, y: 10 }
    const after = zoomAt(before, 3, at)
    // The page point under `at`, before and after.
    const content = (v: typeof before) => ({ x: (at.x - v.x) / v.scale, y: (at.y - v.y) / v.scale })
    expect(content(after).x).toBeCloseTo(content(before).x)
    expect(content(after).y).toBeCloseTo(content(before).y)
    expect(after.scale).toBe(3)
  })

  it('zooms about the middle without moving it', () => {
    expect(zoomAt(FITTED, 2, { x: 0, y: 0 })).toEqual({ scale: 2, x: 0, y: 0 })
  })
})

describe('rubber banding', () => {
  it('gives way less and less, and never as far as the drag', () => {
    const a = rubber(50, 400)
    const b = rubber(200, 400)
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThan(50)
    expect(b).toBeGreaterThan(a)
    expect(b / 200).toBeLessThan(a / 50)
    expect(rubber(-50, 400)).toBeCloseTo(-a)
  })

  it('leaves a position inside its bound alone', () => {
    expect(eased(30, 100, 400)).toBe(30)
    expect(eased(150, 100, 400)).toBeGreaterThan(100)
    expect(eased(150, 100, 400)).toBeLessThan(150)
    expect(eased(-150, 100, 400)).toBeLessThan(-100)
  })

  it('lets a pinch overshoot 1 and the most a little, not much', () => {
    expect(easedScale(2, 4)).toBe(2)
    expect(easedScale(8, 4)).toBeGreaterThan(4)
    expect(easedScale(8, 4)).toBeLessThan(5)
    expect(easedScale(0.3, 4)).toBeLessThan(1)
    expect(easedScale(0.3, 4)).toBeGreaterThan(0.8)
  })
})
