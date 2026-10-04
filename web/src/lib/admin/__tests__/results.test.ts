import { describe, expect, it } from 'vitest'
import { placedSummary, tapGuard, type Placings } from '@/lib/admin/results'

// The guards around tap-to-pick results entry. The stored format itself is
// covered against the old admin in lib/__tests__/adminResults.test.ts.

const nums: Record<string, string> = { a: '104', b: '107', c: '101', d: '12' }
const num = (id: string) => nums[id] ?? '?'
const placings = (ids: string[], reverseFrom: number | null = null): Placings => ({
  reverseFrom,
  entries: ids.map((x) => ({ id: x.split(':')[0], tie: x.endsWith(':tie') })),
})

describe('tapGuard', () => {
  function clock() {
    let t = 0
    return { now: () => t, wait: (ms: number) => (t += ms) }
  }

  it('ignores a second tap on the same dancer within half a second', () => {
    const c = clock()
    const first = tapGuard(500, c.now)
    expect(first('a')).toBe(true)
    c.wait(200)
    expect(first('a')).toBe(false)
  })

  it('lets the same dancer through again once the moment has passed', () => {
    const c = clock()
    const first = tapGuard(500, c.now)
    expect(first('a')).toBe(true)
    c.wait(500)
    expect(first('a')).toBe(true)
  })

  it('counts from the tap that went through, not the one it ignored', () => {
    const c = clock()
    const first = tapGuard(500, c.now)
    first('a')
    c.wait(300)
    expect(first('a')).toBe(false)
    c.wait(300)
    expect(first('a')).toBe(true)
  })

  it('never blocks a tap on a different dancer, however quick', () => {
    const c = clock()
    const first = tapGuard(500, c.now)
    expect(first('a')).toBe(true)
    expect(first('b')).toBe(true)
    // …and then the first dancer again is a fresh tap, not a double one.
    expect(first('a')).toBe(true)
  })
})

describe('placedSummary', () => {
  it('names who is where, 1st first', () => {
    expect(placedSummary(placings(['a', 'b', 'c']), num)).toEqual(['1st 104', '2nd 107', '3rd 101'])
  })

  it('gives tied dancers the same place', () => {
    expect(placedSummary(placings(['a', 'b', 'c:tie']), num)).toEqual(['1st 104', '2nd 107', '2nd 101'])
  })

  it('puts the best place first in Championship, as entered from the lowest', () => {
    expect(placedSummary(placings(['a', 'b'], 6), num)).toEqual(['5th 107', '6th 104'])
  })

  it('leaves the place off a dancer past the places there are, where the placed list shows them', () => {
    // From 2nd up, a third dancer entered has no place left (and sits on top).
    expect(placedSummary(placings(['a', 'b', 'c'], 2), num)).toEqual(['101', '1st 107', '2nd 104'])
  })

  it('lists callbacks by number', () => {
    expect(placedSummary(placings(['a', 'd', 'c']), num, true)).toEqual(['12', '101', '104'])
  })

  it('is empty with nobody placed', () => {
    expect(placedSummary(placings([], 6), num)).toEqual([])
  })
})
