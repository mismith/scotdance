import { beforeEach, describe, expect, it, vi } from 'vitest'

// Copies saved on the device: one read at the same last-changed stamp is
// still current, so it's used without downloading. IndexedDB is a small
// in-memory stand-in for the calls offline.ts makes; Firebase is stubbed.

const saved = new Map<string, unknown>()
function request<T>(result: T) {
  const r: { result: T; onsuccess?: () => void } = { result }
  queueMicrotask(() => r.onsuccess?.())
  return r
}
globalThis.indexedDB = {
  open: () => {
    const store = {
      get: (key: string) => request(saved.get(key)),
      put: (value: unknown, key: string) => (saved.set(key, value), request(undefined)),
      clear: () => (saved.clear(), request(undefined)),
      openCursor: () => request(null),
    }
    const db = { createObjectStore: () => store, transaction: () => ({ objectStore: () => store }) }
    const r: { result: typeof db; onupgradeneeded?: () => void; onsuccess?: () => void } = { result: db }
    queueMicrotask(() => {
      r.onupgradeneeded?.()
      r.onsuccess?.()
    })
    return r
  },
} as unknown as IDBFactory

const downloads = vi.fn()
vi.mock('@/firebase', () => ({ database: {} }))
vi.mock('firebase/database', () => ({
  ref: (_db: unknown, path: string) => ({ path, toString: () => path }),
  get: async (q: { path: string }) => {
    downloads(q.path)
    return { val: () => `fresh ${q.path} #${downloads.mock.calls.length}` }
  },
  onValue: () => () => {},
}))

const { getSaved, getSavedAt } = await import('@/lib/offline')
const { ref } = await import('firebase/database')
const at = (path: string) => ref({} as never, path)
// Saving happens in the background: let it land.
const settle = () => new Promise((r) => setTimeout(r))

beforeEach(() => {
  saved.clear()
  downloads.mockClear()
})

describe('getSavedAt', () => {
  it('downloads once, then re-uses the saved copy while the stamp is the same', async () => {
    expect((await getSavedAt(at('results'), 5)).val()).toBe('fresh results #1')
    await settle()
    expect((await getSavedAt(at('results'), 5)).val()).toBe('fresh results #1')
    expect(downloads).toHaveBeenCalledTimes(1)
  })

  it('downloads again once the stamp moves', async () => {
    await getSavedAt(at('results'), 5)
    await settle()
    expect((await getSavedAt(at('results'), 6)).val()).toBe('fresh results #2')
    expect(downloads).toHaveBeenCalledTimes(2)
  })

  it('never goes by a copy without a stamp', async () => {
    await getSaved(at('dancers'))
    await settle()
    await getSavedAt(at('dancers'), 5) // saved unstamped (say, streamed on the day)
    await settle()
    await getSavedAt(at('dancers'), null) // nothing stamped yet
    expect(downloads).toHaveBeenCalledTimes(3)
  })
})
