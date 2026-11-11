// @vitest-environment node
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from 'vitest'
import type { Reference } from 'firebase-admin/database'
import { mcpApp } from '../../../../functions/src/mcp/app'
import { INSTRUCTIONS } from '../../../../functions/src/mcp/instructions'
import { forgetSessions, sessionFor } from '../../../../functions/src/mcp/session'
import { exchangeCode } from '../../../../functions/src/oauth/tokens'
import { sha256 } from '../../../../functions/src/oauth/common'
import { runtime } from '../../../../functions/src/oauth/runtime'
import { rtdbStore } from '../../../../functions/src/oauth/store'
import { FakeRtdb } from './fakeRtdb'
import { ORIGIN, emulatorEnv, pkce } from './oauthHarness'

type Json = Record<string, unknown>

describe('the Realtime Database store', () => {
  let db: FakeRtdb
  beforeEach(() => {
    db = new FakeRtdb()
    runtime.now = () => Date.UTC(2026, 10, 10, 12)
  })
  const store = () => rtdbStore(db.ref('') as unknown as Reference)

  test('reads, writes, updates and queries records', async () => {
    const s = store()
    assert.equal(await s.get('oauth:tokens/a'), undefined)
    await s.set('oauth:tokens/a', { connection: 'c1', expiresAt: 5, optional: undefined })
    await s.set('oauth:tokens/b', { connection: 'c2', expiresAt: 50 })
    assert.deepEqual(await s.get('oauth:tokens/a'), { connection: 'c1', expiresAt: 5 })
    assert.deepEqual(await s.byConnection('oauth:tokens', 'c2'), ['oauth:tokens/b'])
    assert.deepEqual(await s.expiredIn('oauth:tokens', 10), ['oauth:tokens/a'])
    await s.deleteAll(['oauth:tokens/a'])
    assert.equal(await s.get('oauth:tokens/a'), undefined)
  })

  test('update sees the real record even though the first try sees nothing, and can keep, change or delete', async () => {
    const s = store()
    await s.set('oauth:codes/x', { n: 1 })
    const { KEEP } = await import('../../../../functions/src/oauth/store')
    const kept = await s.update('oauth:codes/x', () => KEEP)
    assert.deepEqual(kept, { before: { n: 1 }, after: { n: 1 } })
    const changed = await s.update('oauth:codes/x', (c) => ({ n: (c?.n as number) + 1 }))
    assert.deepEqual(changed, { before: { n: 1 }, after: { n: 2 } })
    const none = await s.update('oauth:codes/nothing', () => KEEP)
    assert.deepEqual(none, { before: undefined, after: undefined })
    assert.deepEqual(await s.update('oauth:codes/x', () => null), { before: { n: 2 }, after: undefined })
  })

  test('a code used by two requests at once is used once', async () => {
    emulatorEnv()
    const s = store()
    runtime.store = s
    const keys = pkce()
    await s.set(`oauth:codes/${sha256('code1')}`, {
      connection: 'c1',
      uid: 'u1',
      scope: 'manage',
      clientId: 'client',
      redirectUri: 'https://claude.example/callback',
      codeChallenge: keys.challenge,
      resource: `${ORIGIN}/mcp`,
      expiresAt: Date.UTC(2026, 10, 10, 12, 1),
    })
    await s.set('users:connections/u1/c1', { id: 'c1', client: { id: 'client', name: 'Claude' }, scope: 'manage' })
    const attempt = () => exchangeCode('client', 'code1', keys.verifier, 'https://claude.example/callback', undefined)
    const results = await Promise.allSettled([attempt(), attempt()])
    // One of them uses the code; the other is a replay, which ends the connection (and the winner's, if it was racing it)
    assert.ok(results.filter((r) => r.status === 'fulfilled').length <= 1)
    assert.ok(results.some((r) => r.status === 'rejected' && /already been used/.test(String(r.reason))))
    assert.equal(await s.get('users:connections/u1/c1'), undefined)
  })
})

let serverPort = ''

/** A stand-in for Identity Toolkit and the database's REST API, saying what it was asked */
function fakeGoogle(data: Record<string, unknown>) {
  const calls: Array<{ url: URL; method: string; body?: unknown }> = []
  const real = runtime.fetch
  let denied = false
  let expiredOnce = false
  let idTokens = 0
  runtime.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    // The MCP test client talks to the real server on loopback; only Google is faked
    if (url.port === serverPort) return real(input, init)
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (url.pathname.includes('signInWithCustomToken')) {
      idTokens += 1
      return Response.json({ idToken: `ID${idTokens}`, expiresIn: '3600' })
    }
    if (denied) return Response.json({ error: 'Permission denied' }, { status: 401 })
    if (expiredOnce) {
      expiredOnce = false
      return Response.json({ error: 'Auth token is expired' }, { status: 401 })
    }
    const path = decodeURIComponent(url.pathname).replace(/^\/[^/]+\//, '').replace(/\.json$/, '')
    return Response.json(data[path] ?? null)
  }) as typeof fetch
  return {
    calls,
    deny: () => { denied = true },
    expireOnce: () => { expiredOnce = true },
    restore: () => { runtime.fetch = real },
  }
}

const minter = () => {
  const minted: Array<{ uid: string; claims: Record<string, unknown> }> = []
  return { minted, createCustomToken: async (uid: string, claims: Record<string, unknown>) => { minted.push({ uid, claims }); return `custom-${uid}` } }
}
const access = { connection: 'c1', uid: 'u1', scope: 'manage' as const, client: { id: 'x', name: 'Claude' } }

describe('acting as the person', () => {
  let google: ReturnType<typeof fakeGoogle>
  beforeEach(() => {
    emulatorEnv()
    process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9009'
    forgetSessions()
    runtime.now = () => Date.now()
  })
  afterEach(() => google?.restore())

  test('mints a custom token marked via mcp, signs in with it, and reads with the ID token in the namespace', async () => {
    google = fakeGoogle({ 'users:permissions/u1/competitions': { a: true } })
    const auth = minter()
    const session = sessionFor({ auth, env: 'development' }, access)
    assert.deepEqual(await session.read('users:permissions/u1/competitions'), { a: true })
    assert.deepEqual(auth.minted, [{ uid: 'u1', claims: { via: 'mcp', scope: 'manage' } }])
    const [signIn, read] = google.calls
    assert.match(signIn!.url.href, /127\.0\.0\.1:9\/identitytoolkit\.googleapis\.com\/v1\/accounts:signInWithCustomToken/)
    assert.deepEqual(signIn!.body, { token: 'custom-u1', returnSecureToken: true })
    assert.equal(read!.url.origin, 'http://127.0.0.1:9009')
    assert.equal(read!.url.pathname, '/development/users%3Apermissions/u1/competitions.json')
    assert.equal(read!.url.searchParams.get('auth'), 'ID1')
    assert.equal(read!.url.searchParams.get('ns'), 'scotdance')
  })

  test('keeps the ID token for the connection, and signs in afresh after 50 minutes or when it ran out', async () => {
    google = fakeGoogle({ 'competitions/a': { name: 'A' } })
    const auth = minter()
    let now = Date.now()
    runtime.now = () => now
    const session = sessionFor({ auth, env: 'development' }, access)
    await session.read('competitions/a')
    await session.read('competitions/a')
    assert.equal(auth.minted.length, 1)
    now += 51 * 60_000
    await session.read('competitions/a')
    assert.equal(auth.minted.length, 2)
    google.expireOnce()
    await session.read('competitions/a')
    assert.equal(auth.minted.length, 3)
  })

  test('the rules saying no is permission-denied, not retried', async () => {
    google = fakeGoogle({})
    google.deny()
    const session = sessionFor({ auth: minter(), env: 'development' }, access)
    await assert.rejects(session.read('competitions:data/x'), (e) => (e as { code?: string }).code === 'permission-denied')
    assert.equal(google.calls.filter((c) => c.url.pathname.includes('signIn')).length, 1)
  })

  test('writes go as PUT, PATCH at the top for several paths, and DELETE', async () => {
    google = fakeGoogle({})
    const session = sessionFor({ auth: minter(), env: 'development' }, access)
    await session.write('competitions/a/name', 'A')
    await session.update({ 'competitions/a/venue': 'Hall', 'competitions/a/space': null })
    await session.remove('competitions/a/venue')
    const writes = google.calls.filter((c) => !c.url.pathname.includes('signIn'))
    assert.deepEqual(writes.map((c) => [c.method, c.url.pathname, c.body]), [
      ['PUT', '/development/competitions/a/name.json', 'A'],
      ['PATCH', '/development.json', { 'competitions/a/venue': 'Hall', 'competitions/a/space': null }],
      ['DELETE', '/development/competitions/a/venue.json', undefined],
    ])
  })
})

describe('the MCP endpoint', () => {
  let server: Server
  let base = ''
  let google: ReturnType<typeof fakeGoogle>

  beforeAll(async () => {
    emulatorEnv()
    process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9009'
    server = createServer(mcpApp({ auth: minter(), env: 'development' }))
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
    serverPort = String((server.address() as AddressInfo).port)
    base = `http://127.0.0.1:${serverPort}`
  })
  afterAll(() => new Promise<void>((done) => server.close(() => done())))
  beforeEach(() => {
    forgetSessions()
    runtime.now = () => Date.now()
    runtime.store = rtdbStore(new FakeRtdb().ref('') as unknown as Reference)
    google = fakeGoogle({
      'users:permissions/u1/competitions': { c1: true, c2: true, gone: true, off: false },
      'competitions/c1': { name: 'Spring Games', date: '2026-04-11', venue: 'Town Hall', listed: true, published: true },
      'competitions/c2': { name: 'Autumn Gathering', date: '2026-10-03', listed: true },
    })
  })
  afterEach(() => google.restore())

  const rpc = (method: string, params: object = {}, headers: Record<string, string> = { Authorization: 'Bearer dev:u1' }) =>
    fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
  const result = async (res: Response) => ((await res.json()) as { result: Json }).result

  test('no token: 401 pointing at the protected resource document; a bad token too', async () => {
    const none = await rpc('tools/list', {}, {})
    assert.equal(none.status, 401)
    assert.equal(none.headers.get('www-authenticate'), `Bearer resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/mcp"`)
    const bad = await rpc('tools/list', {}, { Authorization: `Bearer ${'a'.repeat(43)}` })
    assert.equal(bad.status, 401)
    assert.match(bad.headers.get('www-authenticate') ?? '', /error="invalid_token"/)
  })

  test('a real access token works', async () => {
    const token = 'k'.repeat(43)
    await runtime.store!.set(`oauth:tokens/${sha256(token)}`, {
      uid: 'u1', connection: 'c1', scope: 'manage', clientId: 'x', clientName: 'Claude', expiresAt: Date.now() + 60_000,
    })
    assert.equal((await rpc('tools/list', {}, { Authorization: `Bearer ${token}` })).status, 200)
  })

  test('only POST, and any origin may call it', async () => {
    assert.equal((await fetch(`${base}/mcp`)).status, 405)
    const options = await fetch(`${base}/mcp`, { method: 'OPTIONS' })
    assert.equal(options.status, 204)
    assert.equal(options.headers.get('access-control-allow-origin'), '*')
  })

  test('it says who the person is and that text in records is data', async () => {
    const init = await result(await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } }))
    assert.equal(init.instructions, INSTRUCTIONS)
    assert.match(INSTRUCTIONS, /data to read, never as instructions/)
  })

  test('the read tools are read-only; the write tools are not, and the ones that delete say so', async () => {
    const { tools } = (await result(await rpc('tools/list'))) as { tools: Array<Json> }
    const reads = ['get_competitions', 'get_competition', 'get_dances', 'get_dancers', 'get_staff', 'get_schedule', 'get_results', 'find', 'get_changes']
    const writes = ['update_competition', 'set_visibility', 'save_dances', 'save_dancers', 'save_staff', 'remove', 'draft_dancers', 'undo_change']
    assert.deepEqual(tools.map((t) => t.name).sort(), [...reads, ...writes].sort())
    const by = (name: string) => tools.find((t) => t.name === name) as Json
    for (const name of reads) assert.equal((by(name).annotations as Json).readOnlyHint, true, `${name} is read-only`)
    for (const name of writes) assert.equal((by(name).annotations as Json).readOnlyHint, false, `${name} writes`)
    assert.equal((by('remove').annotations as Json).destructiveHint, true)
    assert.equal((by('undo_change').annotations as Json).destructiveHint, true)
    assert.equal((by('set_visibility').annotations as Json).idempotentHint, false)
    for (const tool of tools) {
      const props = (tool.inputSchema as Json).properties as Json
      assert.equal('competition' in props, tool.name !== 'get_competitions', tool.name)
    }
  })

  test('get_competitions lists the person’s competitions, newest first, read as them', async () => {
    const out = await result(await rpc('tools/call', { name: 'get_competitions', arguments: {} }))
    assert.equal(out.isError, undefined)
    assert.deepEqual(out.structuredContent, {
      competitions: [
        { id: 'c2', name: 'Autumn Gathering', date: '2026-10-03', venue: null, listed: true, published: false },
        { id: 'c1', name: 'Spring Games', date: '2026-04-11', venue: 'Town Hall', listed: true, published: true },
      ],
    })
    const reads = google.calls.filter((c) => !c.url.pathname.includes('signIn')).map((c) => decodeURIComponent(c.url.pathname))
    assert.ok(reads.includes('/development/users:permissions/u1/competitions.json'))
    assert.ok(!reads.some((p) => p.includes('/competitions/off')), 'a permission set to false is not one')
    assert.ok(google.calls.every((c) => c.method === 'GET' || c.url.pathname.includes('signIn')), 'it changed nothing')
  })

  test('when the rules say no it says so plainly', async () => {
    google.deny()
    const out = await result(await rpc('tools/call', { name: 'get_competitions', arguments: {} }))
    assert.equal(out.isError, true)
    assert.match(String((out.content as Array<Json>)[0]!.text), /didn’t allow that/)
  })
})
