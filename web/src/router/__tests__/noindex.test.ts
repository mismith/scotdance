import { describe, expect, it, vi } from 'vitest'

// Which pages search engines are told not to index: the ones with dancers'
// names. Competitions themselves, and judges and pipers, stay findable.

vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({}) }))
vi.mock('@/lib/deviceHistory', () => ({
  ROUTE_INFO_KEY: 'route-info',
  SCROLL_POSITIONS_KEY: 'scroll-positions',
}))

const { router } = await import('@/router')
const noindex = (path: string) => !!router.resolve(path).meta.noindex

describe('noindex routes', () => {
  it.each([
    '/dancers',
    '/dancers/d1/info',
    '/search?q=smith',
    '/competitions/c1/dancers',
    '/competitions/c1/dancers/d1',
    '/competitions/c1/results/g1',
  ])('hides %s', (path) => expect(noindex(path)).toBe(true))

  it.each([
    '/',
    '/competitions',
    '/competitions/c1/info',
    '/competitions/c1/schedule',
    '/competitions/c1/results',
    '/venues/v1/info',
    '/judges/j1/info',
    '/pipers/p1/info',
  ])('keeps %s', (path) => expect(noindex(path)).toBe(false))
})
