import { describe, expect, it } from 'vitest'
import { alongMenu, byPath, inverse, types } from '@/lib/navMotion'

const rect = (left: number, top: number) => ({ left, top }) as DOMRect

describe('page motion', () => {
  it('goes deeper under the current page, back above it, and swaps otherwise', () => {
    expect(byPath('/competitions/a/info', '/competitions').way).toBe('forward')
    expect(byPath('/dancers', '/dancers/x/info').way).toBe('back')
    expect(byPath('/settings', '/about').way).toBe('swap')
    // A shared prefix isn't enough: /competitions/b isn't under /competitions/a.
    expect(byPath('/competitions/b/info', '/competitions/a/info').way).toBe('swap')
  })

  it('moves toward the tapped item along its menu', () => {
    expect(alongMenu('x', rect(0, 0), rect(90, 0))).toEqual({ way: 'next', axis: 'x' })
    expect(alongMenu('x', rect(180, 0), rect(90, 0))).toEqual({ way: 'prev', axis: 'x' })
    expect(alongMenu('y', rect(0, 300), rect(0, 120))).toEqual({ way: 'prev', axis: 'y' })
    expect(alongMenu('y', rect(0, 120), rect(0, 300))).toEqual({ way: 'next', axis: 'y' })
  })

  it('plays Back as the reverse of how you got there', () => {
    expect(inverse({ way: 'next', axis: 'y' })).toEqual({ way: 'prev', axis: 'y' })
    expect(inverse({ way: 'forward', axis: 'x' })).toEqual({ way: 'back', axis: 'x' })
    expect(inverse({ way: 'swap', axis: 'x' })).toEqual({ way: 'swap', axis: 'x' })
  })

  it('names the way and the axis for the stylesheet', () => {
    expect(types({ way: 'prev', axis: 'y' })).toEqual(['prev', 'axis-y'])
  })
})
