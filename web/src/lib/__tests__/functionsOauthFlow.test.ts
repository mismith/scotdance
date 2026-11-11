// @vitest-environment node
import assert from 'node:assert/strict'
import { afterAll as after, beforeAll as before, beforeEach, describe, test } from 'vitest'
import { knownHosts } from '../../../../functions/src/oauth/known'
import {
  humansOnly, onApproveConnection, onConnectionRequest, onEndConnection, sweepExpired,
} from '../../../../functions/src/oauth/callables'
import { decide, describeRequest } from '../../../../functions/src/oauth/connect'
import { sha256 } from '../../../../functions/src/oauth/common'
import {
  authorizationServerMetadata, protectedResourceMetadata, verifyAccessToken,
} from '../../../../functions/src/oauth/index'
import { ORIGIN, RESOURCE, form, harness, pkce, type Harness } from './oauthHarness'

const REDIRECT = 'https://claude.example/callback'
type Json = Record<string, unknown>

let h: Harness
let clientId: string

const setup = async () => {
  h = await harness()
  clientId = h.client()
}

/** Ask to authorize; the response is not followed */
const authorize = (params: Record<string, string | undefined>, over: Record<string, string | undefined> = {}) => {
  const query = new URLSearchParams()
  const all = { response_type: 'code', client_id: clientId, redirect_uri: REDIRECT, ...params, ...over }
  for (const [k, v] of Object.entries(all)) if (v !== undefined) query.set(k, v)
  return fetch(`${h.base}/oauth/authorize?${query}`, { redirect: 'manual' })
}

const asked = (extra: Record<string, string | undefined> = {}) => {
  const keys = pkce()
  return { keys, params: { code_challenge: keys.challenge, code_challenge_method: 'S256', state: 'st8', ...extra } }
}

/** Authorize, and return the request id the browser is sent on with */
async function begin(extra: Record<string, string | undefined> = {}) {
  const { keys, params } = asked(extra)
  const res = await authorize(params)
  assert.equal(res.status, 302)
  const location = new URL(res.headers.get('location')!)
  assert.equal(location.origin + location.pathname, `${ORIGIN}/connect`)
  return { keys, request: location.searchParams.get('request')! }
}

const codeIn = (redirect: string) => new URL(redirect).searchParams.get('code')!

/** The whole way to a code */
async function codeFor(uid = 'u1') {
  const { keys, request } = await begin()
  const { redirect } = await decide(uid, { request })
  return { keys, code: codeIn(redirect), redirect }
}

const token = (fields: Record<string, string>) => fetch(`${h.base}/oauth/token`, form(fields))
const exchange = (code: string, verifier: string, over: Record<string, string> = {}) => token({
  grant_type: 'authorization_code', client_id: clientId, code, code_verifier: verifier, redirect_uri: REDIRECT, ...over,
})
const refresh = (refresh_token: string, over: Record<string, string> = {}) => token({
  grant_type: 'refresh_token', client_id: clientId, refresh_token, ...over,
})

interface Tokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  scope: string
}
async function tokens(uid = 'u1') {
  const { keys, code } = await codeFor(uid)
  const res = await exchange(code, keys.verifier)
  assert.equal(res.status, 200)
  return { ...((await res.json()) as Tokens), keys, code }
}
const error = async (res: Response) => ((await res.json()) as Json).error

const ctx = (uid: string | null = 'u1', claims: object = {}) => ({ auth: uid ? { uid, token: claims } : null })
const codeOf = (e: unknown) => (e as { code?: string }).code
const count = (prefix: string) => [...h.store.docs.keys()].filter((p) => p.startsWith(prefix)).length
const connections = () => [...h.store.docs.keys()].filter((p) => p.startsWith('users:connections/'))

describe('metadata', () => {
  before(() => setup())
  after(() => h.close())

  test('protected resource document', async () => {
    for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
      const res = await fetch(`${h.base}${path}`)
      assert.equal(res.status, 200)
      assert.deepEqual(await res.json(), {
        resource: RESOURCE,
        authorization_servers: [ORIGIN],
        scopes_supported: ['manage'],
        bearer_methods_supported: ['header'],
        resource_name: 'ScotDance.app',
      })
    }
    assert.deepEqual(protectedResourceMetadata().authorization_servers, [ORIGIN])
  })

  test('authorization server document: CIMD, PKCE S256, no registration', async () => {
    const res = await fetch(`${h.base}/.well-known/oauth-authorization-server`)
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), {
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/oauth/authorize`,
      token_endpoint: `${ORIGIN}/oauth/token`,
      revocation_endpoint: `${ORIGIN}/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      revocation_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['manage'],
      client_id_metadata_document_supported: true,
    })
    assert.equal('registration_endpoint' in authorizationServerMetadata(), false)
    assert.equal((await fetch(`${h.base}/oauth/register`, { method: 'POST' })).status, 404)
  })
})

describe('authorize', () => {
  before(() => setup())
  after(() => h.close())
  beforeEach(() => h.store.docs.clear())

  const expectPage = async (res: Response) => {
    assert.equal(res.status, 400)
    assert.equal(res.headers.get('location'), null, 'no redirect')
    assert.match(res.headers.get('content-type') ?? '', /text\/html/)
    assert.equal(count('oauth:requests/'), 0)
  }
  const expectBack = (res: Response, err: string) => {
    assert.equal(res.status, 302)
    const back = new URL(res.headers.get('location')!)
    assert.equal(back.origin + back.pathname, REDIRECT)
    assert.equal(back.searchParams.get('error'), err)
    assert.equal(back.searchParams.get('state'), 'st8')
    assert.equal(back.searchParams.get('iss'), ORIGIN)
    assert.equal(count('oauth:requests/'), 0)
  }

  test('happy path files the request and sends the browser to /connect', async () => {
    const { keys, params } = asked({ resource: RESOURCE })
    const res = await authorize(params)
    assert.equal(res.status, 302)
    assert.equal(res.headers.get('cache-control'), 'no-store')
    const id = new URL(res.headers.get('location')!).searchParams.get('request')!
    assert.match(id, /^[A-Za-z0-9_-]{43}$/)
    const doc = h.store.docs.get(`oauth:requests/${id}`)!
    assert.deepEqual(doc.client, { id: clientId, name: 'Claude', uri: 'https://claude.example/' })
    assert.equal(doc.redirectUri, REDIRECT)
    assert.equal(doc.codeChallenge, keys.challenge)
    assert.equal(doc.state, 'st8')
    assert.equal(doc.resource, RESOURCE)
    assert.equal(doc.expiresAt, h.clock.now + 10 * 60_000)
  })

  test('there is one scope: whatever is asked for, it is manage', async () => {
    for (const scope of [undefined, '', 'manage', 'read write', 'read admin']) {
      const { request } = await begin(scope === undefined ? {} : { scope })
      assert.equal(h.store.docs.get(`oauth:requests/${request}`)!.scope, 'manage')
    }
  })

  test('PKCE is required, and only S256', async () => {
    const { params } = asked()
    expectBack(await authorize({ ...params, code_challenge: undefined }), 'invalid_request')
    expectBack(await authorize({ ...params, code_challenge_method: undefined }), 'invalid_request')
    expectBack(await authorize({ ...params, code_challenge_method: 'plain' }), 'invalid_request')
    expectBack(await authorize({ ...params, code_challenge: 'short' }), 'invalid_request')
  })

  test('only response_type=code', async () => {
    expectBack(await authorize(asked().params, { response_type: 'token' }), 'unsupported_response_type')
    expectBack(await authorize(asked().params, { response_type: undefined }), 'unsupported_response_type')
  })

  test('a resource that is not this server is refused', async () => {
    expectBack(await authorize(asked({ resource: 'https://evil.example/mcp' }).params), 'invalid_target')
    expectBack(await authorize(asked({ resource: `${RESOURCE}x` }).params), 'invalid_target')
    expectBack(await authorize(asked({ resource: `${RESOURCE}/other` }).params), 'invalid_target')
    assert.equal((await authorize(asked({ resource: `${RESOURCE}/` }).params)).status, 302, 'a trailing slash makes no difference')
  })

  test('a client the app doesn’t know by address gets a page for every error, never a redirect', async () => {
    knownHosts.delete('127.0.0.1')
    try {
      const { params } = asked()
      await expectPage(await authorize({ ...params, code_challenge: undefined }))
      await expectPage(await authorize({ ...params, code_challenge_method: 'plain' }))
      await expectPage(await authorize(params, { response_type: 'token' }))
      await expectPage(await authorize({ ...params, resource: 'https://evil.example/mcp' }))
      await expectPage(await authorize({ ...params, state: 'x'.repeat(2000) }))
      // A good request from it still goes on to the approval page, where it is shown for what it is
      assert.match((await authorize(params)).headers.get('location')!, /\/connect\?request=/)
    } finally {
      knownHosts.add('127.0.0.1')
    }
  })

  test('an unknown client, or an unregistered redirect, gets a page', async () => {
    await expectPage(await authorize(asked().params, { client_id: 'not-a-url' }))
    await expectPage(await authorize(asked().params, { client_id: `${h.clients}/nothing` }))
    await expectPage(await authorize(asked().params, { client_id: undefined }))
    await expectPage(await authorize(asked().params, { redirect_uri: 'https://evil.example/callback' }))
    await expectPage(await authorize(asked().params, { redirect_uri: 'http://claude.example/callback' }))
    await expectPage(await authorize(asked().params, { redirect_uri: undefined }))
  })

  test('a loopback redirect may use any port, nothing else different', async () => {
    const ok = await authorize(asked().params, { redirect_uri: 'http://127.0.0.1:60000/callback' })
    assert.equal(ok.status, 302)
    h.store.docs.clear()
    await expectPage(await authorize(asked().params, { redirect_uri: 'http://127.0.0.1:60000/other' }))
  })

  test('only GET; the error page escapes what it was given', async () => {
    assert.equal((await fetch(`${h.base}/oauth/authorize`, { method: 'POST' })).status, 405)
    const res = await authorize(asked().params, { client_id: '"><script>alert(1)</script>' })
    assert.doesNotMatch(await res.text(), /<script>/)
  })
})

describe('the person decides', () => {
  before(() => setup())
  after(() => h.close())
  beforeEach(() => h.store.docs.clear())

  test('describeRequest says who is asking and whether the app knows them', async () => {
    const { request } = await begin()
    assert.deepEqual(await describeRequest(request), {
      client: { name: 'Claude', host: '127.0.0.1', uri: 'https://claude.example/' },
      known: true,
    })
    await h.store.set('oauth:requests/stranger', {
      client: { id: 'https://stranger.example/c', name: 'Claude' }, expiresAt: h.clock.now + 60_000,
    })
    const stranger = await describeRequest('stranger')
    assert.equal(stranger.known, false)
    assert.equal(stranger.client.host, 'stranger.example')
  })

  test('a request that ran out, or never was, is not found', async () => {
    const { request } = await begin()
    h.clock.now += 10 * 60_000 + 1
    for (const f of [() => describeRequest(request), () => decide('u1', { request }), () => describeRequest('nothing')]) {
      await assert.rejects(f(), (e) => codeOf(e) === 'not-found')
    }
  })

  test('allowing makes a connection for the account and a one-use code; no options', async () => {
    const { request } = await begin()
    const { redirect } = await decide('u1', { request })
    const back = new URL(redirect)
    assert.equal(back.origin + back.pathname, REDIRECT)
    assert.equal(back.searchParams.get('state'), 'st8')
    assert.equal(back.searchParams.get('iss'), ORIGIN)
    const [path] = connections()
    assert.match(path!, /^users:connections\/u1\/[A-Za-z0-9_-]{22}$/)
    const record = h.store.docs.get(path!)!
    assert.deepEqual(record.client, { id: clientId, name: 'Claude', uri: 'https://claude.example/' })
    assert.equal(record.scope, 'manage')
    assert.equal(record.createdAt, h.clock.now)
    const stored = h.store.docs.get(`oauth:codes/${sha256(codeIn(redirect))}`)!
    assert.equal(stored.uid, 'u1')
    assert.equal(stored.connection, record.id)
    assert.equal(stored.expiresAt, h.clock.now + 60_000)
    assert.equal(count('oauth:requests/'), 0, 'the request is used up')
    await assert.rejects(decide('u1', { request }), (e) => codeOf(e) === 'not-found', 'and good once')
  })

  test('saying no sends access_denied and uses the request up', async () => {
    const { request } = await begin()
    const { redirect } = await decide('u1', { request, deny: true })
    const back = new URL(redirect)
    assert.equal(back.searchParams.get('error'), 'access_denied')
    assert.equal(back.searchParams.get('state'), 'st8')
    assert.equal(connections().length, 0)
    assert.equal(count('oauth:requests/'), 0)
  })

  test('the callables need a person: signed in, and not an assistant', async () => {
    const { request } = await begin()
    await assert.rejects(Promise.resolve().then(() => onConnectionRequest({ request }, ctx(null))), (e) => codeOf(e) === 'unauthenticated')
    for (const f of [onConnectionRequest, onApproveConnection]) {
      assert.throws(() => f({ request }, ctx('u1', { via: 'mcp', scope: 'manage' })), (e) => codeOf(e) === 'permission-denied')
    }
    await assert.rejects(Promise.resolve().then(() => onEndConnection({ connection: 'x'.repeat(22) }, ctx('u1', { via: 'mcp' }))), (e) => codeOf(e) === 'permission-denied')
    assert.throws(() => humansOnly(ctx('u1', { via: 'mcp' })), (e) => codeOf(e) === 'permission-denied')
    assert.doesNotThrow(() => humansOnly(ctx('u1', { admin: true })))
    // Bad arguments
    assert.throws(() => onConnectionRequest({ request: 'a b' }, ctx()), (e) => codeOf(e) === 'invalid-argument')
    assert.throws(() => onApproveConnection({ request, deny: 'yes' }, ctx()), (e) => codeOf(e) === 'invalid-argument')
    const done = (await onApproveConnection({ request }, ctx())) as { redirect: string }
    assert.match(done.redirect, /code=/)
  })
})

describe('tokens', () => {
  before(() => setup())
  after(() => h.close())
  beforeEach(() => {
    h.store.docs.clear()
    h.clock.now = Date.UTC(2026, 10, 10, 12)
  })

  test('a code becomes an access and a refresh token, stored only as hashes', async () => {
    const t = await tokens()
    assert.equal(t.token_type, 'Bearer')
    assert.equal(t.expires_in, 3600)
    assert.equal(t.scope, 'manage')
    for (const [collection, value, ttl] of [['oauth:tokens', t.access_token, 3600_000], ['oauth:refresh', t.refresh_token, 60 * 86_400_000]] as const) {
      const doc = h.store.docs.get(`${collection}/${sha256(value)}`)!
      assert.equal(doc.uid, 'u1')
      assert.equal(doc.scope, 'manage')
      assert.equal(doc.resource, RESOURCE)
      assert.equal(doc.expiresAt, h.clock.now + ttl)
    }
    assert.equal([...h.store.docs.values()].some((d) => JSON.stringify(d).includes(t.access_token)), false, 'the token itself is never stored')
    assert.deepEqual(await verifyAccessToken(t.access_token), {
      connection: [...h.store.docs.values()].find((d) => d.id && d.client)!.id,
      uid: 'u1',
      scope: 'manage',
      client: { id: clientId, name: 'Claude' },
    })
  })

  test('the code is checked against the client, redirect, resource and verifier; any failure burns it', async () => {
    const tries: Array<[string, (verifier: string) => Record<string, string>]> = [
      ['wrong verifier', () => ({ code_verifier: pkce().verifier })],
      ['wrong redirect', () => ({ redirect_uri: 'https://claude.example/other' })],
      ['wrong resource', () => ({ resource: 'https://evil.example/mcp' })],
    ]
    for (const [label, over] of tries) {
      const { keys, code } = await codeFor()
      const res = await exchange(code, keys.verifier, over(keys.verifier))
      assert.equal(res.status, 400, label)
      assert.equal(await error(res), 'invalid_grant', label)
      assert.equal((await exchange(code, keys.verifier)).status, 400, `${label}: the code is spent`)
    }
  })

  test('a code used twice ends the connection and everything made from it', async () => {
    const t = await tokens()
    assert.equal((await exchange(t.code, t.keys.verifier)).status, 400)
    assert.equal(connections().length, 0)
    assert.equal(await verifyAccessToken(t.access_token), null)
    assert.equal((await refresh(t.refresh_token)).status, 400)
  })

  test('an expired code is refused', async () => {
    const { keys, code } = await codeFor()
    h.clock.now += 61_000
    assert.equal((await exchange(code, keys.verifier)).status, 400)
  })

  test('refresh swaps a pair for a new one, once', async () => {
    const t = await tokens()
    h.clock.now += 10_000
    const res = await refresh(t.refresh_token)
    assert.equal(res.status, 200)
    const next = (await res.json()) as Tokens
    assert.notEqual(next.refresh_token, t.refresh_token)
    assert.ok(await verifyAccessToken(next.access_token))
    // The same one again straight away: a retry after a dropped response. Refused, but the new pair stands.
    assert.equal((await refresh(t.refresh_token)).status, 400)
    assert.ok(await verifyAccessToken(next.access_token))
    // Later: it was copied. The whole connection ends.
    h.clock.now += 60_000
    assert.equal((await refresh(t.refresh_token)).status, 400)
    assert.equal(await verifyAccessToken(next.access_token), null)
    assert.equal((await refresh(next.refresh_token)).status, 400)
    assert.equal(connections().length, 0)
  })

  test('refresh must come from the same client, in time, for the same resource, without widening scope', async () => {
    const t = await tokens()
    const other = h.client('/other')
    assert.equal((await refresh(t.refresh_token, { client_id: other })).status, 400)
    assert.equal(await error(await refresh(t.refresh_token, { scope: 'admin' })), 'invalid_scope')
    assert.equal(await error(await refresh(t.refresh_token, { resource: 'https://evil.example/mcp' })), 'invalid_target')
    // None of those used it up
    assert.equal((await refresh(t.refresh_token, { scope: 'manage', resource: RESOURCE })).status, 200)
    const late = await tokens()
    h.clock.now += 61 * 86_400_000
    assert.equal((await refresh(late.refresh_token)).status, 400)
  })

  test('access tokens run out after an hour, and made-up ones are nothing', async () => {
    const t = await tokens()
    h.clock.now += 3600_000
    assert.equal(await verifyAccessToken(t.access_token), null)
    for (const bad of ['', 'x', 'a'.repeat(43)]) assert.equal(await verifyAccessToken(bad), null)
  })

  test('the emulator’s dev token works there and nowhere else', async () => {
    assert.equal((await verifyAccessToken('dev:u7'))?.uid, 'u7')
    process.env.FUNCTIONS_EMULATOR = 'false'
    try {
      assert.equal(await verifyAccessToken('dev:u7'), null)
    } finally {
      process.env.FUNCTIONS_EMULATOR = 'true'
    }
  })

  test('revoking a token from its client ends the connection; from another client, nothing', async () => {
    const t = await tokens()
    const other = h.client('/other')
    await fetch(`${h.base}/oauth/revoke`, form({ token: t.refresh_token, client_id: other }))
    assert.ok(await verifyAccessToken(t.access_token))
    assert.equal((await fetch(`${h.base}/oauth/revoke`, form({ token: t.access_token, client_id: clientId }))).status, 200)
    assert.equal(await verifyAccessToken(t.access_token), null)
    assert.equal(connections().length, 0)
    assert.equal(count('oauth:'), 0)
  })

  test('disconnecting ends one connection and its tokens, and only the caller’s', async () => {
    const mine = await tokens('u1')
    const theirs = await tokens('u2')
    const [mineId] = connections().filter((p) => p.startsWith('users:connections/u1/')).map((p) => p.split('/')[2])
    // Someone else naming my connection ends nothing of mine
    await onEndConnection({ connection: mineId }, ctx('u2'))
    assert.ok(await verifyAccessToken(mine.access_token))
    await onEndConnection({ connection: mineId }, ctx('u1'))
    assert.equal(await verifyAccessToken(mine.access_token), null)
    assert.equal((await refresh(mine.refresh_token)).status, 400)
    assert.ok(await verifyAccessToken(theirs.access_token))
    await onEndConnection({ connection: mineId }, ctx('u1')) // twice is fine
  })

  test('naming none ends all of the account’s connections (deleting an account)', async () => {
    const a = await tokens('u1')
    const b = await tokens('u1')
    const c = await tokens('u2')
    await onEndConnection({}, ctx('u1'))
    assert.equal(await verifyAccessToken(a.access_token), null)
    assert.equal(await verifyAccessToken(b.access_token), null)
    assert.ok(await verifyAccessToken(c.access_token))
  })

  test('a connection ended while tokens were being made leaves none behind', async () => {
    const { keys, code } = await codeFor()
    for (const path of connections()) await h.store.delete(path)
    assert.equal((await exchange(code, keys.verifier)).status, 400)
    assert.equal(count('oauth:tokens/') + count('oauth:refresh/'), 0)
  })

  test('the daily sweep removes what has expired and nothing else', async () => {
    const t = await tokens()
    await begin()
    h.clock.now += 3600_000 + 1
    assert.equal(await sweepExpired(), 3, 'the access token, the code and the request')
    assert.equal(count('oauth:tokens/'), 0)
    assert.equal(count('oauth:refresh/'), 1)
    assert.equal(connections().length, 1)
    h.clock.now += 61 * 86_400_000
    assert.equal(await sweepExpired(), 1)
    assert.ok(t)
  })
})
