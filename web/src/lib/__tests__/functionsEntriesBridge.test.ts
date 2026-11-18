// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { beforeAll, afterAll } from 'vitest'
import { FakeRtdb, snap } from './fakeRtdb'
import {
  getOnEntriesCompetition, getOnEntriesMembership, readEntriesMessage, sendEntriesMembership, signEntriesMessage,
  sendEntriesAccountDeletion, retryEntriesAccountDeletions,
} from '../../../../functions/src/entriesBridge'
import { ENTRIES_URLS } from '../../../../functions/src/entriesBridge'
import { DELETION_URLS, retryAccountDeletions, sendAccountDeletion } from '../../../../functions/src/accountDeletion'
import { SERVICES, serviceToken } from '../../../../functions/src/service'
import { getOnLink, getOnCompetitionUpdated } from '../../../../functions/src/links'

const { queueAccountDeletion } = createRequire(import.meta.url)('../../../../auth-hooks/deletion.js')
const SECRET = 'entries-bridge-test-secret'
const proof = async () => 'stub-service-proof'
// Service proofs on the emulator are signed with the fixed emulator key, so the receiver must run as on the emulator.
let before: string | undefined
beforeAll(() => { before = process.env.FUNCTIONS_EMULATOR; process.env.FUNCTIONS_EMULATOR = 'true' })
afterAll(() => { if (before === undefined) delete process.env.FUNCTIONS_EMULATOR; else process.env.FUNCTIONS_EMULATOR = before })
const claims = (extra: Record<string, unknown> = {}) => ({
  iss: 'https://entries.scotdance.app', aud: 'scotdance:entries', sub: 'organiser',
  competitionId: 'sat', organisationId: 'association', action: 'inspect', ...extra,
})
const registration = (revision = 1) => ({
  action: 'registration', revision, registrationURL: 'https://entries.scotdance.app/enter/association/sat',
  registrationStart: 1800000000000, registrationEnd: 1800100000000,
})
function setup() {
  const tree = new FakeRtdb()
  tree.data = {
    competitions: {
      sat: { name: 'Saturday Highland Competition', date: '2027-07-05', venue: 'Town Hall', listed: false, privateAccident: 'must not leak' },
      sun: { name: 'Sunday Highland Competition', date: '2027-07-06' },
    },
    organisations: { association: { name: 'Dancing Association', image: 'https://example.test/logo.png', secret: 'must not leak' } },
    'organisations:permissions': { association: { users: { organiser: true } } },
    'users:permissions': { organiser: { competitions: { sat: true, sun: true } } },
  }
  const db = tree.ref()
  const handler = getOnEntriesCompetition(() => SECRET, db)
  const call = (extra: Record<string, unknown> = {}) => handler({ pass: signEntriesMessage(SECRET, claims(extra)) })
  return { tree, db, call, handler }
}

describe('Entries signed requests', () => {
  it('rejects tampered, expired, wrong-purpose and future passes', () => {
    const pass = signEntriesMessage(SECRET, claims())
    expect(readEntriesMessage(pass, SECRET)).toMatchObject(claims())
    expect(() => readEntriesMessage(`${pass.slice(0, -8)}modified`, SECRET)).toThrow(/invalid or expired/)
    expect(() => readEntriesMessage(signEntriesMessage(SECRET, claims(), Date.now() - 121_000), SECRET)).toThrow()
    expect(() => readEntriesMessage(signEntriesMessage(SECRET, claims(), Date.now() + 60_000), SECRET)).toThrow()
    expect(() => readEntriesMessage(signEntriesMessage(SECRET, claims({ aud: 'entries' })), SECRET)).toThrow()
    expect(() => readEntriesMessage(signEntriesMessage(SECRET, claims({ iss: 'https://scotdance.app' })), SECRET)).toThrow()
  })

  it('reads only public snapshot fields, including an unlisted competition', async () => {
    const { call } = setup()
    const facts = await call({ action: 'snapshot', sub: 'service' })
    expect(facts).toEqual({
      competition: { id: 'sat', name: 'Saturday Highland Competition', date: '2027-07-05', venue: 'Town Hall' },
      organisation: { id: 'association', name: 'Dancing Association', shortName: null, image: 'https://example.test/logo.png' },
    })
  })

  it('checks both live permissions, not a prior sign-in claim or system-admin status', async () => {
    const { call, tree } = setup()
    expect(await call()).toMatchObject({ registrationTargetId: 'sat' })
    tree.write({ 'organisations:permissions/association/users/organiser': null })
    await expect(call()).rejects.toThrow(/administer both/)
    tree.write({ 'organisations:permissions/association/users/organiser': true, 'users:permissions/organiser/competitions/sat': null, 'users:permissions/organiser/admin': true })
    await expect(call()).rejects.toThrow(/administer both/)
  })

  it('rejects malformed IDs and foreign or mismatched entry URLs', async () => {
    const { call } = setup()
    await expect(call({ competitionId: '../sat' })).rejects.toThrow(/required/)
    await expect(call({ ...registration(), registrationURL: 'https://evil.test/enter/association/sat' })).rejects.toThrow(/link/)
    await expect(call({ ...registration(), registrationURL: 'https://entries.scotdance.app/enter/association/sun' })).rejects.toThrow(/link/)
    await expect(call({ ...registration(), registrationEnd: 1790000000000 })).rejects.toThrow(/after/)
  })

  it('accepts the Entries event page and the older entry form, and no other Entries page', async () => {
    const { call, tree } = setup()
    const at = (path: string) => `https://entries.scotdance.app${path}`
    expect(await call({ ...registration(1), registrationURL: at('/info/association/sat') })).toMatchObject({ applied: true })
    expect(tree.read('competitions/sat/registrationURL')).toBe(at('/info/association/sat'))
    expect(await call({ ...registration(2), registrationURL: at('/enter/association/sat') })).toMatchObject({ applied: true })
    expect(tree.read('competitions/sat/registrationURL')).toBe(at('/enter/association/sat'))
    for (const path of ['/organise/association/sat', '/info/association/sun', '/info/association/sat/extra', '/info/association/sat?x=1', '/info/association/sat#x']) {
      await expect(call({ ...registration(3), registrationURL: at(path) }), path).rejects.toThrow(/link/)
    }
    await expect(call({ ...registration(3), registrationURL: 'https://evil.test/info/association/sat' })).rejects.toThrow(/link/)
    expect(tree.read('competitions/sat/entriesRegistration/revision')).toBe(2)
  })

  it.each(['info', 'enter'])('release clears the /%s link and leaves a replacement link alone', async (page) => {
    const { call, tree } = setup()
    const { bindingId } = await call({ action: 'claim' })
    const url = `https://entries.scotdance.app/${page}/association/sat`
    await call({ ...registration(1), registrationURL: url })
    tree.write({ 'competitions/sat/registrationURL': 'https://other.example/register' })
    await call({ action: 'release', bindingId })
    expect(tree.read('competitions/sat')).toMatchObject({ registrationURL: 'https://other.example/register', registrationStart: 1800000000000 })
    expect(tree.read('competitions/sat/entriesRegistration')).toBeNull()

    const again = await call({ action: 'claim' })
    await call({ ...registration(1), registrationURL: url })
    await call({ action: 'release', bindingId: again.bindingId })
    const after = tree.read('competitions/sat')
    expect(after.registrationURL ?? null).toBeNull()
    expect(after.registrationStart ?? null).toBeNull()
    expect(after.entriesRegistration ?? null).toBeNull()
  })
})

describe('Entries registration ownership', () => {
  it('binds ongoing service publication to the verified connection rather than its last human editor', async () => {
    const { call, tree } = setup()
    const claimed = await call({ action: 'claim' })
    expect(claimed).toMatchObject({ registrationTargetId: 'sat', revision: 0 })
    expect(claimed.competition).toMatchObject({ id: 'sat', name: 'Saturday Highland Competition' })
    expect(claimed.organisation).toMatchObject({ id: 'association', name: 'Dancing Association' })
    expect(claimed.bindingId).toBeTruthy()
    expect((await call({ action: 'claim' })).bindingId).toBe(claimed.bindingId)
    tree.write({ 'users:permissions/organiser': null, 'organisations:permissions/association/users/organiser': null })
    await expect(call(registration(1))).rejects.toThrow(/administer both/)
    expect(await call({ ...registration(1), sub: 'entries-service', authority: 'service', bindingId: claimed.bindingId })).toMatchObject({ applied: true })
    await expect(call({ ...registration(2), sub: 'entries-service', authority: 'service', bindingId: 'wrong' })).rejects.toThrow(/no longer authorised/)
    await expect(call({ ...registration(2), competitionId: 'sun', registrationURL: 'https://entries.scotdance.app/enter/association/sun', sub: 'entries-service', authority: 'service', bindingId: claimed.bindingId })).rejects.toThrow(/no longer authorised/)
  })

  it('rejects the retired unlink action without changing registration ownership', async () => {
    const { call, tree } = setup()
    const claimed = await call({ action: 'claim' })
    await call(registration(1))
    const before = tree.read('competitions/sat')
    await expect(call({ action: 'unlink', bindingId: claimed.bindingId })).rejects.toThrow(/Unknown Entries action/)
    expect(tree.read('competitions/sat')).toEqual(before)
    expect((await call({ action: 'claim' })).bindingId).toBe(claimed.bindingId)
  })

  it.each(['released', 'replaced'])('does not restore a %s connection from a delayed linked propagation', async (state) => {
    const { call, tree, db } = setup()
    const claimed = await call({ action: 'claim' })
    await call(registration(1))
    await getOnLink(db)({ action: 'link', competitionId: 'sun', withId: 'sat' }, { auth: { uid: 'organiser' } })
    tree.duringTransaction = (path) => {
      if (path !== 'competitions/sun') return
      tree.duringTransaction = null
      tree.write({
        'competitions/sun/registrationURL': null,
        'competitions/sun/entriesRegistrationReleasedBinding': claimed.bindingId,
        'competitions/sun/entriesRegistration': state === 'released' ? null : {
          competitionId: 'sat', organisationId: 'association', targetId: 'sat', bindingId: 'new-binding', revision: 0,
        },
      })
    }
    await getOnCompetitionUpdated(db)({ before: snap({}), after: snap(tree.read('competitions/sat')) }, { params: { competitionId: 'sat' } })
    expect(tree.read('competitions/sun/registrationURL')).toBeNull()
    if (state === 'released') expect(tree.read('competitions/sun/entriesRegistration')).toBeNull()
    else expect(tree.read('competitions/sun/entriesRegistration')).toMatchObject({ bindingId: 'new-binding', revision: 0 })
  })
  it.each(['source leaves', 'primary leaves', 'source stops sharing'])('moves ownership home after changing the primary: %s', async (action) => {
    const { call, db, tree } = setup()
    const link = getOnLink(db)
    const ctx = { auth: { uid: 'organiser' } }
    await call(registration())
    await link({ action: 'link', competitionId: 'sun', withId: 'sat' }, ctx)
    tree.write({ 'competitions/mon': { name: 'Monday', date: '2027-07-07' }, 'users:permissions/organiser/competitions/mon': true })
    await link({ action: 'link', competitionId: 'mon', withId: 'sat' }, ctx)
    // The primary is newer than its mirrors while propagation is pending.
    await call({ ...registration(2), registrationEnd: 1800200000000 })
    await link({ action: 'primary', competitionId: 'sun' }, ctx)
    for (const id of ['sat', 'sun', 'mon']) expect(tree.read(`competitions/${id}/entriesRegistration`)).toMatchObject({ competitionId: 'sat', targetId: 'sun', revision: 2 })
    await link(action === 'source stops sharing'
      ? { action: 'sync', competitionId: 'sat', part: 'registration', on: false }
      : { action: 'unlink', competitionId: action === 'source leaves' ? 'sat' : 'sun' }, ctx)
    expect(tree.read('competitions/sat/entriesRegistration')).toMatchObject({ competitionId: 'sat', targetId: 'sat', revision: 2 })
    expect(tree.read('competitions/sat/registrationEnd')).toBe(1800200000000)
    for (const id of ['sun', 'mon']) expect(tree.read(`competitions/${id}/entriesRegistration`)).toBeNull()
    expect(await call(registration(3))).toMatchObject({ registrationTargetId: 'sat', applied: true })
  })

  it('does not let an overlapping older propagation regress a newer copied revision', async () => {
    const { call, db, tree } = setup()
    await call(registration())
    await getOnLink(db)({ action: 'link', competitionId: 'sun', withId: 'sat' }, { auth: { uid: 'organiser' } })
    tree.duringTransaction = (path) => {
      if (path !== 'competitions/sun') return
      tree.duringTransaction = null
      tree.write({ 'competitions/sun/entriesRegistration/revision': 2, 'competitions/sun/registrationEnd': 1800200000000 })
    }
    await getOnCompetitionUpdated(db)({ before: snap({}), after: snap(tree.read('competitions/sat')) }, { params: { competitionId: 'sat' } })
    expect(tree.read('competitions/sun/entriesRegistration/revision')).toBe(2)
    expect(tree.read('competitions/sun/registrationEnd')).toBe(1800200000000)
  })

  it('refuses a publication whose target moved while its transaction was pending', async () => {
    const { call, tree } = setup()
    await call(registration())
    tree.duringTransaction = (path) => {
      if (path !== 'competitions/sat') return
      tree.duringTransaction = null
      tree.write({ 'competitions/sat/entriesRegistration/targetId': 'sun' })
    }
    await expect(call(registration(2))).rejects.toThrow(/destination changed/)
    expect(tree.read('competitions/sat/entriesRegistration')).toMatchObject({ targetId: 'sun', revision: 1 })
  })

  it('publishes atomically from a cold transaction and ignores retries and late revisions', async () => {
    const { call, tree } = setup()
    expect(await call(registration(2))).toMatchObject({ applied: true, registrationTargetId: 'sat', revision: 2 })
    expect(await call({ ...registration(1), registrationEnd: 1800200000000 })).toMatchObject({ applied: false, revision: 2 })
    expect(await call(registration(2))).toMatchObject({ applied: false })
    expect(tree.read('competitions/sat/registrationEnd')).toBe(1800100000000)
    expect(tree.read('competitions/sat/entriesRegistration')).toEqual({ competitionId: 'sat', organisationId: 'association', targetId: 'sat', revision: 2 })
  })

  it('writes shared registration to the primary and refuses another source', async () => {
    const { call, db, tree } = setup()
    await getOnLink(db)({ action: 'link', competitionId: 'sun', withId: 'sat' }, { auth: { uid: 'organiser' } })
    expect(await call({ ...registration(), competitionId: 'sun', registrationURL: 'https://entries.scotdance.app/enter/association/sun' })).toMatchObject({ registrationTargetId: 'sat' })
    await expect(call(registration())).rejects.toThrow(/already belong/)
    tree.write({ 'users:permissions/organiser/competitions/sat': null })
    await expect(call({ ...registration(2), competitionId: 'sun', registrationURL: 'https://entries.scotdance.app/enter/association/sun' })).rejects.toThrow(/administer both/)
  })

  it('copies the managed state and releases an inherited lock when sharing stops', async () => {
    const { call, db, tree } = setup()
    await getOnLink(db)({ action: 'link', competitionId: 'sun', withId: 'sat' }, { auth: { uid: 'organiser' } })
    const before = tree.read('competitions/sat')
    await call(registration())
    await getOnCompetitionUpdated(db)({ before: snap(before), after: snap(tree.read('competitions/sat')) }, { params: { competitionId: 'sat' } })
    expect(tree.read('competitions/sun/entriesRegistration')).toMatchObject({ competitionId: 'sat', targetId: 'sat' })
    await getOnLink(db)({ action: 'sync', competitionId: 'sun', part: 'registration', on: false }, { auth: { uid: 'organiser' } })
    expect(tree.read('competitions/sun/entriesRegistration')).toBeNull()
    expect(await call({ ...registration(), competitionId: 'sun', registrationURL: 'https://entries.scotdance.app/enter/association/sun' })).toMatchObject({ applied: true, registrationTargetId: 'sun' })
    await expect(getOnLink(db)({ action: 'sync', competitionId: 'sun', part: 'registration', on: true }, { auth: { uid: 'organiser' } })).rejects.toThrow(/own Entries registration/)
  })
})

describe('Entries account deletion delivery', () => {
  it('bounds each retry sweep to 100 pending deletions and excludes completed history', async () => {
    const { db, tree } = setup()
    tree.write(Object.fromEntries(Array.from({ length: 105 }, (_, i) => [`entries:accountDeletions/p${i}`, { deletedAt: 1, state: 'pending' }])))
    tree.write({ 'entries:accountDeletions/complete': { deletedAt: 1, state: 'complete' } })
    let sent = 0
    await retryEntriesAccountDeletions(db, SECRET, 'http://entries.test/delete', async () => { sent++; return { ok: true, status: 200 } }, proof)
    expect(sent).toBe(100)
    await retryEntriesAccountDeletions(db, SECRET, 'http://entries.test/delete', async () => { sent++; return { ok: true, status: 200 } }, proof)
    expect(sent).toBe(105)
  })
  it('persists deletion across delivery failure and retries its distinct signed purpose idempotently', async () => {
    const { db, tree } = setup()
    const calls: Record<string, unknown>[] = []
    let fail = true
    const send = async (_url: string, body: unknown) => {
      const { data } = body as { data: { pass: string; service?: string; uid: string; deletedAt: number } }
      expect(data).toMatchObject({ service: 'stub-service-proof', uid: 'parent', deletedAt: expect.any(Number) })
      calls.push(JSON.parse(Buffer.from(data.pass.split('.')[1], 'base64url').toString()))
      return { ok: !fail, status: fail ? 503 : 200 }
    }
    const deleted = async ({ uid }: { uid: string }) => {
      await queueAccountDeletion(db, uid)
      await sendEntriesAccountDeletion(db, SECRET, 'http://entries.test/delete', uid, send, proof)
    }
    await expect(deleted({ uid: 'parent' })).rejects.toThrow(/503/)
    const queued = tree.read('entries:accountDeletions/parent') as { deletedAt: number; state: string }
    expect(queued.state).toBe('pending')
    fail = false
    await retryEntriesAccountDeletions(db, SECRET, 'http://entries.test/delete', send, proof)
    expect(tree.read('entries:accountDeletions/parent')).toMatchObject({ state: 'complete', deletedAt: queued.deletedAt })
    expect(calls[1]).toMatchObject({ aud: 'entries:delete', sub: 'parent', deletedAt: queued.deletedAt })
    await deleted({ uid: 'parent' })
    expect(calls).toHaveLength(2)
  })
})

describe.each(['binder', 'challenge'] as const)('%s account deletion delivery', (tool) => {
  const url = `http://${tool}.test/delete`
  const queue = `${tool}:accountDeletions`
  it('is queued with the Entries one, each under its own path and idempotently', async () => {
    const { db, tree } = setup()
    await queueAccountDeletion(db, 'parent')
    const queued = tree.read(`${queue}/parent`) as { deletedAt: number; state: string }
    expect(queued).toMatchObject({ state: 'pending', deletedAt: expect.any(Number) })
    expect(tree.read('entries:accountDeletions/parent')).toMatchObject({ state: 'pending' })
    await sendAccountDeletion(tool, db, url, 'parent', async () => ({ ok: true, status: 200 }), proof)
    await queueAccountDeletion(db, 'parent')
    expect(tree.read(`${queue}/parent`)).toMatchObject({ state: 'complete', deletedAt: queued.deletedAt })
  })
  it('sends uid, deletedAt and a service proof for the production audience, never a pass, then completes', async () => {
    const { db, tree } = setup()
    await queueAccountDeletion(db, 'parent')
    const audiences: string[] = []
    const bodies: any[] = []
    await sendAccountDeletion(tool, db, url, 'parent', async (_u, body) => { bodies.push(body); return { ok: true, status: 200 } },
      async (audience) => { audiences.push(audience); return 'stub-service-proof' })
    expect(audiences).toEqual([`https://us-central1-scotdance-${tool}.cloudfunctions.net/deleteScotDanceAccount`])
    expect(DELETION_URLS[tool]).toBe(audiences[0])
    const deletedAt = (tree.read(`${queue}/parent`) as { deletedAt: number }).deletedAt
    expect(bodies).toEqual([{ data: { uid: 'parent', deletedAt, service: 'stub-service-proof' } }])
    expect(tree.read(`${queue}/parent`)).toMatchObject({ state: 'complete' })
    await sendAccountDeletion(tool, db, url, 'parent', async () => { throw new Error('sent twice') }, proof)
  })
  it('stays pending on failure and is retried by the sweep', async () => {
    const { db, tree } = setup()
    await queueAccountDeletion(db, 'parent')
    await expect(sendAccountDeletion(tool, db, url, 'parent', async () => ({ ok: false, status: 503 }), proof)).rejects.toThrow(/503/)
    expect(tree.read(`${queue}/parent`)).toMatchObject({ state: 'pending' })
    await retryAccountDeletions(tool, db, url, async () => ({ ok: true, status: 200 }), proof)
    expect(tree.read(`${queue}/parent`)).toMatchObject({ state: 'complete' })
  })
  it('sends nothing, and stays pending, when no service proof is available', async () => {
    const { db, tree } = setup()
    await queueAccountDeletion(db, 'parent')
    let sent = 0
    const send = async () => { sent++; return { ok: true, status: 200 } }
    await expect(sendAccountDeletion(tool, db, url, 'parent', send, async () => undefined)).rejects.toThrow(/service proof/)
    await retryAccountDeletions(tool, db, url, send, async () => undefined)
    expect(sent).toBe(0)
    expect(tree.read(`${queue}/parent`)).toMatchObject({ state: 'pending' })
  })
})

describe('Entries dances', () => {
  it('preserves explicit program occurrences in the selected source competition and checks that target permission', async () => {
    const { call, tree } = setup()
    const dances = [
      { occurrenceId: 'sunday-fling', canonicalDanceId: 'fling', name: 'Fling', steps: '4' },
      { occurrenceId: 'sunday-trophy', canonicalDanceId: 'fling', name: 'Fling', steps: '4' },
    ]
    tree.write({ 'users:permissions/organiser/competitions/sun': null })
    await expect(call({ action: 'dances', competitionId: 'sun', dances })).rejects.toThrow(/administer both/)
    expect(tree.read('competitions:data/sun/dances')).toBeNull()
    tree.write({ 'users:permissions/organiser/competitions/sun': true })
    expect(await call({ action: 'dances', competitionId: 'sun', dances })).toEqual({ sent: 2 })
    expect(tree.read('competitions:data/sat/dances')).toBeNull()
    expect(Object.values(tree.read('competitions:data/sun/dances') as object)).toEqual([
      { name: 'Fling', steps: '4', _order: 0, entriesOccurrenceId: 'sunday-fling', entriesCanonicalDanceId: 'fling' },
      { name: 'Fling', steps: '4', _order: 1, entriesOccurrenceId: 'sunday-trophy', entriesCanonicalDanceId: 'fling' },
    ])
  })

  it('seeds only an empty list, deduplicating identical names and steps across categories', async () => {
    const { call, tree } = setup()
    const dances = [{ name: 'Fling', steps: 4 }, { name: 'Fling', steps: 4 }, { name: 'Fling', steps: 6 }, { name: 'Sword', steps: '2+1' }]
    expect(await call({ action: 'dances', dances })).toEqual({ sent: 3 })
    expect(Object.values(tree.read('competitions:data/sat/dances') as object)).toEqual([
      { name: 'Fling', steps: 4, _order: 0 }, { name: 'Fling', steps: 6, _order: 1 }, { name: 'Sword', steps: '2+1', _order: 2 },
    ])
    await expect(call({ action: 'dances', dances })).rejects.toThrow(/already has dances/)
  })

  it('does not overwrite an organiser edit racing the seed', async () => {
    const { call, tree } = setup()
    tree.duringTransaction = (path) => { if (path.endsWith('/dances')) tree.write({ [path]: { own: { name: 'Seann Triubhas' } } }) }
    await expect(call({ action: 'dances', dances: [{ name: 'Fling', steps: 4 }] })).rejects.toThrow(/already has dances/)
    expect(tree.read('competitions:data/sat/dances')).toEqual({ own: { name: 'Seann Triubhas' } })
  })
})

describe('Entries membership delivery', () => {
  it('sends current authority rather than an old removal event and retries failed delivery', async () => {
    const { db, tree } = setup()
    const posted: string[] = []
    const bodies: Record<string, unknown>[] = []
    const send = async (_url: string, body: unknown) => {
      bodies.push((body as { data: Record<string, unknown> }).data)
      posted.push((body as { data: { pass: string } }).data.pass)
      return { ok: true, status: 200 }
    }
    await getOnEntriesMembership(() => SECRET, db, () => 'https://entries.test/sync', send, proof)(
      { before: snap(true), after: snap(null) }, { params: { organisationId: 'association', uid: 'organiser' } },
    )
    expect(bodies[0]).toMatchObject({ service: 'stub-service-proof', uid: 'organiser', organisationId: 'association', allowed: true, checkedAt: expect.any(Number) })
    const payload = JSON.parse(Buffer.from(posted[0].split('.')[1], 'base64url').toString())
    expect(payload).toMatchObject({ iss: 'https://scotdance.app', aud: 'entries:membership', sub: 'organiser', organisationId: 'association', allowed: true, checkedAt: expect.any(Number) })
    await expect(sendEntriesMembership(db, SECRET, 'https://entries.test/sync', 'association', 'organiser', async () => ({ ok: false, status: 503 }), proof)).rejects.toThrow(/503/)
    expect(tree.read('entries:membershipFailures/association/organiser')).toMatchObject({ failedAt: expect.any(Number) })
    tree.write({ 'organisations:permissions/association/users/organiser': null })
    await sendEntriesMembership(db, SECRET, 'https://entries.test/sync', 'association', 'organiser', send, proof)
    expect(tree.read('entries:membershipFailures/association/organiser')).toBeNull()
    expect(JSON.parse(Buffer.from(posted[1].split('.')[1], 'base64url').toString()).allowed).toBe(false)
  })
})

describe('Entries service identity', () => {
  const body = (extra: Record<string, unknown> = {}) => ({ uid: 'organiser', action: 'inspect', competitionId: 'sat', organisationId: 'association', ...extra })
  const as = async (self: string, extra: Record<string, unknown> = {}, audience: string = ENTRIES_URLS.bridge) =>
    ({ ...body(extra), service: await serviceToken(audience, self, true) })

  it('serves SERVICES.entries every action, reading the account and values from the body', async () => {
    const { handler, tree } = setup()
    expect(await handler(await as(SERVICES.entries))).toMatchObject({ registrationTargetId: 'sat' })
    expect(await handler(await as(SERVICES.entries, registration()))).toMatchObject({ applied: true })
    expect(tree.read('competitions/sat/registrationURL')).toBe('https://entries.scotdance.app/enter/association/sat')
    // the account is still checked against live permissions
    await expect(handler(await as(SERVICES.entries, { uid: 'stranger' }))).rejects.toThrow(/administer both/)
  })

  it('limits SERVICES.entriesDevelopment to inspect and snapshot', async () => {
    const { handler } = setup()
    expect(await handler(await as(SERVICES.entriesDevelopment))).toMatchObject({ registrationTargetId: 'sat' })
    expect(await handler(await as(SERVICES.entriesDevelopment, { action: 'snapshot' }))).toMatchObject({ competition: { id: 'sat' } })
    for (const extra of [registration(), { action: 'claim' }, { action: 'release', bindingId: 'b' }, { action: 'dances', dances: [] }]) {
      await expect(handler(await as(SERVICES.entriesDevelopment, extra))).rejects.toMatchObject({ code: 'permission-denied' })
    }
  })

  it('turns away an unknown account and a token for another audience', async () => {
    const { handler } = setup()
    await expect(handler(await as('someone@example.com'))).rejects.toMatchObject({ code: 'unauthenticated' })
    await expect(handler(await as(SERVICES.entries, {}, ENTRIES_URLS.membership))).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('never falls back to the pass when service is present but bad', async () => {
    const { handler } = setup()
    const pass = signEntriesMessage(SECRET, claims())
    await expect(handler({ ...body(), service: 'garbage', pass })).rejects.toMatchObject({ code: 'unauthenticated' })
    await expect(handler({ service: 'garbage', pass })).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('validates the account and action as strictly as the pass subject', async () => {
    const { handler } = setup()
    for (const extra of [{ uid: 'a/b' }, { uid: '' }, { uid: 7 }, { action: undefined }, { action: 3 }]) {
      await expect(handler(await as(SERVICES.entries, extra))).rejects.toMatchObject({ code: 'invalid-argument' })
    }
    await expect(handler(await as(SERVICES.entries, { competitionId: 'a.b' }))).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('LEGACY(tool-pass-secret): still reads the old signed pass when service is absent', async () => {
    const { call } = setup()
    expect(await call()).toMatchObject({ registrationTargetId: 'sat' })
  })
})
