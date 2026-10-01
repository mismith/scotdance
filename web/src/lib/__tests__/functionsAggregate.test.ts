// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createAggregator } from '../../../../functions/src/utility/aggregate'
import { dancerAggregator, personName, staffAggregator, venueAggregator } from '../../../../functions/src/utility/entityConfigs'
import { normalizeName } from '../../../../functions/src/utility/normalize'
import { FakeRtdb, snap, type TriggerEvent } from './fakeRtdb'

// The Cloud Functions that keep /dancers, /judges, /pipers and /venues (and
// their :index and the back-pointers on competition records) in step with
// what organisers enter. Production runs the backfills once over every
// competition, then the triggers on every Manage edit, so: the backfill must
// be repeatable and agree with the triggers, and the triggers must end up
// consistent however their events arrive.

const DANCERS = 'competitions:data/{competitionId}/dancers/{dancerId}'
const STAFF = 'competitions:data/{competitionId}/staff/{staffId}'
const COMPETITION = 'competitions/{competitionId}'
const PUBLISHED = 'competitions/{competitionId}/published'

/** Database values: untyped JSON. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any
type Obj = Record<string, Json>

function setup() {
  const rtdb = new FakeRtdb()
  rtdb.patterns = [DANCERS, STAFF, COMPETITION, PUBLISHED]
  const db = rtdb.ref()
  const dancers = createAggregator(db, dancerAggregator)
  const judges = createAggregator(db, staffAggregator({ staffType: 'Judge', namespace: 'judges', backPointerField: 'judgeId' }))
  const pipers = createAggregator(db, staffAggregator({ staffType: 'Piper', namespace: 'pipers', backPointerField: 'piperId' }))
  const venues = createAggregator(db, venueAggregator)

  const shown = (c: Json) => c?.listed === true || c?.published === true

  /** Deliver one trigger event, as index.ts wires them. */
  async function deliver(e: TriggerEvent) {
    const { competitionId } = e.params
    if (e.pattern === PUBLISHED) {
      await dancers.syncCompetition(competitionId)
      return
    }
    const handlers = e.pattern === DANCERS ? [dancers] : e.pattern === STAFF ? [judges, pipers] : [venues]
    const ctx = { params: e.params }
    const at = (v: unknown) => ({ ...snap(v), ref: rtdb.ref(e.path) })
    for (const h of handlers) {
      if (e.before === null) await h.onCreate(at(e.after), ctx)
      else if (e.after === null) await h.onDelete(at(e.before), ctx)
      else await h.onUpdate({ before: at(e.before), after: at(e.after) }, ctx)
    }
    // Listing, unlisting or deleting a competition re-links its judges and pipers.
    if (e.pattern === COMPETITION && shown(e.before) !== shown(e.after)) {
      await judges.syncCompetition(competitionId)
      await pipers.syncCompetition(competitionId)
    }
  }

  /** Run queued trigger events (and the ones they cause) one at a time. */
  async function drain(limit = 2000) {
    let n = 0
    while (rtdb.events.length) {
      n += 1
      if (n > limit) throw new Error('trigger loop')
      await deliver(rtdb.events.shift()!)
    }
    return n
  }

  /** Run every queued event at once (separate function instances), round after round. */
  async function drainTogether(limit = 50) {
    for (let round = 0; rtdb.events.length; round += 1) {
      if (round > limit) throw new Error('trigger loop')
      const batch = rtdb.events.splice(0)
      await Promise.all(batch.map(deliver))
    }
  }

  const write = (updates: Obj) => rtdb.write(updates)
  const read = (path: string) => rtdb.read(path) as Json
  return { rtdb, db, dancers, judges, pipers, venues, deliver, drain, drainTogether, write, read }
}

type Setup = ReturnType<typeof setup>

/**
 * Everything that must hold once the triggers have settled: each record that
 * should be linked points at the aggregate its name is indexed to, which
 * holds exactly its current appearance; nothing else is linked or indexed.
 */
function problems({ read }: Setup): string[] {
  const out: string[] = []
  const competitions = (read('competitions') ?? {}) as Obj
  const data = (read('competitions:data') ?? {}) as Obj
  const kinds = [
    { ns: 'dancers', section: 'dancers', field: 'dancerId', config: dancerAggregator as Json },
    { ns: 'judges', section: 'staff', field: 'judgeId', config: staffAggregator({ staffType: 'Judge', namespace: 'judges', backPointerField: 'judgeId' }) as Json },
    { ns: 'pipers', section: 'staff', field: 'piperId', config: staffAggregator({ staffType: 'Piper', namespace: 'pipers', backPointerField: 'piperId' }) as Json },
    { ns: 'venues', section: null, field: 'venueId', config: venueAggregator as Json },
  ]
  for (const { ns, section, field, config } of kinds) {
    const aggs = (read(ns) ?? {}) as Obj
    const index = (read(`${ns}:index`) ?? {}) as Obj
    const keyOf = (r: Obj) => (config.identityKey ? config.identityKey(r) : normalizeName(config.nameOf(r)))
    const expected = new Map<string, { key: string; app: Obj }>() // appearance key → …
    const records: Array<{ path: string; rec: Obj; ctx: { competitionId: string; recordId: string | null } }> = []
    for (const [competitionId, comp] of Object.entries(competitions)) {
      if (section === null) records.push({ path: `competitions/${competitionId}`, rec: comp, ctx: { competitionId, recordId: null } })
      else {
        for (const [recordId, rec] of Object.entries((data[competitionId]?.[section] ?? {}) as Obj)) {
          records.push({ path: `competitions:data/${competitionId}/${section}/${recordId}`, rec, ctx: { competitionId, recordId } })
        }
      }
    }
    for (const { path, rec, ctx } of records) {
      const shown = !config.shownIn || config.shownIn(competitions[ctx.competitionId] ?? {})
      const key = rec && typeof rec === 'object' && config.predicate(rec) && config.nameOf(rec) ? keyOf(rec) : ''
      const pointer = rec?.[field] ?? null
      if (!shown || !key) {
        if (pointer) out.push(`${path} should have no ${field}`)
        continue
      }
      const holder = index[key]?.id
      if (!holder) out.push(`${ns}:index/${key} missing for ${path}`)
      else if (pointer !== holder) out.push(`${path} ${field} ${pointer} should be ${holder}`)
      const appKey = ctx.recordId === null ? ctx.competitionId : `${ctx.competitionId}:${ctx.recordId}`
      // As stored: RTDB keeps no nulls.
      expected.set(appKey, { key, app: JSON.parse(JSON.stringify(config.toAppearance(rec, ctx), (_k, v) => (v === null ? undefined : v))) })
    }
    for (const [id, agg] of Object.entries(aggs)) {
      const apps = (agg.appearances ?? {}) as Obj
      const n = Object.keys(apps).length
      if (!n) out.push(`${ns}/${id} is empty`)
      if (agg.appearanceCount !== n) out.push(`${ns}/${id} appearanceCount ${agg.appearanceCount}, has ${n}`)
      if (index[agg._identity]?.id !== id) out.push(`${ns}/${id} (${agg._identity}) isn't the one indexed`)
      for (const [appKey, app] of Object.entries(apps)) {
        const want = expected.get(appKey)
        if (!want) out.push(`${ns}/${id} has a stale appearance ${appKey}`)
        else if (want.key !== agg._identity) out.push(`${ns}/${id} (${agg._identity}) holds ${appKey} named ${want.key}`)
        else if (JSON.stringify(app) !== JSON.stringify(want.app)) out.push(`${ns}/${id} appearance ${appKey} is out of date`)
        expected.delete(appKey)
      }
    }
    for (const appKey of expected.keys()) out.push(`${ns}: ${appKey} isn't linked`)
    for (const [key, entry] of Object.entries(index)) {
      const agg = aggs[entry.id]
      if (!agg) out.push(`${ns}:index/${key} points at a missing aggregate`)
      else if (entry.appearanceCount !== agg.appearanceCount || entry.name !== agg.name) out.push(`${ns}:index/${key} is out of date`)
    }
  }
  return out
}

const comp = (published: boolean, extra: Obj = {}) => ({ name: 'Highland Games', date: '2026-07-04', published, listed: true, ...extra })
const dancer = (firstName: string, lastName: string, number = '101', extra: Obj = {}) => ({ firstName, lastName, number, groupId: 'g1', ...extra })

/** A published competition with a few dancers and staff, already settled. */
async function seeded() {
  const s = setup()
  s.write({
    'competitions/c1': comp(true, { venue: 'Spruce Meadows', locality: 'Calgary', date: '2026-07-04' }),
    'competitions:data/c1': {
      dancers: { d1: dancer('Isla', 'MacDonald', '101'), d2: dancer('Eilidh', 'Grant', '102'), d3: dancer('Isla', 'MacDonald', '101', { groupId: 'g2' }) },
      staff: {
        s1: { type: 'Judge', firstName: 'Aileen', lastName: 'Robertson' },
        s2: { type: 'Piper', firstName: 'Alasdair', lastName: 'Gillies' },
        s3: { type: 'Sponsor', firstName: 'Calgary Highland', lastName: 'Society' },
      },
    },
  })
  await s.drain()
  return s
}

describe('triggers', () => {
  it('link a new competition’s dancers, judges, pipers and venue', async () => {
    const s = await seeded()
    expect(problems(s)).toEqual([])
    // The same person in two age groups is one dancer with two entries.
    const isla = s.read('dancers:index/isla macdonald')
    expect(isla).toMatchObject({ name: 'Isla MacDonald', appearanceCount: 2 })
    expect(s.read('competitions:data/c1/dancers/d1/dancerId')).toBe(isla.id)
    expect(s.read('competitions:data/c1/dancers/d3/dancerId')).toBe(isla.id)
    expect(s.read('competitions:data/c1/staff/s1/judgeId')).toBeTruthy()
    expect(s.read('competitions:data/c1/staff/s2/piperId')).toBeTruthy()
    expect(s.read('competitions:data/c1/staff/s3')).toEqual({ type: 'Sponsor', firstName: 'Calgary Highland', lastName: 'Society' })
    expect(s.read('venues:index/spruce meadows|calgary')).toMatchObject({ name: 'Spruce Meadows', appearanceCount: 1 })
  })

  it('ignore a back-pointer that isn’t an id, so one organiser can’t reach another person’s profile', async () => {
    const s = await seeded()
    const isla = s.read('dancers:index/isla macdonald').id
    const before = s.read(`dancers/${isla}/appearances`)
    expect(Object.keys(before ?? {}).length).toBeGreaterThan(0)
    // An organiser writes only to their own record, but aims it elsewhere.
    s.write({ 'competitions:data/c1/dancers/d2/dancerId': `${isla}/appearances` })
    await s.drain()
    expect(s.read(`dancers/${isla}/appearances`)).toEqual(before)
    expect(problems(s)).toEqual([])
  })

  it('make one aggregate when the same new person arrives in several records at once (an import)', async () => {
    const s = setup()
    s.write({ 'competitions/c1': comp(true) })
    await s.drain()
    s.write({
      'competitions:data/c1/dancers': {
        a: dancer('Skye', 'Morrison', '7', { groupId: 'g1' }),
        b: dancer('Skye', 'Morrison', '7', { groupId: 'g2' }),
        c: dancer('  SKYE ', ' morrison', '7', { groupId: 'g3' }),
      },
    })
    await s.drainTogether()
    expect(Object.keys(s.read('dancers'))).toHaveLength(1)
    expect(problems(s)).toEqual([])
  })

  it('move a renamed dancer, and remove the old name when nobody else has it', async () => {
    const s = await seeded()
    const old = s.read('dancers:index/eilidh grant').id
    s.write({ 'competitions:data/c1/dancers/d2/lastName': 'Grantt' })
    await s.drain()
    expect(s.read(`dancers/${old}`)).toBeNull()
    expect(s.read('dancers:index/eilidh grant')).toBeNull()
    expect(s.read('dancers:index/eilidh grantt')).toMatchObject({ appearanceCount: 1 })
    expect(problems(s)).toEqual([])
  })

  it('settle the same however two quick edits’ events arrive', async () => {
    for (const order of ['in order', 'reversed', 'together'] as const) {
      const s = setup()
      s.write({ 'competitions/c1': comp(true) })
      await s.drain()
      // Quick-add a dancer, then fill in the last name a moment later.
      s.write({ 'competitions:data/c1/dancers/d9': dancer('Emma', '', '9') })
      s.write({ 'competitions:data/c1/dancers/d9/lastName': 'Smith' })
      const events = s.rtdb.events.splice(0)
      if (order === 'reversed') events.reverse()
      if (order === 'together') await Promise.all(events.map(s.deliver))
      else for (const e of events) await s.deliver(e)
      await s.drainTogether()
      expect(problems(s), order).toEqual([])
      expect(s.read('dancers:index/emma'), order).toBeNull()
    }
  })

  it('don’t bring back a record deleted before its back-pointer was written (Undo straight after Add)', async () => {
    const s = setup()
    s.write({ 'competitions/c1': comp(true) })
    await s.drain()
    s.write({ 'competitions:data/c1/dancers/d5': dancer('Fiona', 'Reid', '55') })
    const [created] = s.rtdb.events.splice(0)
    const linking = s.deliver(created)
    s.write({ 'competitions:data/c1/dancers/d5': null })
    await linking
    await s.drain()
    expect(s.read('competitions:data/c1/dancers')).toBeNull()
    expect(s.read('dancers')).toBeNull()
    expect(s.read('dancers:index')).toBeNull()
  })

  it('put back a back-pointer a write dropped', async () => {
    const s = await seeded()
    const { dancerId, ...rest } = s.read('competitions:data/c1/dancers/d2')
    expect(dancerId).toBeTruthy()
    s.write({ 'competitions:data/c1/dancers/d2': { ...rest, location: 'Calgary' } })
    await s.drain()
    expect(s.read('competitions:data/c1/dancers/d2/dancerId')).toBe(dancerId)
    expect(problems(s)).toEqual([])
  })

  it('unlink a renamed or deleted record whose back-pointer was never written', async () => {
    const s = await seeded()
    // As after `backfill()` but before `backfillBackPointers()`.
    s.write({ 'competitions:data/c1/dancers/d2/dancerId': null, 'competitions:data/c1/staff/s1/judgeId': null })
    s.rtdb.events.length = 0
    s.write({ 'competitions:data/c1/dancers/d2/firstName': 'Eilish' })
    s.write({ 'competitions:data/c1/staff/s1': null })
    await s.drain()
    expect(s.read('dancers:index/eilidh grant')).toBeNull()
    expect(s.read('judges')).toBeNull()
    expect(problems(s)).toEqual([])
  })

  it('unlink a judge who becomes a sponsor, and move one who becomes a piper', async () => {
    const s = await seeded()
    s.write({ 'competitions:data/c1/staff/s1/type': 'Piper' })
    await s.drain()
    expect(s.read('judges')).toBeNull()
    expect(s.read('competitions:data/c1/staff/s1/judgeId')).toBeNull()
    expect(s.read('pipers:index/aileen robertson')).toMatchObject({ appearanceCount: 1 })
    s.write({ 'competitions:data/c1/staff/s1/type': 'Sponsor' })
    await s.drain()
    expect(s.read('pipers:index/aileen robertson')).toBeNull()
    expect(problems(s)).toEqual([])
  })

  it('unlink a dancer whose name is cleared', async () => {
    const s = await seeded()
    s.write({ 'competitions:data/c1/dancers/d2/firstName': null, 'competitions:data/c1/dancers/d2/lastName': '' })
    await s.drain()
    expect(s.read('dancers:index/eilidh grant')).toBeNull()
    expect(s.read('competitions:data/c1/dancers/d2')).toEqual({ lastName: '', number: '102', groupId: 'g1' })
    expect(problems(s)).toEqual([])
  })

  it('follow the venue as an organiser picks, renames and clears it', async () => {
    const s = await seeded()
    const first = s.read('competitions/c1/venueId')
    s.write({ 'competitions/c1/locality': 'Okotoks', 'competitions/c1/lat': 50.7, 'competitions/c1/lng': -113.9 })
    await s.drain()
    expect(s.read(`venues/${first}`)).toBeNull()
    expect(s.read('venues:index/spruce meadows|okotoks')).toMatchObject({ appearanceCount: 1 })
    s.write({ 'competitions/c1/venue': null })
    await s.drain()
    expect(s.read('venues')).toBeNull()
    expect(s.read('competitions/c1/venueId')).toBeNull()
    expect(problems(s)).toEqual([])
  })

  it('clean everything up when a competition is deleted', async () => {
    const s = await seeded()
    s.write({ 'competitions/c1': null, 'competitions:data/c1': null })
    await s.drain()
    for (const ns of ['dancers', 'judges', 'pipers', 'venues']) {
      expect(s.read(ns), ns).toBeNull()
      expect(s.read(`${ns}:index`), ns).toBeNull()
    }
  })

  it('keep the other competitions’ appearances when one competition goes', async () => {
    const s = await seeded()
    s.write({
      'competitions/c2': comp(true, { venue: 'Spruce Meadows', locality: 'Calgary', date: '2027-07-03' }),
      'competitions:data/c2/dancers/e1': dancer('Isla', 'MacDonald', '33'),
    })
    await s.drain()
    expect(s.read('dancers:index/isla macdonald')).toMatchObject({ appearanceCount: 3 })
    s.write({ 'competitions/c1': null, 'competitions:data/c1': null })
    await s.drain()
    expect(s.read('dancers:index/isla macdonald')).toMatchObject({ appearanceCount: 1 })
    expect(s.read('venues:index/spruce meadows|calgary')).toMatchObject({ appearanceCount: 1 })
    expect(problems(s)).toEqual([])
  })

  it('do no aggregate work for writes it doesn’t show (back-pointers, age groups)', async () => {
    const s = await seeded()
    s.write({ 'competitions:data/c1/dancers/d2/groupId': 'g9' })
    s.write({ 'competitions:data/c1/staff/s1/_order': 3 })
    const writes = s.rtdb.writes
    expect(await s.drain()).toBe(2)
    expect(s.rtdb.writes).toBe(writes)
  })

  it('retry when a write from the same process (e.g. a backfill) cancels a transaction', async () => {
    const s = await seeded()
    s.write({ 'competitions:data/c1/dancers/d2/location': 'Edmonton' })
    const [edit] = s.rtdb.events.splice(0)
    const id = s.read('dancers:index/eilidh grant').id
    let cancelled = 0
    s.rtdb.duringTransaction = (path) => {
      if (path !== `dancers/${id}` || cancelled) return
      cancelled += 1
      s.rtdb.plainWrites.push([`dancers/${id}/name`]) // e.g. a backfill batch landing now
    }
    await s.deliver(edit)
    await s.drain()
    expect(cancelled).toBe(1)
    expect(s.read(`dancers/${id}/location`)).toBe('Edmonton')
    expect(problems(s)).toEqual([])
  })

  it('heal a duplicate aggregate left by an old race, without unindexing the real one', async () => {
    const s = await seeded()
    const real = s.read('dancers:index/eilidh grant').id
    // An orphan holding d2's appearance, which points at it.
    s.write({
      'dancers/-orphan': { name: 'Eilidh Grant', _identity: 'eilidh grant', appearanceCount: 1, appearances: { 'c1:d2': s.read(`dancers/${real}/appearances/c1:d2`) } },
      [`dancers/${real}/appearances/c1:d2`]: null,
      'competitions:data/c1/dancers/d2/dancerId': '-orphan',
    })
    s.rtdb.events.length = 0
    s.write({ 'competitions:data/c1/dancers/d2/location': 'Edmonton' })
    await s.drain()
    expect(s.read('dancers/-orphan')).toBeNull()
    expect(s.read('dancers:index/eilidh grant').id).toBe(real)
    expect(problems(s)).toEqual([])
  })
})

describe('listing and publishing', () => {
  const entries = {
    dancers: { d1: dancer('Isla', 'MacDonald') },
    staff: { s1: { type: 'Judge', firstName: 'Aileen', lastName: 'Robertson' }, s2: { type: 'Piper', firstName: 'Alasdair', lastName: 'Gillies' } },
  }

  it('shows nothing of a private competition', async () => {
    const s = setup()
    s.write({ 'competitions/c1': comp(false, { listed: false, venue: 'Spruce Meadows' }), 'competitions:data/c1': entries })
    await s.drain()
    for (const ns of ['dancers', 'judges', 'pipers', 'venues']) expect(s.read(ns), ns).toBeNull()
    expect(s.read('competitions:data/c1')).toEqual(entries)
    expect(s.read('competitions/c1/venueId')).toBeNull()
    expect(problems(s)).toEqual([])
  })

  it('shows a listed competition’s venue, judges and pipers, but not its dancers', async () => {
    const s = setup()
    s.write({ 'competitions/c1': comp(false, { listed: true, venue: 'Spruce Meadows' }), 'competitions:data/c1': entries })
    await s.drain()
    expect(s.read('dancers')).toBeNull()
    expect(s.read('competitions:data/c1/dancers/d1/dancerId')).toBeNull()
    expect(s.read('judges:index/aileen robertson')).toBeTruthy()
    expect(s.read('pipers:index/alasdair gillies')).toBeTruthy()
    expect(s.read('venues:index/spruce meadows|none')).toBeTruthy()
    expect(problems(s)).toEqual([])
  })

  it('follows a competition from private to listed to published and back', async () => {
    const s = setup()
    s.write({ 'competitions/c1': comp(false, { listed: false, venue: 'Spruce Meadows' }), 'competitions:data/c1': entries })
    await s.drain()
    s.write({ 'competitions/c1/listed': true })
    await s.drain()
    expect(problems(s)).toEqual([])
    expect(s.read('judges:index/aileen robertson')).toBeTruthy()
    s.write({ 'competitions/c1/published': true })
    await s.drain()
    expect(problems(s)).toEqual([])
    expect(s.read('dancers:index/isla macdonald')).toBeTruthy()
    // Manage's "Unlist" switch writes both.
    s.write({ 'competitions/c1/listed': false, 'competitions/c1/published': false })
    await s.drain()
    for (const ns of ['dancers', 'judges', 'pipers', 'venues']) expect(s.read(ns), ns).toBeNull()
    expect(problems(s)).toEqual([])
  })

  it('links the dancers on publish and unlinks them on unpublish', async () => {
    const s = setup()
    s.write({
      'competitions/c1': comp(false),
      'competitions:data/c1/dancers': Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`d${i}`, dancer(`Dancer${i % 20}`, 'Test', String(i))])),
    })
    await s.drain()
    s.write({ 'competitions/c1/published': true })
    await s.drain()
    expect(Object.keys(s.read('dancers'))).toHaveLength(20)
    expect(problems(s)).toEqual([])
    s.write({ 'competitions/c1/published': false })
    await s.drain()
    expect(s.read('dancers')).toBeNull()
    expect(problems(s)).toEqual([])
  })

  it('links a dancer renamed while the publish sync runs under the new name, never the old', async () => {
    const s = setup()
    s.write({ 'competitions/c1': comp(false), 'competitions:data/c1/dancers/d1': dancer('Isla', 'MacDonald') })
    await s.drain()
    // The sync lists the records, then d1 is renamed before it gets to it.
    const listedEarlier = createAggregator(s.db, { ...dancerAggregator, iterate: async () => [['d1', dancer('Isla', 'MacDonald')]] })
    s.write({ 'competitions/c1/published': true, 'competitions:data/c1/dancers/d1/firstName': 'Wren' })
    await listedEarlier.syncCompetition('c1')
    // Not even for a moment under the old name (a follow made then would go astray).
    expect(s.read('dancers:index/isla macdonald')).toBeNull()
    expect(s.read('competitions:data/c1/dancers/d1/dancerId')).toBe(s.read('dancers:index/wren macdonald')?.id)
    await s.drain()
    expect(problems(s)).toEqual([])
  })

  it('gives dancers back the same ids when a competition is published again, so follows survive', async () => {
    const s = await seeded()
    const before = { isla: s.read('dancers:index/isla macdonald').id, eilidh: s.read('dancers:index/eilidh grant').id }
    s.write({ 'competitions/c1/published': false })
    await s.drain()
    expect(s.read('dancers')).toBeNull()
    // Kept privately (no public read in the rules), by name.
    expect(s.read('dancers:retired/isla macdonald')).toBe(before.isla)
    s.write({ 'competitions/c1/published': true })
    await s.drain()
    expect(s.read('dancers:index/isla macdonald').id).toBe(before.isla)
    expect(s.read('dancers:index/eilidh grant').id).toBe(before.eilidh)
    expect(s.read('dancers:retired')).toBeNull()
    expect(problems(s)).toEqual([])
  })

  it('gives a dancer back the same id when they’re deleted and imported again', async () => {
    const s = await seeded()
    const id = s.read('dancers:index/eilidh grant').id
    s.write({ 'competitions:data/c1/dancers/d2': null })
    await s.drain()
    s.write({ 'competitions:data/c1/dancers/new': dancer('Eilidh', 'Grant', '102') })
    await s.drain()
    expect(s.read('dancers:index/eilidh grant').id).toBe(id)
    expect(s.read('competitions:data/c1/dancers/new/dancerId')).toBe(id)
    expect(problems(s)).toEqual([])
  })

  it('ends up right when publish and unpublish overlap', async () => {
    const s = setup()
    s.write({ 'competitions/c1': comp(false), 'competitions:data/c1/dancers': { d1: dancer('Isla', 'MacDonald'), d2: dancer('Eilidh', 'Grant') } })
    await s.drain()
    s.write({ 'competitions/c1/published': true })
    s.write({ 'competitions/c1/published': false })
    s.write({ 'competitions/c1/published': true })
    await s.drainTogether()
    expect(problems(s)).toEqual([])
    expect(s.read('dancers:index/eilidh grant')).toBeTruthy()
  })
})

describe('backfill', () => {
  /** Legacy-shaped data, as production has it: no aggregates, no back-pointers. */
  function legacy() {
    const s = setup()
    s.rtdb.data = {
      competitions: {
        c1: comp(true, { venue: 'Telus Convention Centre', locality: 'Calgary', date: '2019-01-14' }),
        c2: comp(true, { venue: 'TELUS Convention Centre', locality: 'Calgary', date: '2018-07-02T06:00:00.000Z' }),
        c3: comp(true, { venue: 'Telus Convention Centre', location: 'Calgary City, QLD', date: '2019-01-22' }),
        c4: comp(false, { venue: 'Sheraton Ottawa Hotel', locality: 'Ottawa' }),
        c5: { name: 'No date, no venue', published: true },
        c6: { name: 'A draft', venue: 'Draft Hall', listed: false, published: false },
      },
      'competitions:data': {
        c1: {
          dancers: {
            a: { firstName: 'Lily', lastName: 'Kate Williams', number: '235', location: 'BC' },
            b: { firstName: 'Teagan', lastName: 'O’Neil', number: 12 },
            c: { firstName: 'Zoë', lastName: 'Lawrence', number: '7' },
            nameless: { number: '99' },
            odd: { firstName: 32333, lastName: '', number: '1' },
          },
          staff: {
            j: { type: 'Judge', firstName: 'Sandra', lastName: 'Weyman' },
            p: { type: 'Piper', firstName: 'Glenn', lastName: 'Eberth' },
            notype: { firstName: 'Who', lastName: 'Knows' },
          },
        },
        c2: {
          dancers: {
            a: { firstName: 'Lily Kate', lastName: 'Williams', number: '301', location: 'Alberta' },
            b: { firstName: 'Teagan', lastName: "O'Neil", number: '13' },
          },
          staff: { j: { type: 'Judge', firstName: ' sandra ', lastName: 'WEYMAN ' } },
        },
        c3: { dancers: { a: { firstName: 'Lily', lastName: 'Kate Williams', number: '8' } } },
        c4: { dancers: { a: { firstName: 'Secret', lastName: 'Entry', number: '1' } } },
        c6: { dancers: { a: { firstName: 'Draft', lastName: 'Dancer' } }, staff: { j: { type: 'Judge', firstName: 'Draft', lastName: 'Judge' } } },
        // A deleted competition's data that was never cleaned up.
        gone: { dancers: { a: { firstName: 'Ghost', lastName: 'Dancer' } } },
      },
    }
    return s
  }

  async function backfillAll(s: Setup) {
    const out = []
    for (const agg of [s.dancers, s.judges, s.pipers, s.venues]) out.push(await agg.backfill())
    for (const agg of [s.dancers, s.judges, s.pipers, s.venues]) out.push(await agg.backfillBackPointers())
    await s.drain()
    return out
  }

  it('builds the same aggregates the triggers keep, from legacy-shaped data', async () => {
    const s = legacy()
    const [dancers] = await backfillAll(s)
    expect(dancers).toEqual({ linked: 7, skipped: 3, pruned: 0, competitions: 6 })
    expect(problems(s)).toEqual([])
    // One person whatever the case, spacing, apostrophe or name split…
    expect(s.read('dancers:index/lily kate williams')).toMatchObject({ appearanceCount: 3 })
    expect(s.read('dancers:index/teagan o neil')).toMatchObject({ appearanceCount: 2 })
    expect(s.read('judges:index/sandra weyman')).toMatchObject({ appearanceCount: 2 })
    // …whose name comes from one entry, not half of each.
    expect(['Lily Kate Williams']).toContain(s.read('dancers:index/lily kate williams').name)
    // No dancers from unpublished or deleted competitions, nothing at all from private ones.
    expect(s.read('dancers:index/secret entry')).toBeNull()
    expect(s.read('dancers:index/ghost dancer')).toBeNull()
    expect(s.read('judges:index/draft judge')).toBeNull()
    expect(s.read('venues:index/draft hall|none')).toBeNull()
    expect(s.read('venues:index/sheraton ottawa hotel|ottawa')).toBeTruthy() // listed
    // Venues key on name and town: no town is its own venue.
    expect(s.read('venues:index/telus convention centre|calgary')).toMatchObject({ appearanceCount: 2 })
    expect(s.read('venues:index/telus convention centre|none')).toMatchObject({ appearanceCount: 1 })
    // Legacy string dates still order venue appearances.
    const telus = s.read(`venues/${s.read('venues:index/telus convention centre|calgary').id}`)
    expect(Object.values(telus.appearances as Obj).map((a) => a.date)).toEqual([Date.parse('2019-01-14'), Date.parse('2018-07-02T06:00:00.000Z')])
  })

  it('changes nothing when run again, and keeps every aggregate id', async () => {
    const s = legacy()
    await backfillAll(s)
    const before = JSON.stringify(s.rtdb.data)
    const again = await backfillAll(s)
    expect(JSON.stringify(s.rtdb.data)).toBe(before)
    expect(again.slice(4).map((r: Obj) => r.written)).toEqual([0, 0, 0, 0])
  })

  it('agrees with what the triggers built', async () => {
    const s = await seeded()
    s.write({ 'competitions:data/c1/dancers/d2/lastName': 'Grantt', 'competitions/c1/locality': 'Okotoks' })
    await s.drain()
    const before = JSON.stringify(s.rtdb.data)
    for (const agg of [s.dancers, s.judges, s.pipers, s.venues]) await agg.backfill()
    expect(JSON.stringify(s.rtdb.data)).toBe(before)
  })

  it('keeps a pruned aggregate’s id for when its person comes back', async () => {
    const s = legacy()
    await backfillAll(s)
    const id = s.read('dancers:index/zoe lawrence').id
    s.write({ 'competitions:data/c1/dancers/c': null })
    s.rtdb.events.length = 0 // as if the trigger never ran: the backfill prunes it
    await s.dancers.backfill()
    expect(s.read(`dancers/${id}`)).toBeNull()
    expect(s.read('dancers:retired/zoe lawrence')).toBe(id)
    s.write({ 'competitions:data/c2/dancers/z': { firstName: 'Zoë', lastName: 'Lawrence', number: '5' } })
    await s.drain()
    expect(s.read('dancers:index/zoe lawrence').id).toBe(id)
    expect(problems(s)).toEqual([])
  })

  it('repairs partial and stale state: lost index entries, orphans, stale pointers', async () => {
    const s = legacy()
    await backfillAll(s)
    const lily = s.read('dancers:index/lily kate williams').id
    s.write({
      'dancers:index/lily kate williams': null, // lost: the aggregate keeps its id via _identity
      'dancers/-stale': { name: 'Old Name', _identity: 'old name', appearanceCount: 1, appearances: { 'c1:zzz': { competitionId: 'c1' } } },
      'dancers:index/old name': { id: '-stale', name: 'Old Name', appearanceCount: 1 },
      'competitions:data/c4/dancers/a/dancerId': '-stale', // unpublished: must lose it
    })
    s.rtdb.events.length = 0
    await backfillAll(s)
    expect(s.read('dancers:index/lily kate williams').id).toBe(lily)
    expect(s.read('dancers/-stale')).toBeNull()
    expect(s.read('dancers:index/old name')).toBeNull()
    expect(s.read('competitions:data/c4/dancers/a/dancerId')).toBeNull()
    expect(problems(s)).toEqual([])
  })

  it('writes in batches rather than a round trip per record', async () => {
    const s = setup()
    const dancers: Obj = {}
    for (let i = 0; i < 3000; i += 1) dancers[`d${i}`] = dancer(`First${i % 1200}`, 'Last', String(i))
    s.rtdb.data = { competitions: { c1: comp(true) }, 'competitions:data': { c1: { dancers } } }
    const result = await s.dancers.backfill()
    expect(result.linked).toBe(3000)
    expect(s.rtdb.writes).toBeLessThan(15)
    expect(Object.keys(s.read('dancers'))).toHaveLength(1200)
  })
})

describe('names', () => {
  it('builds a person’s display name from one entry', () => {
    const apps = [
      { firstName: 'Emma Smith', lastName: null, image: null, location: null },
      { firstName: 'Emma', lastName: 'Smith', image: null, location: 'Calgary' },
    ]
    const shown = dancerAggregator.recomputeFromAppearances!(apps as Json)
    expect(shown).toEqual({ name: 'Emma Smith', image: null, location: 'Calgary' })
  })

  it('reads numbers where text should be without crashing', () => {
    expect(personName({ firstName: 32333, lastName: undefined })).toBe('32333')
    expect(personName({ firstName: { odd: true }, lastName: 'Ross' })).toBe('Ross')
    expect(normalizeName(undefined as unknown as string)).toBe('')
  })
})
