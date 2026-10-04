import { describe, expect, it } from 'vitest'
import { tapGuard } from '@/lib/admin/results'

// The guards around tap-to-pick results entry. The stored format itself is
// covered against the old admin in lib/__tests__/adminResults.test.ts.


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
