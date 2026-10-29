import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { PASS_SECONDS, getOnToolPass, signPass } from '../../../../functions/src/toolPass'

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
  const call = getOnToolPass(() => SECRET)
  const auth = (provider = 'password') => ({ uid: 'u1', token: { email: 'a@b.c', firebase: { sign_in_provider: provider } } })

  it('passes for a known tool, to someone signed in', async () => {
    const { pass } = await call({ audience: 'challenge' }, { auth: auth() })
    expect(decode(pass.split('.')[1]!)).toMatchObject({ sub: 'u1', aud: 'challenge', email: 'a@b.c', name: null })
  })

  it('turns away the signed out, the anonymous and unknown tools', async () => {
    await expect(call({ audience: 'challenge' }, { auth: null })).rejects.toThrow(/Sign in/)
    await expect(call({ audience: 'challenge' }, { auth: auth('anonymous') })).rejects.toThrow(/Sign in/)
    await expect(call({ audience: 'splits' }, { auth: auth() })).rejects.toThrow(/Unknown tool/)
  })
})
