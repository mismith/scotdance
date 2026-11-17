import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useConnectAccount } from '../account'
let authenticated = false
const signIn = vi.fn(async () => ({ signedIn: true, uid: 'owner', pass: 'token' }))
const fetcher = vi.fn(async (url: string) => {
  if (url.endsWith('/login')) authenticated = true
  if (url.endsWith('/logout')) authenticated = false
  if (url.endsWith('/load')) return new Response(JSON.stringify(authenticated
    ? { account: { uid: 'owner', name: 'Test', email: 'test@example.test' }, dancers: [] }
    : { error: 'Sign in' }), { status: authenticated ? 200 : 401 })
  return new Response('{}')
})
beforeEach(() => {
  localStorage.clear(); authenticated = false; vi.clearAllMocks()
  setActivePinia(createPinia()); vi.stubGlobal('fetch', fetcher)
  Object.assign(window, { ScotDance: { signIn } })
})
afterEach(() => { vi.unstubAllGlobals(); Reflect.deleteProperty(window, 'ScotDance') })
it('keeps an explicit sign-out across reloads until an explicit sign-in', async () => {
  const first = useConnectAccount(); await first.initialize(true)
  expect(first.account?.uid).toBe('owner')
  await first.logout(); expect(first.account).toBeNull(); expect(authenticated).toBe(false)
  const calls = fetcher.mock.calls.length
  setActivePinia(createPinia()); const reloaded = useConnectAccount(); await reloaded.initialize(true)
  expect(reloaded.ready).toBe(true); expect(reloaded.account).toBeNull()
  expect(fetcher).toHaveBeenCalledTimes(calls); expect(signIn).toHaveBeenCalledTimes(1)
  await reloaded.login(); expect(reloaded.account?.uid).toBe('owner')
  setActivePinia(createPinia()); const signedInReload = useConnectAccount(); await signedInReload.initialize(true)
  expect(signedInReload.account?.uid).toBe('owner'); expect(signIn).toHaveBeenCalledTimes(2)
})
it('does not forget a sign-out when the login sheet is dismissed', async () => {
  localStorage.setItem('connect.signed-out', 'true')
  signIn.mockResolvedValueOnce({ signedIn: false, uid: '', pass: '' })
  const store = useConnectAccount(); await store.login()
  expect(localStorage.getItem('connect.signed-out')).toBe('true')
})
