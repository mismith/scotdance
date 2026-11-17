import { describe, expect, it, vi } from 'vitest'
import { createFirebaseSettings } from '../firebase-settings'

const user = {
  localId: 'owner-1',
  email: 'owner@example.test',
  displayName: 'Owner',
  providerUserInfo: [{ providerId: 'password' }],
}
function setup(overrides: Record<string, object> = {}) {
  const calls: { url: string; body: Record<string, unknown> | undefined }[] = []
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ url, body })
    const action = url.match(/accounts:(\w+)/)?.[1]
    const result =
      (action && overrides[action]) ||
      (action === 'lookup'
        ? { users: [user] }
        : action === 'signInWithPassword'
          ? { ...user, idToken: 'fresh-password', expiresIn: '3600' }
          : action === 'update'
            ? { ...user, ...body, idToken: 'updated', expiresIn: '3600' }
            : url.includes('/users:tools/owner-1.json')
              ? (overrides.tools ?? {})
              : url.endsWith('/unlinkTool')
                ? (overrides.unlink ?? { result: { unlinked: ['binder'] } })
                : url.includes('/users/owner-1.json')
              ? { displayName: 'Existing name' }
              : {})
    return new Response(JSON.stringify(result), { status: 'error' in result ? 400 : 200 })
  })
  const refreshSession = vi.fn(async () => {})
  const acquireToken = vi.fn(async () => 'initial-token')
  const controller = createFirebaseSettings({
    uid: user.localId,
    acquireToken,
    refreshSession,
    fetch: fetcher as typeof fetch,
    now: () => 100000,
  })
  return { ...controller, calls, refreshSession, acquireToken }
}
describe('direct account settings', () => {
  it('reads Firebase account dates and retains them when an update response omits metadata', async () => {
    const c = setup({ lookup: { users: [{ ...user, createdAt: '1484124142000', lastLoginAt: '1484628946000', passwordUpdatedAt: 1484124177000 }] } })
    await c.load()
    const dates = { creationTime: new Date(1484124142000).toISOString(), lastSignInTime: new Date(1484628946000).toISOString(), passwordUpdatedTime: new Date(1484124177000).toISOString() }
    expect(c.settings.user?.metadata).toEqual(dates)
    await c.settings.updateDisplayName('New name')
    expect(c.settings.user?.metadata).toEqual(dates)
  })
  it('binds the identity token to the Connect owner before reading private account data', async () => {
    const c = setup({ lookup: { users: [{ ...user, localId: 'someone-else' }] } })
    await expect(c.load()).rejects.toMatchObject({ code: 'auth/user-mismatch' })
    expect(c.calls).toHaveLength(1)
  })
  it('keeps existing account names and saves only the authenticated owner’s record', async () => {
    const c = setup()
    await c.load()
    expect(c.settings.displayName).toBe('Existing name')
    await c.settings.updateDisplayName('New name')
    expect(c.settings.displayName).toBe('New name')
    const update = c.calls.find((c) => c.url.includes('accounts:update'))!
    expect(update.body).toMatchObject({
      idToken: 'initial-token',
      displayName: 'New name',
    })
    expect(c.calls.at(-1)).toMatchObject({
      url: expect.stringContaining('/production/users/owner-1.json'),
      body: { displayName: 'New name' },
    })
    expect(c.refreshSession).not.toHaveBeenCalled()
  })
  it('rejects the wrong password before changing anything', async () => {
    const c = setup({
      signInWithPassword: { error: { message: 'INVALID_LOGIN_CREDENTIALS' } },
    })
    await c.load()
    await expect(
      c.settings.updateUserPassword('new-password', 'wrong'),
    ).rejects.toMatchObject({ code: 'auth/invalid-credential' })
    expect(c.calls.some((c) => c.url.includes('accounts:update'))).toBe(false)
    expect(c.refreshSession).not.toHaveBeenCalled()
  })
  it('cannot switch owners through an email/password reauthentication', async () => {
    const c = setup({
      signInWithPassword: { ...user, localId: 'another-owner', idToken: 'other-token' },
    })
    await c.load()
    await expect(
      c.settings.updateUserEmail('new@example.test', 'password'),
    ).rejects.toMatchObject({ code: 'auth/user-mismatch' })
    expect(c.calls.some((c) => c.url.includes('accounts:update'))).toBe(false)
  })
  it('sends passwords only to Firebase and renews the Connect session after a change', async () => {
    const c = setup()
    await c.load()
    await c.settings.updateUserPassword('new-password', 'current-password')
    const passwordCalls = c.calls.filter((c) => c.body && 'password' in c.body)
    expect(passwordCalls).toHaveLength(2)
    for (const call of passwordCalls)
      expect(new URL(call.url).origin).toBe('https://identitytoolkit.googleapis.com')
    expect(c.refreshSession).toHaveBeenCalledWith('updated')
  })
  it('deletes only this owner’s private account keys before deleting the identity', async () => {
    const c = setup()
    await c.load()
    await c.settings.deleteAccount('current-password')
    const clean = c.calls.find((c) => c.body && 'users/owner-1' in c.body)!
    expect(Object.keys(clean.body!)).toHaveLength(9)
    expect(Object.keys(clean.body!).every((key) => key.endsWith('/owner-1'))).toBe(true)
    expect(Object.values(clean.body!)).toEqual(Array(9).fill(null))
    expect(c.calls.at(-1)?.url).toContain('accounts:delete')
    await expect(c.settings.updateDisplayName('after deletion')).rejects.toMatchObject({
      code: 'auth/user-mismatch',
    })
  })
  it('discards identity credentials when the account page is closed', async () => {
    const c = setup()
    await c.load()
    const count = c.calls.length
    c.dispose()
    await expect(c.settings.updateDisplayName('other account')).rejects.toMatchObject({
      code: 'auth/user-mismatch',
    })
    expect(c.calls).toHaveLength(count)
  })
})


describe('connected tool management', () => {
  it('reads only the current owner’s tools and excludes Connect itself', async () => {
    const c = setup({ tools: { connect: { signedInAt: 1 }, binder: { signedInAt: 2 }, unknown: {} } })
    expect(await c.loadTools()).toEqual([{ tool: 'binder', link: { signedInAt: 2 } }])
    expect(c.calls.at(-1)?.url).toContain('/production/users:tools/owner-1.json')
  })
  it('uses the existing authenticated endpoint without supplying another owner', async () => {
    const c = setup()
    await c.signOutTool('binder')
    expect(c.calls.at(-1)).toEqual({ url: 'https://us-central1-firebase-scotdance.cloudfunctions.net/unlinkTool', body: { data: { tool: 'binder' } } })
    await expect(c.signOutTool('connect')).rejects.toThrow('Use Sign out')
  })
  it('reports an endpoint failure rather than claiming the tool was disconnected', async () => {
    const c = setup({ unlink: { error: { message: 'UNAVAILABLE' } } })
    await expect(c.signOutTool('binder')).rejects.toThrow('Could not sign out')
  })
})

describe('email verification', () => {
  it('sends only to the authenticated identity and does not claim the email is verified after sending', async () => {
    const c = setup({ lookup: { users: [{ ...user, emailVerified: false }] } })
    await c.settings.sendVerificationEmail!()
    const send = c.calls.find(call => call.url.includes('accounts:sendOobCode'))!
    expect(send.body).toEqual({ requestType: 'VERIFY_EMAIL', idToken: 'initial-token' })
    expect(c.settings.user?.emailVerified).toBe(false)
  })
  it('reads fresh identity state after the email link, despite caching the identity token', async () => {
    const lookup = { users: [{ ...user, emailVerified: false }] }
    const c = setup({ lookup })
    await c.load()
    expect(await c.settings.checkEmailVerification!()).toBe(false)
    lookup.users[0]!.emailVerified = true
    expect(await c.settings.checkEmailVerification!()).toBe(true)
    expect(c.settings.user?.emailVerified).toBe(true)
    await c.settings.sendVerificationEmail!()
    expect(c.calls.some(call => call.url.includes('accounts:sendOobCode'))).toBe(false)
    lookup.users[0]!.emailVerified = false
    expect(await c.settings.checkEmailVerification!()).toBe(false)
  })
  it('refuses to send if the identity belongs to another account', async () => {
    const c = setup({ lookup: { users: [{ ...user, localId: 'someone-else' }] } })
    await expect(c.settings.sendVerificationEmail!()).rejects.toMatchObject({ code: 'auth/user-mismatch' })
    expect(c.calls.some(call => call.url.includes('accounts:sendOobCode'))).toBe(false)
  })
  it('surfaces Firebase throttling without marking the account verified', async () => {
    const c = setup({ sendOobCode: { error: { message: 'TOO_MANY_ATTEMPTS_TRY_LATER' } } })
    await expect(c.settings.sendVerificationEmail!()).rejects.toMatchObject({ code: 'auth/too-many-requests' })
    expect(c.settings.user?.emailVerified).toBe(false)
  })
})
