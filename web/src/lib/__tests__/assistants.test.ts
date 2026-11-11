import { describe, expect, it, vi } from 'vitest'

vi.mock('@/firebase', () => ({ functions: {}, useEmulators: false }))

import { assistantAddress, changesFrom, connectionDate, connectionsFrom } from '../assistants'

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

  it('lists changes newest first, with undone ones marked, and skips what is not a change', () => {
    expect(changesFrom(null)).toEqual([])
    const list = changesFrom({
      a: { at: 1, scope: 'competitions', scopeId: 'c1', summary: 'Added Isla' },
      b: { at: 3, scope: 'organisations', scopeId: 'o1', summary: 'Changed location', undone: 5 },
      c: { at: 2, scope: 'competitions', scopeId: 'c1', summary: 'Undid: x', undoOf: 'a' },
      bad: { at: 'x', scope: 'competitions', scopeId: 'c1', summary: 'no' },
      worse: { at: 4, scope: 'users', scopeId: 'u', summary: 'no' },
    })
    expect(list.map((c) => c.id)).toEqual(['b', 'c', 'a'])
    expect(list[0].undone).toBe(5)
  })
})
