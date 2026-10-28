// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { FakeRtdb } from './fakeRtdb'
import { getOnCreate } from '../../../../functions/src/organisations'

function setup() {
  const db = new FakeRtdb()
  db.write({
    'users:permissions/owner/admin': true,
    'users:permissions/organiser/competitions/c1': true,
    'users/organiser/email': 'organiser@example.test',
    'competitions/c1': { name: 'BCHDA Winter Competition Series #1', date: '2027-01-10', submissionId: 's1' },
    'competitions:submissions/s1': { competitionId: 'c1', submittedBy: 'organiser' },
  })
  const create = (data: object, uid = 'owner') => getOnCreate(db.ref())(data, { auth: { uid } })
  return { db, create }
}
const draft = { name: 'BCHDA', shortName: 'BCHDA', location: 'Vancouver, BC', website: ' bchda.ca ', competitionId: 'c1', join: false }

describe('creating an organisation from a managed competition', () => {
  it('creates, links and grants the verified submitter in one write', async () => {
    const { db, create } = setup()
    const before = db.writes
    const { organisationId: id } = await create({ ...draft, grantSubmitter: true })
    expect(db.writes - before).toBe(1)
    expect(db.read(`organisations/${id}`)).toMatchObject({ name: 'BCHDA', location: 'Vancouver, BC', website: 'bchda.ca', createdBy: 'owner' })
    expect(db.read(`competitions/c1/organisations/${id}`)).toBe(true)
    expect(db.read(`users:permissions/organiser/organisations/${id}`)).toBe(true)
    expect(db.read(`organisations:permissions/${id}/users/organiser`)).toBe(true)
    expect(db.read(`users:permissions/owner/organisations/${id}`)).toBeNull()
  })
  it('does not grant the submitter unless selected', async () => {
    const { db, create } = setup()
    const { organisationId: id } = await create(draft)
    expect(db.read(`organisations:permissions/${id}`)).toBeNull()
  })
  it('ordinary organisers still become admin of their new organisation', async () => {
    const { db, create } = setup()
    const { organisationId: id } = await create(draft, 'organiser')
    expect(db.read(`users:permissions/organiser/organisations/${id}`)).toBe(true)
  })
  it('rejects privilege escalation and foreign competitions before creating anything', async () => {
    const { db, create } = setup()
    await expect(create({ ...draft, grantSubmitter: true }, 'organiser')).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(create({ ...draft, competitionId: 'foreign' }, 'organiser')).rejects.toMatchObject({ code: 'permission-denied' })
    expect(db.read('organisations')).toBeNull()
  })
  it('refuses a newly existing match without granting access to it', async () => {
    const { db, create } = setup()
    db.write({ 'organisations/existing': { name: 'British Columbia Highland Dancing Association', shortName: 'BCHDA' } })
    await expect(create({ ...draft, grantSubmitter: true })).rejects.toMatchObject({ code: 'already-exists' })
    expect(Object.keys(db.read('organisations') as object)).toEqual(['existing'])
    expect(db.read('organisations:permissions/existing')).toBeNull()
    expect(db.read('competitions/c1/organisations')).toBeNull()
  })
  it('rejects missing/deleted accounts, mismatched submissions and missing competitions without partial records', async () => {
    for (const updates of [
      { 'users/organiser': null },
      { 'competitions:submissions/s1/competitionId': 'other' },
      { 'competitions:submissions/s1': null },
      { 'competitions/c1': null },
      { 'competitionLinks:sync/c1/organisations': true },
    ]) {
      const { db, create } = setup()
      db.write(updates)
      await expect(create({ ...draft, grantSubmitter: true })).rejects.toThrow()
      expect(db.read('organisations')).toBeNull()
    }
  })
})
