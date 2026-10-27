import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  listeners: new Map<string, (snap: { val: () => unknown }) => void>(),
  get: vi.fn(),
}))
vi.mock('@/firebase', () => ({ database: {} }))
vi.mock('firebase/database', () => ({
  ref: (_db: unknown, path: string) => ({ toString: () => path }),
  get: db.get,
  onValue: (q: { toString(): string }, cb: (snap: { val: () => unknown }) => void) => {
    const path = q.toString()
    db.listeners.set(path, cb)
    return () => db.listeners.delete(path)
  },
}))
const query = (path: string) => ({ toString: () => path }) as never
const emit = (path: string, value: unknown) =>
  db.listeners.get(path)?.({ val: () => value })
const disk = new Map<string, unknown>()
function request(result: unknown) {
  const req = { result, onsuccess: undefined as (() => void) | undefined }
  Promise.resolve().then(() => req.onsuccess?.())
  return req
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  db.listeners.clear()
  disk.clear()
  db.get.mockReset().mockImplementation(() => new Promise(() => {}))
  const store = {
    get: (key: string) => request(disk.get(key)),
    put: (value: unknown, key: string) => (disk.set(key, value), request(undefined)),
    openCursor: () => request(null),
  }
  vi.stubGlobal('indexedDB', {
    open: () => request({ transaction: () => ({ objectStore: () => store }) }),
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('shows connection loss even without reading from disk, and clears it on reconnect', async () => {
  const offline = await import('@/lib/offline')
  emit('.info/connected', true)
  const recovered = vi.fn()
  const remove = offline.onReconnect(recovered)
  emit('.info/connected', false)
  await vi.advanceTimersByTimeAsync(3000)
  expect(offline.offline.value).toBe(true)
  expect(offline.showingSavedFrom.value).toBeNull()
  emit('.info/connected', true)
  expect(offline.offline.value).toBe(false)
  expect(recovered).toHaveBeenCalledTimes(1)
  remove()
  emit('.info/connected', false)
  emit('.info/connected', true)
  expect(recovered).toHaveBeenCalledTimes(1)
})

it('finishes an uncached read with an offline error instead of waiting forever', async () => {
  const offline = await import('@/lib/offline')
  const failed = vi.fn()
  void offline.getSaved(query('missing')).catch(failed)
  await vi.advanceTimersByTimeAsync(3000)
  expect(failed).toHaveBeenCalledOnce()
  expect(failed.mock.calls[0][0]).toBeInstanceOf(offline.OfflineUnavailableError)
})

it('also handles a connection lost after a read has already waited online', async () => {
  const offline = await import('@/lib/offline')
  emit('.info/connected', true)
  const failed = vi.fn()
  void offline.getSaved(query('missing')).catch(failed)
  await vi.advanceTimersByTimeAsync(5000)
  expect(failed).not.toHaveBeenCalled()
  emit('.info/connected', false)
  await vi.advanceTimersByTimeAsync(3000)
  expect(failed).toHaveBeenCalledOnce()
})

it('keeps a failed offline listener alive so it recovers when data arrives', async () => {
  const offline = await import('@/lib/offline')
  const got = vi.fn()
  const failed = vi.fn()
  const stop = offline.onValueSaved(query('missing'), got, failed)
  await vi.advanceTimersByTimeAsync(3000)
  expect(failed).toHaveBeenCalledOnce()
  emit('.info/connected', true)
  emit('missing', { name: 'Now available' })
  expect(got.mock.calls[0][0].val()).toEqual({ name: 'Now available' })
  stop()
})

it('does not call back after an offline listener is stopped', async () => {
  const offline = await import('@/lib/offline')
  const got = vi.fn()
  const failed = vi.fn()
  const stop = offline.onValueSaved(query('missing'), got, failed)
  stop()
  await vi.advanceTimersByTimeAsync(3000)
  expect(got).not.toHaveBeenCalled()
  expect(failed).not.toHaveBeenCalled()
})
