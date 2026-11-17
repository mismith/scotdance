import { describe, expect, it } from 'vitest'
import {
  portraitFrame,
  photoFileProblem,
  PHOTO_WIDTH,
  PHOTO_HEIGHT,
  MAX_PHOTO_FILE,
} from '../photo'
describe('private portrait preparation', () => {
  it('rejects SVG, non-images, empty and oversized files before decoding', () => {
    for (const type of ['image/svg+xml', 'text/html', ''])
      expect(photoFileProblem({ type, size: 100 })).not.toBe('')
    expect(photoFileProblem({ type: 'image/jpeg', size: 0 })).not.toBe('')
    expect(photoFileProblem({ type: 'image/jpeg', size: MAX_PHOTO_FILE + 1 })).not.toBe(
      '',
    )
    expect(photoFileProblem({ type: 'image/jpeg', size: 100 })).toBe('')
    expect(photoFileProblem({ type: 'image/svg+xml', name: 'fake.heic', size: 100 })).not.toBe('')
    expect(photoFileProblem({ type: 'image/heic', size: 100 })).toBe('')
    expect(photoFileProblem({ type: '', name: 'IMG_1234.HEIC', size: 100 })).toBe('')
  })
  it('never exposes empty edges when zooming or positioning any image shape', () => {
    for (const [w, h] of [
      [400, 1000],
      [1600, 900],
      [480, 600],
    ])
      for (const zoom of [1, 1.5, 3, 5, 10])
        for (const x of [-1, 0, 1])
          for (const y of [-1, 0, 1]) {
            const f = portraitFrame(w, h, zoom, x, y)
            expect(f.left).toBeLessThanOrEqual(0)
            expect(f.top).toBeLessThanOrEqual(0)
            expect(f.left + f.width).toBeGreaterThanOrEqual(PHOTO_WIDTH)
            expect(f.top + f.height).toBeGreaterThanOrEqual(PHOTO_HEIGHT)
            expect(f.width / f.height).toBeCloseTo(w / h)
          }
  })
})
