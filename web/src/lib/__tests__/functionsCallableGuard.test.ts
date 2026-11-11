import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ensureAdmin } from '../../../../functions/src/utility/competition'
import { getOnToolPass } from '../../../../functions/src/toolPass'
import { https } from '../../../../functions/src/utility/triggers'

// An assistant's session holds a real ID token for its owner, marked `via: 'mcp'` (ADR 0018). It must never reach
// a callable on its own: not a system admin's utilities, not tool passes. Callables turn it away by default.

const person = { uid: 'admin-1', token: { email: 'a@b.c', firebase: { sign_in_provider: 'password' } } }
const assistant = { uid: 'admin-1', token: { ...person.token, via: 'mcp', scope: 'manage' } }

// A callable's function runs a request through its handler
type Callable = { run(request: unknown): unknown }
const request = (auth: unknown) => ({ data: {}, auth, rawRequest: {} })

describe('callables and assistants', () => {
  it('turns an assistant’s token away before the handler runs, and lets a person through', async () => {
    let ran = 0
    const fn = https().onCall(async () => ++ran) as unknown as Callable
    await expect(Promise.resolve().then(() => fn.run(request(assistant)))).rejects.toThrow(/Assistants can’t do this/)
    expect(ran).toBe(0)
    expect(await fn.run(request(person))).toBe(1)
    expect(await fn.run(request(null))).toBe(2)
  })

  it('runs for an assistant only when the callable opts in', async () => {
    const fn = https({}, { assistants: true }).onCall(async () => 'ok') as unknown as Callable
    expect(await fn.run(request(assistant))).toBe('ok')
  })

  it('keeps a system admin’s powers from their assistant, even where a callable forgets to', async () => {
    const db = { child: () => ({ get: async () => ({ val: () => true }) }) }
    await expect(ensureAdmin({ auth: person }, db)).resolves.toBeUndefined()
    await expect(ensureAdmin({ auth: assistant }, db)).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('never mints a tool pass for an assistant', async () => {
    const db = { child: () => ({ get: async () => ({ val: () => null }), update: async () => {}, remove: async () => {} }) }
    const toolPass = https().onCall(getOnToolPass(() => 'secret', db)) as unknown as Callable
    expect(((await toolPass.run({ data: { audience: 'challenge' }, auth: person, rawRequest: {} })) as { pass: string }).pass).toBeTruthy()
    await expect(Promise.resolve().then(() => toolPass.run({ data: { audience: 'challenge' }, auth: assistant, rawRequest: {} }))).rejects.toThrow(/Assistants can’t do this/)
  })

  it('opts no callable in: an assistant reaches createOrganisation only through its tool', () => {
    const source = readFileSync(resolve(process.cwd(), '../functions/src/index.ts'), 'utf8')
    const optedIn = source.split('\n').filter((line) => /assistants:\s*true/.test(line))
    expect(optedIn).toEqual([])
  })
})
