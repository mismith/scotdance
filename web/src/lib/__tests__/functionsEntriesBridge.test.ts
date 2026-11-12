// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { FakeRtdb, snap } from './fakeRtdb'
import {
  getOnEntriesCompetition, getOnEntriesMembership, readEntriesMessage, sendEntriesMembership, signEntriesMessage,
} from '../../../../functions/src/entriesBridge'
import { getOnLink, getOnCompetitionUpdated } from '../../../../functions/src/links'

const SECRET = 'entries-bridge-test-secret'
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
      organisation: { id: 'association', name: 'Dancing Association', image: 'https://example.test/logo.png' },
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
})

describe('Entries registration ownership', () => {
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

describe('Entries dances', () => {
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
    const send = async (_url: string, body: unknown) => {
      posted.push((body as { data: { pass: string } }).data.pass)
      return { ok: true, status: 200 }
    }
    await getOnEntriesMembership(() => SECRET, db, () => 'https://entries.test/sync', send)(
      { before: snap(true), after: snap(null) }, { params: { organisationId: 'association', uid: 'organiser' } },
    )
    const payload = JSON.parse(Buffer.from(posted[0].split('.')[1], 'base64url').toString())
    expect(payload).toMatchObject({ iss: 'https://scotdance.app', aud: 'entries:membership', sub: 'organiser', organisationId: 'association', allowed: true, checkedAt: expect.any(Number) })
    await expect(sendEntriesMembership(db, SECRET, 'https://entries.test/sync', 'association', 'organiser', async () => ({ ok: false, status: 503 }))).rejects.toThrow(/503/)
    expect(tree.read('entries:membershipFailures/association/organiser')).toMatchObject({ failedAt: expect.any(Number) })
    tree.write({ 'organisations:permissions/association/users/organiser': null })
    await sendEntriesMembership(db, SECRET, 'https://entries.test/sync', 'association', 'organiser', send)
    expect(tree.read('entries:membershipFailures/association/organiser')).toBeNull()
    expect(JSON.parse(Buffer.from(posted[1].split('.')[1], 'base64url').toString()).allowed).toBe(false)
  })
})
