// @vitest-environment node
import assert from 'node:assert/strict'
import { afterAll as after, beforeAll as before, beforeEach, test } from 'vitest'
import { cleanName, clientFromDocument, clientIdUrl, forgetClients, getClient, guardedLookup } from '../../../../functions/src/oauth/cimd'
import { emulated } from '../../../../functions/src/mcp/config'
import { harness, type Harness } from './oauthHarness'
import { runtime } from '../../../../functions/src/oauth/runtime'

let h: Harness
before(async () => {
  h = await harness()
})
after(() => h.close())
beforeEach(() => {
  forgetClients()
  runtime.lookup = (() => assert.fail('no DNS expected')) as never
})

const doc = (id: string, extra: object = {}) => ({
  client_id: id,
  client_name: 'Claude',
  redirect_uris: ['https://claude.example/callback'],
  ...extra,
})

test('a good document becomes a public client', async () => {
  const id = h.client('/good')
  const client = await getClient(id)
  assert.equal(client?.client_id, id)
  assert.equal(client?.client_name, 'Claude')
  assert.equal(client?.token_endpoint_auth_method, 'none')
  assert.equal(client?.client_secret, undefined)
  assert.deepEqual(client?.redirect_uris, ['https://claude.example/callback', 'http://127.0.0.1:33418/callback'])
})

test('a secret in the document is ignored', async () => {
  const id = `${h.clients}/secret`
  h.serve('/secret', { body: JSON.stringify(doc(id, { client_secret: 'shh', token_endpoint_auth_method: 'client_secret_basic' })) })
  const client = await getClient(id)
  assert.equal(client?.client_secret, undefined)
  assert.equal(client?.token_endpoint_auth_method, 'none')
})

test('refuses a document whose client_id is not its address', async () => {
  const id = `${h.clients}/mismatch`
  h.serve('/mismatch', { body: JSON.stringify(doc(`${id}/`)) })
  assert.equal(await getClient(id), undefined)
})

test('refuses missing, empty or wrong redirect_uris', () => {
  const id = 'https://a.example/c'
  assert.equal(clientFromDocument(id, { client_id: id, client_name: 'A' }), null)
  assert.equal(clientFromDocument(id, doc(id, { redirect_uris: [] })), null)
  assert.equal(clientFromDocument(id, doc(id, { redirect_uris: 'https://a.example/cb' })), null)
  assert.equal(clientFromDocument(id, doc(id, { redirect_uris: ['http://a.example/cb'] })), null, 'http, not loopback')
  assert.equal(clientFromDocument(id, doc(id, { redirect_uris: ['com.example.app:/cb'] })), null, 'custom scheme')
  assert.equal(clientFromDocument(id, doc(id, { redirect_uris: ['javascript:alert(1)'] })), null)
  assert.equal(clientFromDocument(id, doc(id, { redirect_uris: ['https://a.example/cb', 'nonsense'] })), null)
  assert.equal(clientFromDocument(id, doc(id, { redirect_uris: ['https://u:p@a.example/cb'] })), null, 'credentials')
  assert.equal(clientFromDocument(id, doc(id, { redirect_uris: ['https://a.example/cb#x'] })), null, 'fragment')
  assert.ok(clientFromDocument(id, doc(id, { redirect_uris: ['http://localhost:1/cb', 'http://[::1]:2/cb'] })))
})

test('names are required, cleaned and capped', () => {
  const id = 'https://a.example/c'
  assert.equal(clientFromDocument(id, doc(id, { client_name: '' })), null)
  assert.equal(clientFromDocument(id, doc(id, { client_name: ' \n\u0007 ' })), null)
  assert.equal(clientFromDocument(id, doc(id, { client_name: 42 })), null)
  assert.equal(cleanName('Cl\u0000au‮de\nX'), 'Cl au de X')
  assert.equal(cleanName('x'.repeat(200)).length, 80)
})

test('names lose zero-width and bidi characters, and runs of space', () => {
  // Each becomes a space, so a name can't hide a character that makes it read as another
  assert.equal(cleanName('Cl\u200Baude'), 'Cl aude')
  for (const hidden of ['\u200b', '\u200c', '\u200d', '\u200e', '\u200f', '\u202a', '\u202e', '\u2060', '\u2062', '\u2064', '\u2066', '\u2069', '\ufeff'])
    assert.equal(cleanName(`A${hidden}B`), 'A B', `U+${hidden.charCodeAt(0).toString(16)}`)
  assert.equal(cleanName('\ufeff\u200b Claude \u200f'), 'Claude')
  assert.equal(cleanName('Claude \u2003\u00a0   Code'), 'Claude Code')
  assert.equal(clientFromDocument('https://a.example/c', doc('https://a.example/c', { client_name: '\u200b\u200f\ufeff' })), null)
})

test('client_uri and logo_uri must be https, or they are dropped', () => {
  const id = 'https://a.example/c'
  const ok = clientFromDocument(id, doc(id, { client_uri: 'https://a.example/', logo_uri: 'https://a.example/l.png' }))
  assert.equal(ok?.client_uri, 'https://a.example/')
  assert.equal(ok?.logo_uri, 'https://a.example/l.png')
  const bad = clientFromDocument(id, doc(id, { client_uri: 'javascript:alert(1)', logo_uri: 'http://a.example/l.png' }))
  assert.equal(bad?.client_uri, undefined)
  assert.equal(bad?.logo_uri, undefined)
})

test('emulated() needs the auth emulator as well as the emulator flag', async () => {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST
  try {
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST
    assert.equal(emulated(), false)
    assert.equal(clientIdUrl('http://localhost:9/c'), null, 'loopback client documents are refused too')
    assert.equal(await getClient(`${h.clients}/loopback`), undefined)
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9'
    assert.equal(emulated(), true)
  } finally {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = host
  }
})

test('client_ids that are not fetchable addresses', () => {
  for (const id of [
    '', 'claude', 'ftp://a.example/c', 'https://a.example', 'https://a.example/', 'https://u:p@a.example/c',
    'https://a.example/c#frag', 'http://a.example/c', 'http://localhost:9/c' /* only while emulated */,
  ]) {
    if (id.startsWith('http://localhost')) {
      assert.ok(clientIdUrl(id), 'emulated: loopback is fine')
      process.env.FUNCTIONS_EMULATOR = 'false'
      assert.equal(clientIdUrl(id), null)
      process.env.FUNCTIONS_EMULATOR = 'true'
    } else assert.equal(clientIdUrl(id), null, id)
  }
  assert.ok(clientIdUrl('https://claude.example/oauth/client.json'))
})

test('refuses redirects, errors, big bodies, non-JSON and slow servers', async () => {
  h.serve('/moved', { status: 302, headers: { Location: `${h.clients}/good` } })
  h.client('/good')
  h.serve('/err', { status: 500, body: '{}' })
  h.serve('/big', { body: JSON.stringify({ pad: 'x'.repeat(40_000) }) })
  h.serve('/text', { body: 'hello' })
  h.serve('/array', { body: '[]' })
  h.serve('/slow', { hang: true })
  for (const path of ['/moved', '/err', '/big', '/text', '/array', '/slow', '/missing'])
    assert.equal(await getClient(`${h.clients}${path}`), undefined, path)
})

test('private IP literals are refused without a lookup', async () => {
  process.env.FUNCTIONS_EMULATOR = 'false'
  try {
    for (const host of ['10.0.0.1', '169.254.169.254', '192.168.1.1', '100.64.0.1', '[::1]', '[fd00::1]', '[::ffff:10.0.0.1]', '127.0.0.1:9999'])
      assert.equal(await getClient(`https://${host}/client`), undefined, host)
  } finally {
    process.env.FUNCTIONS_EMULATOR = 'true'
  }
})

test('the connection only goes to checked addresses', async () => {
  const ask = (answers: Array<{ address: string; family: number }>, all = true) => {
    runtime.lookup = ((_h: string, _o: unknown, cb: (e: null, a: unknown) => void) => cb(null, answers)) as never
    return new Promise<{ error: Error | null; result: unknown }>((done) =>
      guardedLookup('client.example', { all }, (error, result) => done({ error, result })),
    )
  }
  assert.ok((await ask([{ address: '10.0.0.1', family: 4 }])).error)
  assert.ok((await ask([{ address: '93.184.216.34', family: 4 }, { address: '169.254.169.254', family: 4 }])).error, 'any bad answer')
  assert.ok((await ask([{ address: '::ffff:10.0.0.1', family: 6 }])).error)
  assert.ok((await ask([])).error)
  const good = await ask([{ address: '93.184.216.34', family: 4 }, { address: '2606:4700::1111', family: 6 }])
  assert.equal(good.error, null)
  assert.equal((good.result as unknown[]).length, 2)
  const single = await ask([{ address: '93.184.216.34', family: 4 }], false)
  assert.equal(single.result, '93.184.216.34')
  // A name that resolves privately never gets a connection
  runtime.lookup = ((_h: string, _o: unknown, cb: (e: null, a: unknown) => void) => cb(null, [{ address: '10.0.0.5', family: 4 }])) as never
  process.env.FUNCTIONS_EMULATOR = 'false'
  try {
    assert.equal(await getClient('https://rebind.example/client'), undefined)
    assert.equal(await getClient('https://metadata.google.internal/computeMetadata/v1/'), undefined)
  } finally {
    process.env.FUNCTIONS_EMULATOR = 'true'
  }
})

test('good documents are cached for ten minutes, failures for thirty seconds', async () => {
  const id = h.client('/cached')
  assert.ok(await getClient(id))
  h.serve('/cached', { status: 500 })
  assert.ok(await getClient(id), 'served from cache')
  h.clock.now += 10 * 60_000 + 1
  assert.equal(await getClient(id), undefined, 'refetched after ten minutes')
  h.client('/cached')
  assert.equal(await getClient(id), undefined, 'failure remembered')
  h.clock.now += 30_001
  assert.ok(await getClient(id), 'tried again after thirty seconds')
})

test('the cache holds at most 200 clients', async () => {
  const first = h.client('/c0')
  assert.ok(await getClient(first))
  for (let i = 1; i <= 200; i++) await getClient(`${h.clients}/nothing${i}`)
  h.serve('/c0', { status: 500 })
  assert.equal(await getClient(first), undefined, 'the oldest was dropped, so it was fetched again')
})
