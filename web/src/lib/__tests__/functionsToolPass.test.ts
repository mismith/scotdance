import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { PASS_SECONDS, getOnToolPass, getOnUnlinkTool, signPass } from '../../../../functions/src/toolPass'

const SECRET = 'test-secret'
const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString())

describe('signPass', () => {
  it('says who you are, for one tool, briefly, signed', () => {
    const now = Date.UTC(2026, 9, 29, 12)
    const pass = signPass(SECRET, { uid: 'u1', email: 'a@b.c', name: 'Ann', audience: 'challenge' }, now)
    const [header, payload, signature] = pass.split('.')
    expect(decode(header!)).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(decode(payload!)).toMatchObject({
      iss: 'https://scotdance.app',
      aud: 'challenge',
      sub: 'u1',
      email: 'a@b.c',
      name: 'Ann',
      iat: now / 1000,
      exp: now / 1000 + PASS_SECONDS,
    })
    expect(signature).toBe(createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url'))
  })
})

describe('toolPass', () => {
  // A stand-in database holding u1's record name, if any
  const db = (displayName?: unknown) => ({
    child: (path: string) => ({
      get: async () => ({ val: () => (path === 'users/u1/displayName' ? (displayName ?? null) : null) }),
      update: async () => {},
      remove: async () => {},
    }),
  })
  const call = getOnToolPass(() => SECRET, db())
  const auth = (provider = 'password', name?: string) => ({
    uid: 'u1',
    token: { email: 'a@b.c', name, firebase: { sign_in_provider: provider } },
  })
  const nameIn = async (on: ReturnType<typeof getOnToolPass>, who = auth()) =>
    decode((await on({ audience: 'challenge' }, { auth: who })).pass.split('.')[1]!).name

  it('passes for a known tool, to someone signed in', async () => {
    const { pass } = await call({ audience: 'challenge' }, { auth: auth() })
    expect(decode(pass.split('.')[1]!)).toMatchObject({ sub: 'u1', aud: 'challenge', email: 'a@b.c', name: null })
  })

  it('names you as the app does: your record, then your sign-in, else no name', async () => {
    expect(await nameIn(getOnToolPass(() => SECRET, db('Ann Ross')), auth('password', 'Old'))).toBe('Ann Ross')
    expect(await nameIn(getOnToolPass(() => SECRET, db('  ')), auth('password', 'Ann'))).toBe('Ann')
    expect(await nameIn(getOnToolPass(() => SECRET, db()))).toBeNull()
  })

  it('turns away the signed out, the anonymous and unknown tools', async () => {
    await expect(call({ audience: 'challenge' }, { auth: null })).rejects.toThrow(/Sign in/)
    await expect(call({ audience: 'challenge' }, { auth: auth('anonymous') })).rejects.toThrow(/Sign in/)
    await expect(call({ audience: 'splits' }, { auth: auth() })).rejects.toThrow(/Unknown tool/)
  })
})

// A stand-in database: a flat map of paths to values, read and written by path
function memoryDb(data: Record<string, unknown>) {
  const read = (path: string) => {
    if (path in data) return data[path]
    const kids = Object.entries(data).filter(([k]) => k.startsWith(`${path}/`))
    if (!kids.length) return null
    const out: Record<string, unknown> = {}
    for (const [k, v] of kids) out[k.slice(path.length + 1).split('/')[0]!] = v
    return out
  }
  return {
    data,
    child: (path: string) => ({
      get: async () => ({ val: () => read(path) }),
      update: async (values: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(values)) data[`${path}/${k}`] = v
      },
      remove: async () => {
        for (const k of Object.keys(data)) if (k === path || k.startsWith(`${path}/`)) delete data[k]
      },
    }),
  }
}

describe('toolPass notes the link', () => {
  const auth = { uid: 'u1', token: { email: 'a@b.c', firebase: { sign_in_provider: 'password' } } }

  it('keeps when they first signed in, and updates the last', async () => {
    const db = memoryDb({ 'users:tools/u1/binder/linkedAt': 100, 'users:tools/u1/binder/signedInAt': 100 })
    await getOnToolPass(() => SECRET, db)({ audience: 'binder' }, { auth })
    await getOnToolPass(() => SECRET, db)({ audience: 'challenge' }, { auth })
    expect(db.data['users:tools/u1/binder/linkedAt']).toBe(100)
    expect(db.data['users:tools/u1/binder/signedInAt']).toBeGreaterThan(100)
    expect(db.data['users:tools/u1/challenge/linkedAt']).toBe(db.data['users:tools/u1/challenge/signedInAt'])
  })
})

describe('unlinkTool', () => {
  const auth = (uid = 'u1') => ({ uid, token: { firebase: { sign_in_provider: 'password' } } })
  const linked = () =>
    memoryDb({ 'users:tools/u1/binder/linkedAt': 1, 'users:tools/u1/challenge/linkedAt': 2, 'users:permissions/boss/admin': true })
  const urls = (tool: string) => `https://${tool}.test/unlinkScotDance`

  it('sends the tool an unlink pass, then forgets the link', async () => {
    const db = linked()
    const sent: { url: string; body: { data: { pass: string } } }[] = []
    const send = async (url: string, body: unknown) => (sent.push({ url, body: body as never }), { ok: true, status: 200 })
    expect(await getOnUnlinkTool(() => SECRET, db, urls, send)({ tool: 'binder' }, { auth: auth() })).toEqual({ unlinked: ['binder'] })
    expect(sent).toHaveLength(1)
    expect(sent[0]!.url).toBe('https://binder.test/unlinkScotDance')
    expect(decode(sent[0]!.body.data.pass.split('.')[1]!)).toMatchObject({ aud: 'binder:unlink', sub: 'u1' })
    expect(db.data['users:tools/u1/binder/linkedAt']).toBeUndefined()
    expect(db.data['users:tools/u1/challenge/linkedAt']).toBe(2)
  })

  it('takes a null account or tool as none (callables send undefined as null)', async () => {
    const db = linked()
    const send = async () => ({ ok: true, status: 200 })
    expect(await getOnUnlinkTool(() => SECRET, db, urls, send)({ tool: 'binder', uid: null }, { auth: auth() })).toEqual({ unlinked: ['binder'] })
    expect(await getOnUnlinkTool(() => SECRET, db, urls, send)({ tool: null }, { auth: auth() })).toEqual({ unlinked: ['challenge'] })
  })

  it('unlinks every tool when none is named', async () => {
    const db = linked()
    const send = async () => ({ ok: true, status: 200 })
    expect(await getOnUnlinkTool(() => SECRET, db, urls, send)({}, { auth: auth() })).toEqual({ unlinked: ['binder', 'challenge'] })
    expect(Object.keys(db.data).filter((k) => k.startsWith('users:tools/'))).toEqual([])
  })

  it('keeps the link when the tool doesn’t answer', async () => {
    const db = linked()
    const send = async () => ({ ok: false, status: 503 })
    await expect(getOnUnlinkTool(() => SECRET, db, urls, send)({ tool: 'binder' }, { auth: auth() })).rejects.toThrow(/didn’t answer/)
    expect(db.data['users:tools/u1/binder/linkedAt']).toBe(1)
  })

  it('lets a system admin unlink someone else, and no one else', async () => {
    const send = async () => ({ ok: true, status: 200 })
    await expect(getOnUnlinkTool(() => SECRET, linked(), urls, send)({ tool: 'binder', uid: 'u1' }, { auth: auth('u2') })).rejects.toThrow(/system admins/)
    expect(await getOnUnlinkTool(() => SECRET, linked(), urls, send)({ tool: 'binder', uid: 'u1' }, { auth: auth('boss') })).toEqual({ unlinked: ['binder'] })
  })

  it('turns away the signed out and unknown tools', async () => {
    const send = async () => ({ ok: true, status: 200 })
    await expect(getOnUnlinkTool(() => SECRET, linked(), urls, send)({ tool: 'binder' }, { auth: null })).rejects.toThrow(/Sign in/)
    await expect(getOnUnlinkTool(() => SECRET, linked(), urls, send)({ tool: 'splits' }, { auth: auth() })).rejects.toThrow(/Unknown tool/)
  })
})
