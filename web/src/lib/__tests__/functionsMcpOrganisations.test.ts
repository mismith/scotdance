// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { writeTools } from '../../../../functions/src/mcp/writeTools'
import { organisationTools } from '../../../../functions/src/mcp/organisations'
import { explain } from '../../../../functions/src/mcp/toolkit'
import type { Session } from '../../../../functions/src/mcp/session'
import { fakeSession, type Json } from './mcpHarness'

// What a callable throws (firebase-functions' HttpsError): a code and a message
const HttpsError = (code: string, message: string) => Object.assign(new Error(message), { code })

const tools = [...writeTools, ...organisationTools]
const call = (s: Session, name: string, args: Json) => tools.find((t) => t.name === name)!.run(args as never, s) as Promise<Json>
const refused = async (p: Promise<unknown>, match: RegExp) => {
  const error = await p.then(() => null, (e: Error) => e)
  expect(error, 'should have been refused').not.toBeNull()
  expect(explain(error)).toMatch(match)
}

const world = (extra: Json = {}): Json => ({
  'users:permissions': { u1: { competitions: { c1: true }, organisations: { o1: true } } },
  organisations: {
    o1: { name: 'Foothills Highland Dancing Association', shortName: 'FHDA', location: 'Calgary, AB', links: { l1: { name: 'Rules', url: 'example.com/rules', _order: 0 } } },
    o2: { name: 'Someone Else’s Society' },
  },
  competitions: {
    c1: { name: 'Spring Games', date: '2026-04-11', location: 'Calgary, AB', listed: true, published: false },
    c2: { name: 'Fall Fling', date: '2026-10-10', location: 'Airdrie, AB', organisations: { o1: true } },
    c3: { name: 'Winter Classic', date: '2027-01-09', location: 'Banff, AB' },
    c4: { name: 'Old Games', date: '2024-05-05', organisations: { o1: true } },
  },
  ...extra,
})
describe('get_organisations', () => {
  it('lists the ones they are an admin of, with their competitions from a year ago and which are theirs', async () => {
    const { session } = fakeSession(world())
    const out = await call(session, 'get_organisations', {})
    const [fhda] = out.organisations
    expect(out.organisations).toHaveLength(1)
    expect(fhda).toMatchObject({ id: 'o1', name: 'Foothills Highland Dancing Association', shortName: 'FHDA', location: 'Calgary, AB', links: [{ id: 'l1', label: 'Rules', url: 'example.com/rules' }] })
    // (the date it counts from is a year before today: Old Games, years earlier, is not in it)
    expect(fhda.competitions.map((c: Json) => c.id)).toEqual(['c2'])
    expect(fhda.competitions[0]).toMatchObject({ yours: false, date: '2026-10-10' })
  })
  it('reads from the date asked, and finds one by name', async () => {
    const { session } = fakeSession(world())
    const out = await call(session, 'get_organisations', { organisation: 'foothills', from: '2020-01-01' })
    expect(out.organisations[0].competitions.map((c: Json) => c.id)).toEqual(['c2', 'c4'])
    await refused(call(session, 'get_organisations', { organisation: 'Someone Else’s Society' }), /No organisation matches/)
  })
})

describe('update_organisation', () => {
  it('changes the page as given, logs it under the organisation, and undo puts it back', async () => {
    const db = fakeSession(world())
    const out = await call(db.session, 'update_organisation', {
      organisation: 'Foothills Highland Dancing Association',
      shortName: ' FHDA2 ', website: 'fhda.ca', description: 'Dancing in the foothills.', location: null,
      links: [{ label: 'Results', url: 'https://fhda.ca/results' }, { id: 'l1', label: 'The rules' }],
    })
    expect(out.change).toBeTruthy()
    const o = db.tree.organisations.o1
    expect(o).toMatchObject({ shortName: 'FHDA2', website: 'fhda.ca', description: 'Dancing in the foothills.' })
    expect(o.location).toBeUndefined()
    expect(o.links.l1.name).toBe('The rules')
    const created = out.created[0]
    expect(o.links[created.id]).toMatchObject({ name: 'Results', url: 'https://fhda.ca/results', _order: 1 })

    const log = db.tree['organisations:changes'].o1[out.change]
    expect(log).toMatchObject({ uid: 'u1', tool: 'update_organisation' })
    expect(db.tree['competitions:changes']).toBeUndefined()
    const listed = await call(db.session, 'get_changes', { organisation: 'o1' })
    expect(listed.changes[0]).toMatchObject({ id: out.change, tool: 'update_organisation' })

    const undone = await call(db.session, 'undo_change', { organisation: 'o1', change: out.change })
    expect(undone.restored).toBeGreaterThan(0)
    expect(db.tree.organisations.o1).toEqual(world().organisations.o1)
    await refused(call(db.session, 'undo_change', { organisation: 'o1', change: out.change }), /already been undone/)
  })

  it('adds and takes off competitions as Manage does, and undoes them', async () => {
    const db = fakeSession(world())
    const out = await call(db.session, 'update_organisation', { organisation: 'o1', addCompetitions: ['c1', 'c3'], removeCompetitions: ['c2'] })
    expect(out.summary).toMatch(/^Added 2 competitions, took Fall Fling off/)
    expect(db.tree.competitions.c1.organisations).toEqual({ o1: true })
    expect(db.tree.competitions.c3.organisations).toEqual({ o1: true })
    expect(db.tree.competitions.c2.organisations).toBeUndefined()
    // Each competition added is a record of its own in the log
    expect(db.tree['organisations:changes'].o1[out.change].paths).toHaveLength(3)
    await call(db.session, 'undo_change', { organisation: 'o1', change: out.change })
    expect(db.tree.competitions.c1.organisations).toBeUndefined()
    expect(db.tree.competitions.c2.organisations).toEqual({ o1: true })
  })

  it('says when it is already so, and changes nothing', async () => {
    const db = fakeSession(world())
    const out = await call(db.session, 'update_organisation', { organisation: 'o1', addCompetitions: ['c2'], removeCompetitions: ['c3'] })
    expect(out.note).toBe('unchanged')
    expect(out.warnings).toEqual(['“Fall Fling” already has Foothills Highland Dancing Association.', '“Winter Classic” does not have Foothills Highland Dancing Association.'])
    expect(db.updates).toHaveLength(0)
  })

  it('stops a later edit being overwritten by an undo', async () => {
    const db = fakeSession(world())
    const first = await call(db.session, 'update_organisation', { organisation: 'o1', location: 'Okotoks, AB' })
    await call(db.session, 'update_organisation', { organisation: 'o1', location: 'High River, AB' })
    await refused(call(db.session, 'undo_change', { organisation: 'o1', change: first.change }), /changed again since.*location is now "High River, AB"/)
    expect(db.tree.organisations.o1.location).toBe('High River, AB')
  })

  it('refuses what the app’s form would, and an organisation they do not manage', async () => {
    const db = fakeSession(world({ competitionLinks: { L: { primary: 'c1', competitions: { c1: true, c3: true } } }, 'competitionLinks:of': { c3: 'L' }, 'competitionLinks:sync': { c3: { organisations: true } } }))
    await refused(call(db.session, 'update_organisation', { organisation: 'o1', name: '  ' }), /name can’t be empty/)
    await refused(call(db.session, 'update_organisation', { organisation: 'o1', website: 'not a link' }), /doesn’t look like a link/)
    await refused(call(db.session, 'update_organisation', { organisation: 'o1', links: [{ label: 'x' }] }), /needs its address/)
    await refused(call(db.session, 'update_organisation', { organisation: 'o1', links: [{ id: 'nope', url: 'a.ca' }] }), /no link nope/)
    await refused(call(db.session, 'update_organisation', { organisation: 'o1', addCompetitions: ['zzz'] }), /no competition zzz/i)
    await refused(call(db.session, 'update_organisation', { organisation: 'o1', addCompetitions: ['c1'], removeCompetitions: ['c1'] }), /added and taken off/)
    await refused(call(db.session, 'update_organisation', { organisation: 'o1', addCompetitions: ['c3'] }), /shared from Spring Games.*only be changed there/)
    await refused(call(db.session, 'update_organisation', { organisation: 'o2', name: 'Mine' }), /No organisation matches/)
    expect(db.updates).toHaveLength(0)
  })

  it('is stopped by the rules as well, with a sentence', async () => {
    const db = fakeSession(world(), { deny: (p) => p.startsWith('organisations/') })
    await refused(call(db.session, 'update_organisation', { organisation: 'o1', location: 'Elsewhere' }), /didn’t allow that change/)
  })

  it('get_changes and undo_change need exactly one of competition and organisation', async () => {
    const db = fakeSession(world())
    await refused(call(db.session, 'get_changes', {}), /competition, or organisation, not both/)
    await refused(call(db.session, 'get_changes', { competition: 'c1', organisation: 'o1' }), /not both/)
    await refused(call(db.session, 'undo_change', { organisation: 'o2', change: 'x' }), /No organisation matches/)
  })
})

describe('create_organisation', () => {
  const withCreate = (calls: Json[], answer: () => Promise<{ organisationId: string }>) => {
    const { session } = fakeSession(world())
    session.createOrganisation = async (data) => { calls.push(data); return answer() }
    return session
  }

  it('hands the callable what it was given, trimmed, and says it cannot be undone', async () => {
    const calls: Json[] = []
    const out = await call(withCreate(calls, async () => ({ organisationId: 'newOrg' })), 'create_organisation', { name: ' Peace River Games ', shortName: 'PRG', website: 'prg.ca', competition: 'c1' })
    expect(calls).toEqual([{ name: 'Peace River Games', shortName: 'PRG', location: undefined, website: 'prg.ca', competitionId: 'c1' }])
    expect(out.created).toEqual([{ kind: 'organisation', id: 'newOrg', name: 'Peace River Games' }])
    expect(out.note).toMatch(/cannot be removed/)
  })

  it('refuses over-long text instead of letting it be cut short, and a bad website', async () => {
    const calls: Json[] = []
    const s = withCreate(calls, async () => ({ organisationId: 'x' }))
    await refused(call(s, 'create_organisation', { name: 'A'.repeat(121) }), /name can be at most 120/)
    await refused(call(s, 'create_organisation', { name: 'A', shortName: 'B'.repeat(25) }), /short name can be at most 24/)
    await refused(call(s, 'create_organisation', { name: 'A', website: 'nope nope' }), /doesn’t look like a link/)
    expect(calls).toEqual([])
  })

  it('says what the callable said when it refuses (a name that exists, someone who manages nothing)', async () => {
    const exists = withCreate([], async () => { throw HttpsError('already-exists', 'This organisation already exists. Add it from the organisation picker.') })
    await refused(call(exists, 'create_organisation', { name: 'FHDA' }), /already exists/)
    const none = withCreate([], async () => { throw HttpsError('permission-denied', 'Submit a competition first.') })
    await refused(call(none, 'create_organisation', { name: 'FHDA' }), /Submit a competition first/)
    const broken = withCreate([], async () => { throw new Error('boom') })
    await refused(call(broken, 'create_organisation', { name: 'FHDA' }), /couldn’t do that just now/)
  })
})

// ---------- twins, and the override

const competition = (): Json => ({
  'users:permissions': { u1: { competitions: { c1: true } } },
  competitions: { c1: { name: 'Spring Games', date: '2026-04-11' } },
  'competitions:data': {
    c1: {
      staff: { s1: { type: 'Judge', firstName: 'Fiona', lastName: 'Black', _order: 0 }, s2: { type: 'Judge', firstName: 'Fiona', lastName: 'Brown', _order: 1 }, s3: { type: 'Piper', firstName: 'Fiona', lastName: 'Black', _order: 2 } },
      trophyEvents: { t1: { name: 'Dancer of the Day', _order: 0 }, t2: { name: 'Trophy Fling', _order: 1 } },
      categories: { cat1: { name: 'Premier', _order: 0 } },
      groups: { g1: { name: '9 & 10 Years', categoryId: 'cat1', _order: 0 } },
      dances: { d1: { name: 'Highland Fling', steps: '4', _order: 0 }, d2: { name: 'Highland Fling', steps: '6', _order: 1 } },
      platforms: { p1: { name: 'A', _order: 0 }, p2: { name: 'B', _order: 1 } },
    },
  },
})

describe('two with the same name', () => {
  it('refuses a second person with the same role and name, naming the override; allowSameName adds them', async () => {
    const db = fakeSession(competition())
    await refused(call(db.session, 'save_staff', { competition: 'c1', staff: [{ role: 'Judge', firstName: 'Fiona', lastName: 'Black' }] }), /already a Judge called “Fiona Black” \(id s1\).*allowSameName: true/)
    expect(db.updates).toHaveLength(0)
    const out = await call(db.session, 'save_staff', { competition: 'c1', allowSameName: true, staff: [{ role: 'Judge', firstName: 'Fiona', lastName: 'Black' }] })
    expect(out.created).toHaveLength(1)
    expect(Object.values(db.tree['competitions:data'].c1.staff).filter((s) => (s as Json).type === 'Judge' && (s as Json).lastName === 'Black')).toHaveLength(2)
  })

  it('refuses a trophy event with the name of one there, naming the override; allowSameName adds it', async () => {
    const db = fakeSession(competition())
    await refused(call(db.session, 'save_dances', { competition: 'c1', trophyEvents: [{ name: 'dancer of the day' }] }), /already a trophy event called “Dancer of the Day” \(id t1\).*allowSameName: true/)
    const out = await call(db.session, 'save_dances', { competition: 'c1', allowSameName: true, trophyEvents: [{ name: 'Dancer of the Day' }] })
    expect(out.created).toHaveLength(1)
  })

  it('refuses a rename that would make an exact twin, and lets allowSameName through for staff and trophy events', async () => {
    const db = fakeSession(competition())
    await refused(call(db.session, 'save_staff', { competition: 'c1', staff: [{ id: 's2', lastName: 'Black' }] }), /exact twin of “Fiona Black” \(id s1\).*allowSameName: true/)
    // A different role with that name is not a twin
    await call(db.session, 'save_staff', { competition: 'c1', staff: [{ id: 's2', role: 'Piper', lastName: 'Blue' }] })
    await refused(call(db.session, 'save_dances', { competition: 'c1', trophyEvents: [{ id: 't2', name: 'Dancer of the Day' }] }), /exact twin.*“Dancer of the Day”.*allowSameName: true/)
    expect(db.tree['competitions:data'].c1.trophyEvents.t2.name).toBe('Trophy Fling')
    await call(db.session, 'save_dances', { competition: 'c1', allowSameName: true, trophyEvents: [{ id: 't2', name: 'Dancer of the Day' }] })
    expect(db.tree['competitions:data'].c1.trophyEvents.t2.name).toBe('Dancer of the Day')
    await call(db.session, 'save_staff', { competition: 'c1', allowSameName: true, staff: [{ id: 's2', role: 'Judge', firstName: 'Fiona', lastName: 'Black' }] })
  })

  it('refuses renames of dances, categories, age groups and platforms into twins (no override: those are mistakes)', async () => {
    const db = fakeSession(competition())
    await refused(call(db.session, 'save_dances', { competition: 'c1', dances: [{ id: 'd2', steps: 4 }] }), /exact twin of the dance “Highland Fling \(4\)”.*name or steps\./)
    await refused(call(db.session, 'save_staff', { competition: 'c1', platforms: [{ id: 'p2', name: 'A' }] }), /exact twin of the platform “A”/)
    await refused(call(db.session, 'save_staff', { competition: 'c1', platforms: [{ name: 'a' }] }), /already a platform called “A”/)
    await refused(call(db.session, 'save_dances', { competition: 'c1', allowSameName: true, dances: [{ id: 'd2', steps: 4 }] }), /exact twin/)
    await call(db.session, 'save_dances', { competition: 'c1', ageGroups: [{ category: 'Premier', name: '11 & 12 Years' }] })
    const [g2] = Object.keys(db.tree['competitions:data'].c1.groups).filter((g) => g !== 'g1')
    await refused(call(db.session, 'save_dances', { competition: 'c1', ageGroups: [{ id: g2, name: '9 & 10 Years' }] }), /exact twin of “Premier 9 & 10 Years”/)
    // A change that does not touch the name is fine even where twins already exist
    await call(db.session, 'save_dances', { competition: 'c1', dances: [{ id: 'd2', shortName: 'Fling 6' }] })
  })
})
