import { describe, expect, it, vi } from 'vitest'

vi.mock('@/firebase', () => ({ functions: {}, useEmulators: false }))

import { assistantAddress, connectionDate, connectionsFrom } from '../assistants'

describe('assistants', () => {
  it('gives the address people paste into their assistant', () => {
    expect(assistantAddress()).toBe('https://next.scotdance.app/mcp')
  })

  it('lists connections newest first, and copes with none', () => {
    expect(connectionsFrom(null)).toEqual([])
    const list = connectionsFrom({
      a: { client: { name: 'Claude' }, createdAt: 1 },
      b: { client: { name: 'ChatGPT' }, createdAt: 3 },
      c: { createdAt: 2 },
    })
    expect(list.map((c) => c.id)).toEqual(['b', 'c', 'a'])
  })

  it('says today, or the day', () => {
    expect(connectionDate(undefined)).toBe('')
    expect(connectionDate(Date.now())).toBe('today')
    expect(connectionDate(Date.UTC(2020, 5, 15, 12))).toMatch(/2020/)
  })
})
