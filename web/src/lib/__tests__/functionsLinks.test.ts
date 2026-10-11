// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  getOnCompetitionUpdated,
  getOnLink,
  getOnStaffWritten,
  planStaff,
  takeOut,
} from '../../../../functions/src/links'
import { FakeRtdb, snap, type TriggerEvent } from './fakeRtdb'

// Linked competitions (functions/src/links.ts, ADR 0007): the callable that
// links, unlinks, chooses the primary and switches what syncs, and the
// triggers that copy the primary's staff and details to the others.

/** Database values: untyped JSON. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

const STAFF = 'competitions:data/{competitionId}/staff/{staffId}'
const COMPETITION = 'competitions/{competitionId}'

const judge = (firstName: string, lastName: string, extra: Json = {}) => ({ type: 'Judge', firstName, lastName, ...extra })

function seed(): Json {
  return {
    competitions: {
      fri: {
        name: 'SDCCS Pre-Premier Open', date: '2027-07-05', venue: 'Halifax Convention Centre', address: '1650 Argyle St',
        location: 'Halifax, NS', lat: 44.6, lng: -63.6, description: 'Seven competitions, one week in Halifax.',
        registrationURL: 'https://example.test/register', listed: true, published: false,
        links: { l1: { name: 'Program', url: 'https://example.test/p.pdf' } }, organisations: { sdc: true },
      },
      sat: { name: 'SDCCS Premier Open', date: '2027-07-06', venue: 'Somewhere Else', location: 'Halifax, NS', listed: false },
      sun: { name: 'SDCCS Junior Championship', date: '2027-07-11', venue: 'Riverside Arena', location: 'Halifax, NS' },
      other: { name: 'Cowal Games', date: '2027-08-27' },
    },
    'competitions:data': {
      fri: { staff: { j1: judge('Ailsa', 'Grant', { judgeId: 'A1' }), j2: judge('Morag', 'Fraser'), s1: { type: 'Sponsor', firstName: 'Duncan', lastName: 'Ross' } } },
      sat: {
        staff: { x1: judge('Ailsa', 'Grant'), x2: judge('Iain', 'Sutherland') },
        groups: { g1: { name: 'Premier 12', sponsor: 'x1' }, g2: { name: 'Premier 13', sponsor: 'x2' }, g3: { name: 'Old', sponsor: 'A typed name' } },
        schedule: { days: { d1: { blocks: { b1: { events: { e1: { dances: { i1: { platforms: { p1: { orderedJudgeIds: ['x1', 'x2'] } } } } } } } } } } },
      },
    },
    'users:permissions': {
      organiser: { competitions: { fri: true, sat: true, sun: true } },
      friOnly: { competitions: { fri: true } },
      admin: { admin: true },
    },
  }
}

function setup(data: Json = seed()) {
  const rtdb = new FakeRtdb()
  rtdb.data = data
  rtdb.patterns = [STAFF, COMPETITION]
  const db = rtdb.ref() as never
  const call = (uid: string | null, args: Json) => getOnLink(db)(args, { auth: uid ? { uid } : null })
  const onStaff = getOnStaffWritten(db)
  const onCompetition = getOnCompetitionUpdated(db)
  /** Runs the sync triggers for what's been written, as the platform would, until things settle. */
  async function settle() {
    for (let round = 0; round < 10 && rtdb.events.length; round += 1) {
      for (const e of rtdb.events.splice(0) as TriggerEvent[]) {
        const change = { before: snap(e.before), after: snap(e.after) }
        if (e.pattern === STAFF) await onStaff(change, { params: e.params })
        else if (e.before !== null && e.after !== null) await onCompetition(change, { params: e.params })
      }
    }
  }
  /** Writes as the app (or another function) would, then lets the triggers run. */
  async function save(updates: Record<string, Json>) {
    rtdb.write(updates)
    await settle()
  }
  return { rtdb, db, call, settle, save, read: (path: string) => rtdb.read(path) }
}

/** Fri, Sat and Sun linked with Fri as the primary, everything synced. */
async function linked() {
  const t = setup()
  await t.call('organiser', { action: 'link', competitionId: 'sat', withId: 'fri' })
  await t.call('organiser', { action: 'link', competitionId: 'sun', withId: 'fri' })
  await t.settle()
  return t
}

describe('planStaff', () => {
  it('moves sponsors and schedule judges to whoever has the same name, and clears the rest', () => {
    const data = seed()['competitions:data']
    const plan = planStaff('sat', { from: data.fri.staff, to: data.sat.staff, groups: data.sat.groups, schedule: data.sat.schedule })
    expect(plan.updates['competitions:data/sat/staff']).toEqual({
      j1: judge('Ailsa', 'Grant'),
      j2: judge('Morag', 'Fraser'),
      s1: { type: 'Sponsor', firstName: 'Duncan', lastName: 'Ross' },
    })
    expect(plan.updates['competitions:data/sat/groups/g1/sponsor']).toBe('j1')
    expect(plan.updates['competitions:data/sat/groups/g2/sponsor']).toBeNull()
    expect('competitions:data/sat/groups/g3/sponsor' in plan.updates).toBe(false)
    expect(plan.updates['competitions:data/sat/schedule/days/d1/blocks/b1/events/e1/dances/i1/platforms/p1/orderedJudgeIds']).toEqual(['j1'])
    expect(plan.cleared).toEqual([{ name: 'Iain Sutherland', sponsors: 1, judging: 1 }])
    expect(plan).toMatchObject({ count: 3, replacing: 2, blocked: [] })
  })

  it('moves championship points to the same judge, and won’t drop any', () => {
    const from = { j1: judge('Ailsa', 'Grant') }
    const moved = planStaff('sat', { from, to: { x1: judge('Ailsa', 'Grant') }, points: { g1: { fling: { x1: ['3', '7'] } } } })
    expect(moved.updates['competitions:data/sat/points/g1/fling/x1']).toBeNull()
    expect(moved.updates['competitions:data/sat/points/g1/fling/j1']).toEqual(['3', '7'])
    const stuck = planStaff('sat', { from, to: { x2: judge('Iain', 'Sutherland') }, points: { g1: { fling: { x2: ['3'] } } } })
    expect(stuck.blocked).toEqual(['Iain Sutherland'])
  })

  it('keeps its own back-pointers for the same person, and changes nothing when they already match', () => {
    const from = { j1: judge('Ailsa', 'Grant', { judgeId: 'A1' }) }
    const plan = planStaff('sat', { from, to: { j1: judge('Ailsa', 'Grant', { judgeId: 'A1' }) } })
    expect(plan.updates).toEqual({})
    const fresh = planStaff('sat', { from, to: {} })
    expect(fresh.updates['competitions:data/sat/staff']).toEqual({ j1: judge('Ailsa', 'Grant') })
  })
})

describe('linkCompetitions: link', () => {
  it('starts a link with the one you’re on as the primary, and copies everything into the other', async () => {
    const { call, read } = setup()
    const res = await call('organiser', { action: 'link', competitionId: 'sat', withId: 'fri' })
    expect(res).toMatchObject({ joining: 'sat', primary: 'fri' })
    const linkId = res.linkId as string
    expect(read(`competitionLinks/${linkId}`)).toEqual({ primary: 'fri', competitions: { fri: true, sat: true } })
    expect(read('competitionLinks:of')).toEqual({ fri: linkId, sat: linkId })
    expect(Object.keys(read('competitionLinks:sync/sat'))).toEqual(['about', 'venue', 'registration', 'links', 'visibility', 'organisations', 'staff'])
    expect(read('competitionLinks:sync/fri')).toBeNull()
    const sat = read('competitions/sat')
    expect(sat).toMatchObject({ name: 'SDCCS Premier Open', date: '2027-07-06', venue: 'Halifax Convention Centre', lat: 44.6, listed: true, organisations: { sdc: true } })
    expect(sat.links).toEqual({ l1: { name: 'Program', url: 'https://example.test/p.pdf' } })
    expect(Object.keys(read('competitions:data/sat/staff'))).toEqual(['j1', 'j2', 's1'])
  })

  it('takes only the parts asked for', async () => {
    const { call, read } = setup()
    await call('organiser', { action: 'link', competitionId: 'sun', withId: 'fri', parts: ['staff', 'about'] })
    expect(read('competitionLinks:sync/sun')).toEqual({ about: true, staff: true })
    expect(read('competitions/sun/venue')).toBe('Riverside Arena')
    expect(read('competitions/sun/description')).toBe('Seven competitions, one week in Halifax.')
  })

  it('joins the one not yet linked to the other’s link, from either side', async () => {
    const { call, read } = setup()
    const { linkId } = await call('organiser', { action: 'link', competitionId: 'sat', withId: 'fri' })
    // On Sunday, linking it with Saturday: Sunday joins, Friday stays the primary.
    const res = await call('organiser', { action: 'link', competitionId: 'sat', withId: 'sun' })
    expect(res).toMatchObject({ linkId, joining: 'sun', primary: 'fri' })
    expect(read(`competitionLinks/${linkId}/competitions`)).toEqual({ fri: true, sat: true, sun: true })
  })

  it('says what it would replace without changing anything, on a dry run', async () => {
    const { call, read } = setup()
    const res = await call('organiser', { action: 'link', competitionId: 'sat', withId: 'fri', dryRun: true })
    expect(read('competitionLinks')).toBeNull()
    const parts = Object.fromEntries(res.targets[0].parts.map((p: Json) => [p.part, p]))
    expect(parts.venue.replaces).toBe(true) // it had its own venue
    expect(parts.about.replaces).toBe(false) // it had no description
    expect(parts.staff).toMatchObject({ replaces: true, staff: { count: 3, replacing: 2, cleared: [{ name: 'Iain Sutherland', sponsors: 1, judging: 1 }] } })
  })

  it('needs you to manage both, and refuses ones already in other links', async () => {
    const { call } = setup()
    await expect(call(null, { action: 'link', competitionId: 'sat', withId: 'fri' })).rejects.toMatchObject({ code: 'unauthenticated' })
    await expect(call('friOnly', { action: 'link', competitionId: 'other', withId: 'fri' })).rejects.toMatchObject({ code: 'permission-denied' })
    await call('admin', { action: 'link', competitionId: 'sat', withId: 'fri' })
    await call('admin', { action: 'link', competitionId: 'other', withId: 'sun' })
    await expect(call('admin', { action: 'link', competitionId: 'sat', withId: 'sun' })).rejects.toMatchObject({ code: 'failed-precondition' })
    await expect(call('admin', { action: 'link', competitionId: 'sat', withId: 'fri' })).rejects.toMatchObject({ code: 'already-exists' })
    await expect(call('admin', { action: 'link', competitionId: 'gone', withId: 'fri' })).rejects.toMatchObject({ code: 'not-found' })
  })

  it('won’t replace staff whose championship points would be lost', async () => {
    const data = seed()
    data['competitions:data'].sat.points = { g1: { fling: { x2: ['3'] } } }
    const { call, read } = setup(data)
    await expect(call('organiser', { action: 'link', competitionId: 'sat', withId: 'fri' })).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'Its championship points have marks from Iain Sutherland, who isn’t on SDCCS Pre-Premier Open’s staff.',
    })
    expect(read('competitionLinks')).toBeNull()
    // Without its staff, it can still link.
    await call('organiser', { action: 'link', competitionId: 'sat', withId: 'fri', parts: ['venue'] })
    expect(read('competitionLinks:sync/sat')).toEqual({ venue: true })
  })
})

describe('linkCompetitions: unlink, primary, sync', () => {
  it('takes one out, keeping what it has; a link of one is no link', async () => {
    const { call, read } = await linked()
    const linkId = read('competitionLinks:of/fri')
    await call('organiser', { action: 'unlink', competitionId: 'sun' })
    expect(read(`competitionLinks/${linkId}/competitions`)).toEqual({ fri: true, sat: true })
    expect(read('competitionLinks:sync/sun')).toBeNull()
    expect(read('competitions/sun/venue')).toBe('Halifax Convention Centre')
    await call('organiser', { action: 'unlink', competitionId: 'sat' })
    expect(read('competitionLinks')).toBeNull()
    expect(read('competitionLinks:of')).toBeNull()
    expect(read('competitionLinks:sync')).toBeNull()
  })

  it('stops the others syncing when the primary leaves', async () => {
    const { rtdb, read } = await linked()
    const linkId = read('competitionLinks:of/fri')
    await takeOut(rtdb.ref() as never, 'fri')
    expect(read(`competitionLinks/${linkId}`)).toEqual({ competitions: { sat: true, sun: true } })
    expect(read('competitionLinks:sync')).toBeNull()
  })

  it('lets the primary’s manager take one out, but not a stranger', async () => {
    const t = await linked()
    await expect(t.call('nobody', { action: 'unlink', competitionId: 'sun' })).rejects.toMatchObject({ code: 'permission-denied' })
    await t.call('friOnly', { action: 'unlink', competitionId: 'sun' })
    expect(t.read('competitionLinks:of/sun')).toBeNull()
  })

  it('makes another the primary, copying from it, and the old primary takes what it took', async () => {
    const { call, read, save } = await linked()
    await call('organiser', { action: 'sync', competitionId: 'sun', part: 'venue', on: false })
    await save({ 'competitions/sun/venue': 'Riverside Arena' })
    await call('organiser', { action: 'primary', competitionId: 'sun' })
    const linkId = read('competitionLinks:of/fri')
    expect(read(`competitionLinks/${linkId}/primary`)).toBe('sun')
    expect(read('competitionLinks:sync/sun')).toBeNull()
    expect(read('competitionLinks:sync/fri')).not.toHaveProperty('venue')
    expect(read('competitions/fri/venue')).toBe('Halifax Convention Centre')
    expect(read('competitions/sat/venue')).toBe('Riverside Arena')
    await expect(call('friOnly', { action: 'primary', competitionId: 'fri' })).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('switches a part for every other one from the primary, or for one from itself', async () => {
    const { call, read } = await linked()
    await call('organiser', { action: 'sync', competitionId: 'fri', part: 'registration', on: false })
    expect(read('competitionLinks:sync/sat/registration')).toBeNull()
    expect(read('competitionLinks:sync/sun/registration')).toBeNull()
    await call('organiser', { action: 'sync', competitionId: 'sun', part: 'registration', on: true })
    expect(read('competitionLinks:sync/sun/registration')).toBe(true)
    expect(read('competitionLinks:sync/sat/registration')).toBeNull()
  })

  it('copies its synced parts again with Sync now', async () => {
    const { call, rtdb, read } = await linked()
    rtdb.write({ 'competitions/sat/venue': 'Gone astray' })
    rtdb.events.splice(0)
    await call('organiser', { action: 'syncNow', competitionId: 'sat' })
    expect(read('competitions/sat/venue')).toBe('Halifax Convention Centre')
  })
})

describe('keeping them in step', () => {
  it('copies the primary’s staff changes to the ones taking its staff', async () => {
    const { call, save, read } = await linked()
    await call('organiser', { action: 'sync', competitionId: 'sun', part: 'staff', on: false })
    await save({ 'competitions:data/fri/staff/j2/location': 'Hamilton, ON', 'competitions:data/fri/staff/j3': judge('Heather', 'Lyall') })
    expect(read('competitions:data/sat/staff/j2')).toEqual(judge('Morag', 'Fraser', { location: 'Hamilton, ON' }))
    expect(read('competitions:data/sat/staff/j3')).toEqual(judge('Heather', 'Lyall'))
    expect(read('competitions:data/sun/staff/j3')).toBeNull()
    await save({ 'competitions:data/fri/staff/j3': null })
    expect(read('competitions:data/sat/staff/j3')).toBeNull()
  })

  it('leaves each one’s back-pointers alone, and doesn’t copy back-pointer changes', async () => {
    const { save, rtdb, read } = await linked()
    rtdb.write({ 'competitions:data/sat/staff/j2/judgeId': 'M2' })
    rtdb.events.splice(0)
    await save({ 'competitions:data/fri/staff/j2/judgeId': 'M1' })
    expect(read('competitions:data/sat/staff/j2/judgeId')).toBe('M2')
    await save({ 'competitions:data/fri/staff/j2/lastName': 'Fraser-Bain' })
    expect(read('competitions:data/sat/staff/j2')).toMatchObject({ lastName: 'Fraser-Bain', judgeId: 'M2' })
  })

  it('copies the primary’s changed details to the ones taking that part only', async () => {
    const { call, save, read } = await linked()
    await call('organiser', { action: 'sync', competitionId: 'sun', part: 'venue', on: false })
    await save({ 'competitions/fri/venue': 'The Forum', 'competitions/fri/published': true })
    expect(read('competitions/sat')).toMatchObject({ venue: 'The Forum', published: true })
    expect(read('competitions/sun')).toMatchObject({ venue: 'Halifax Convention Centre', published: true })
  })

  it('never copies a copy’s changes onward', async () => {
    const { save, read } = await linked()
    await save({ 'competitions/sat/description': 'Changed on Saturday by a function' })
    expect(read('competitions/fri/description')).toBe('Seven competitions, one week in Halifax.')
    expect(read('competitions/sun/description')).toBe('Seven competitions, one week in Halifax.')
  })

  it('doesn’t bring a deleted competition back', async () => {
    const { save, rtdb, read } = await linked()
    rtdb.write({ 'competitions/sun': null })
    rtdb.events.splice(0)
    await save({ 'competitions/fri/description': 'Updated' })
    expect(read('competitions/sun')).toBeNull()
  })
})
