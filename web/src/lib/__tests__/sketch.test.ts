import { describe, expect, it } from 'vitest'
import { blob, loop, rng, sampleRoad, wobble } from '@/lib/sketch'

describe('sketch', () => {
  it('draws the same marks for the same seed', () => {
    expect(loop({ x: 10, y: 10 }, 8, 8, rng(3))).toBe(
      loop({ x: 10, y: 10 }, 8, 8, rng(3)),
    )
    expect(blob({ x: 0, y: 0 }, 5, rng(4))).toBe(blob({ x: 0, y: 0 }, 5, rng(4)))
    expect(loop({ x: 10, y: 10 }, 8, 8, rng(3))).not.toBe(
      loop({ x: 10, y: 10 }, 8, 8, rng(5)),
    )
  })

  it('samples the road through every stop, measuring how far along each one is', () => {
    const stops = [
      { x: 20, y: 0 },
      { x: 80, y: 100 },
      { x: 30, y: 250 },
    ]
    const road = sampleRoad(stops)
    expect(road.at.map((i) => road.P[i])).toMatchObject(stops)
    expect(road.along[0]).toBe(0)
    expect(road.along[1]).toBeGreaterThan(Math.hypot(60, 100) - 0.01)
    expect(road.along[2]).toBe(road.total)
    expect(road.P.every((p, i) => i === 0 || p.s > road.P[i - 1].s)).toBe(true)
  })

  it('wobbles a road by no more than its amplitude', () => {
    const { P } = sampleRoad([
      { x: 50, y: 0 },
      { x: 50, y: 200 },
    ])
    const w = wobble(P, 1.5, rng(1))
    expect(w.every((p, i) => Math.hypot(p.x - P[i].x, p.y - P[i].y) <= 1.5)).toBe(true)
    expect(w.some((p, i) => p.x !== P[i].x)).toBe(true)
  })

  it('has no road without stops', () => {
    expect(sampleRoad([])).toEqual({ P: [], at: [], along: [], total: 0 })
  })
})
