import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// Keep Firebase out: record what would be sent instead.
const sent: Array<Record<string, unknown>> = []
let failWith: Error | null = null
vi.mock('firebase/database', () => ({
  ref: (_db: unknown, path = '') => ({ path }),
  push: () => ({ key: '-NewKey' }),
  update: (_ref: unknown, updates: Record<string, unknown>) => {
    if (failWith) return Promise.reject(failWith)
    sent.push(updates)
    return Promise.resolve()
  },
}))
vi.mock('@/firebase', () => ({ database: {} }))
const connected = ref(true)
vi.mock('@/lib/offline', () => ({ connected }))

const { OfflineError, canEdit, friendlyError, newKey, saveState, write } = await import('@/lib/admin/write')
const { at, snapshot } = await import('@/lib/admin/collection')

const NS = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

beforeEach(() => {
  sent.length = 0
  failWith = null
  connected.value = true
  saveState.error = null
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('write', () => {
  it('sends one multi-path update under the namespace, clearing empty values', async () => {
    await write({ 'competitions:data/c1/dancers/d1/firstName': 'Ava', 'competitions:data/c1/dancers/d1/location': '', 'competitions:data/c1/dancers/d2': null, 'competitions/c1/sobhd': undefined })
    expect(sent).toEqual([
      {
        [`${NS}/competitions:data/c1/dancers/d1/firstName`]: 'Ava',
        [`${NS}/competitions:data/c1/dancers/d1/location`]: null,
        [`${NS}/competitions:data/c1/dancers/d2`]: null,
        [`${NS}/competitions/c1/sobhd`]: null,
      },
    ])
    expect(saveState.pending).toBe(0)
    expect(saveState.lastSavedAt).toBeTypeOf('number')
  })

  it('keeps zero and false', async () => {
    await write({ 'a/_order': 0, 'a/listed': false })
    expect(sent[0]).toEqual({ [`${NS}/a/_order`]: 0, [`${NS}/a/listed`]: false })
  })

  it('sends nothing for no changes', async () => {
    await write({})
    expect(sent).toEqual([])
  })

  it('refuses while offline, with a clear message', async () => {
    connected.value = false
    expect(canEdit.value).toBe(false)
    await expect(write({ a: 1 })).rejects.toBeInstanceOf(OfflineError)
    expect(sent).toEqual([])
    expect(saveState.error).toBe('You’re offline. Changes can’t be saved until you’re back online.')
  })

  it('reports a failed save and lets the caller know', async () => {
    failWith = new Error('PERMISSION_DENIED: Permission denied')
    await expect(write({ a: 1 })).rejects.toThrow('PERMISSION_DENIED')
    expect(saveState.error).toBe('You don’t have permission to change this.')
    expect(saveState.pending).toBe(0)
    failWith = null
    await write({ a: 2 })
    expect(saveState.error).toBeNull()
  })
})

describe('friendlyError', () => {
  it('words errors for people', () => {
    expect(friendlyError(new OfflineError())).toMatch(/offline/)
    expect(friendlyError(new Error('permission_denied at /x'))).toBe('You don’t have permission to change this.')
    expect(friendlyError('boom')).toBe('That change didn’t save. Check your connection and try again.')
  })
})

describe('newKey', () => {
  it('makes a key on the device', () => {
    expect(newKey()).toBe('-NewKey')
  })
})

describe('at / snapshot', () => {
  const raw = { dancers: { d1: { firstName: 'Ava', number: 0 } }, results: { g1: { d1: ['x', 'y'] } } }

  it('reads nested values by slash path', () => {
    expect(at(raw, 'dancers/d1/firstName')).toBe('Ava')
    expect(at(raw, 'dancers/d1/number')).toBe(0)
    expect(at(raw, 'results/g1/d1/1')).toBe('y')
    expect(at(raw, 'dancers/nope/firstName')).toBeUndefined()
    expect(at(null, 'a')).toBeUndefined()
  })

  it('remembers what each path held (null when nothing)', () => {
    expect(snapshot(raw, { 'dancers/d1/firstName': 'Mia', 'dancers/d2': { firstName: 'Lee' }, 'dancers/d1/number': 5 })).toEqual({
      'dancers/d1/firstName': 'Ava',
      'dancers/d2': null,
      'dancers/d1/number': 0,
    })
  })
})

describe('looksLikeLink', () => {
  it('accepts links people paste or type, and refuses words', async () => {
    const { looksLikeLink } = await import('@/lib/admin/collection')
    for (const ok of ['example.com', 'example.com/register', 'https://www.example.com/a?b=c', 'http://localhost:9199/v0/b/x', 'mailto:secretary@example.com', 'www.sddcs.ca']) expect(looksLikeLink(ok), ok).toBe(true)
    for (const bad of ['see website', 'examplecom', 'TBA', 'https://exa mple.com', 'javascript:alert(1)', 'javascript:void(0).x', 'data:text/html,x.y']) expect(looksLikeLink(bad), bad).toBe(false)
  })
})
