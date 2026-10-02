import { describe, expect, it } from 'vitest'
import { ARRIVE, CYCLE, GROUND, HOME, LIMB, MARK, pose } from '@/lib/scott'

const joints = (c: number) => {
  const p = pose(c)
  return [p.hip, p.head, ...p.hands, ...p.legs.flatMap((l) => [l.knee, l.foot])]
}

describe('Scott', () => {
  it('rests as the logo, at the start and the end of the leap', () => {
    for (const c of [0, CYCLE]) {
      const p = pose(c)
      expect(p.hip.y).toBe(HOME)
      expect(p.legs[1]!.foot.x - p.hip.x).toBeCloseTo(LIMB * Math.sin(MARK))
      expect(p.hands[0]!.y).toBeCloseTo(HOME - LIMB * Math.cos(MARK))
    }
  })

  it('launches from a plié, feet together on the floor', () => {
    const p = pose(ARRIVE)
    for (const l of p.legs) expect(l.foot.y).toBeCloseTo(GROUND)
    expect(Math.abs(p.legs[0]!.foot.x - p.legs[1]!.foot.x)).toBeLessThan(60)
    expect(p.nearFloor).toBe(1)
  })

  it('moves smoothly: no joint jumps between frames', () => {
    let prev = joints(0)
    for (let c = 1 / 120; c <= CYCLE; c += 1 / 120) {
      const now = joints(c)
      for (const [i, q] of now.entries()) expect(Math.hypot(q.x - prev[i]!.x, q.y - prev[i]!.y)).toBeLessThan(40)
      prev = now
    }
  })
})
