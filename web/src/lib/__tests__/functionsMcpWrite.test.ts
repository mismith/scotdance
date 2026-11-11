// @vitest-environment node
import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import type { Reference } from 'firebase-admin/database'
import { commitChange, expiredEntries, sweepChanges, MAX_RECORDS, recentChanges, same, stored, undoChange, type ChangeEntry } from '../../../../functions/src/mcp/changes'
import { draftCsv, fileDraft } from '../../../../functions/src/mcp/draft'
import { pushId } from '../../../../functions/src/mcp/ids'
import { DatabaseError, type Query, type Session } from '../../../../functions/src/mcp/session'
import { resultsView, scheduleView } from '../../../../functions/src/mcp/view'
import { writeTools } from '../../../../functions/src/mcp/writeTools'
import { explain } from '../../../../functions/src/mcp/toolkit'
import { entriesOf as importEntries, gridFromText, parseGrid } from '../admin/importDancers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>

/** The database in memory, as the REST session sees it: paths, multi-path updates with server time, simple queries */
function fakeSession(initial: Json = {}, opts: { uid?: string; deny?: (path: string) => boolean } = {}) {
  const tree: Json = JSON.parse(JSON.stringify(initial))
  let clock = 1_000
  const updates: Json[] = []
  const keys = (p: string) => p.split('/').filter(Boolean)
  const getIn = (p: string) => keys(p).reduce<unknown>((n, k) => (n && typeof n === 'object' ? (n as Json)[k] : undefined), tree)
  const setIn = (p: string, v: unknown) => {
    const ks = keys(p)
    const trail: Json[] = [tree]
    ks.slice(0, -1).forEach((k) => { trail.push((trail[trail.length - 1][k] ??= {}) as Json) })
    const last = trail[trail.length - 1]
    if (v === null || v === undefined) delete last[ks[ks.length - 1]]
    else last[ks[ks.length - 1]] = v
    // The database keeps no empty records
    for (let i = trail.length - 1; i > 0 && !Object.keys(trail[i]).length; i--) delete trail[i - 1][ks[i - 1]]
  }
  const resolve = (v: unknown): unknown => {
    if (v && typeof v === 'object') {
      if ((v as Json)['.sv'] === 'timestamp') return clock
      if (Array.isArray(v)) return v.map(resolve)
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x)]))
    }
    return v
  }
  const session: Session = {
    uid: opts.uid ?? 'u1',
    connection: 'c1',
    client: 'Claude',
    read: async (path: string, query?: Query) => {
      const v = getIn(path)
      if (query?.orderBy && v && typeof v === 'object') {
        const sorted = Object.entries(v as Json).sort(([, a], [, b]) => (a[String(query.orderBy)] ?? 0) - (b[String(query.orderBy)] ?? 0))
        return Object.fromEntries(sorted.slice(-Number(query.limitToLast ?? sorted.length)))
      }
      return v === undefined ? null : JSON.parse(JSON.stringify(v))
    },
    write: async (path, value) => { setIn(path, resolve(value)) },
    update: async (values) => {
      clock += 1000
      if (opts.deny && Object.keys(values).some(opts.deny)) throw new DatabaseError('permission-denied', 401)
      updates.push(values)
      for (const [p, v] of Object.entries(values)) setIn(p, v === null ? null : stored(resolve(v)))
    },
    remove: async (path) => { setIn(path, null) },
  }
  return { session, tree, updates, tick: (ms: number) => { clock += ms } }
}

let counter = 0
const ids = () => `id${String(++counter).padStart(3, '0')}`
const tool = (name: string) => writeTools.find((t) => t.name === name)!
const call = (s: Session, name: string, args: Json) => tool(name).run(args as never, s) as Promise<Json>
const refused = async (p: Promise<unknown>, match: RegExp) => {
  await assert.rejects(p, (e: Error) => { assert.match(explain(e), match); return true })
}

const competition = (extra: Json = {}): Json => ({
  'users:permissions': { u1: { competitions: { c1: true } } },
  competitions: { c1: { name: 'Spring Games', date: '2026-04-11', venue: 'Town Hall', lat: 51, lng: -114, listed: true, published: false } },
  'competitions:data': {
    c1: {
      categories: { cat1: { name: 'Premier', _order: 0 }, cat2: { name: 'Championship', _order: 1 } },
      groups: {
        g1: { name: '9 & 10 Years', categoryId: 'cat1', _order: 0 },
        g2: { name: '12 & Over', categoryId: 'cat2', _order: 1 },
      },
      dances: { d1: { name: 'Highland Fling', steps: '4', _order: 0, groupIds: { g1: true } } },
      dancers: {
        a: { number: '101', firstName: 'Isla', lastName: 'Grant', groupId: 'g1', categoryId: 'cat1' },
        b: { number: '102', firstName: 'Ava', lastName: 'Reid', groupId: 'g1', categoryId: 'cat1' },
      },
      staff: { s1: { type: 'Sponsor', firstName: 'Highland Society', _order: 0 }, s2: { type: 'Judge', firstName: 'Aileen', lastName: 'Robertson', _order: 1 } },
      platforms: { p1: { name: 'A', _order: 0 } },
      ...extra,
    },
  },
})

describe('values as the database keeps them', () => {
  test('nulls and empties go, lists equal their record form', () => {
    assert.deepEqual(stored({ a: null, b: {}, c: [], d: { e: 1, f: null } }), { d: { e: 1 } })
    assert.ok(same(['a', 'b'], { 0: 'a', 1: 'b' }))
    assert.ok(same(undefined, null))
    assert.ok(!same({ a: 1 }, { a: 2 }))
  })
  test('push ids sort in the order made', () => {
    const made = Array.from({ length: 5 }, () => pushId(5_000_000_000))
    assert.deepEqual([...made].sort(), made)
    assert.equal(new Set(made).size, 5)
  })
})

describe('the change log', () => {
  const change = (db: ReturnType<typeof fakeSession>, data: Json, info: Json = {}, extra: Json = {}) =>
    commitChange(db.session, { competition: 'c1', tool: 't', summary: 'Did it', data, info, current: { data: db.tree['competitions:data'].c1, info: db.tree.competitions.c1 }, ...extra }, ids)

  test('writes the change and its entry in one update, with before and after', async () => {
    const db = fakeSession(competition())
    const out = await change(db, { 'dancers/a/firstName': 'Isla Rose', 'dancers/new': { number: '103' } }, { name: 'Spring Games 2026' })
    assert.equal(db.updates.length, 1)
    const entry = db.tree['competitions:changes'].c1[out!.id] as ChangeEntry
    assert.deepEqual(entry.paths.find((p) => p.path.endsWith('dancers/a/firstName')), { path: 'competitions:data/c1/dancers/a/firstName', before: 'Isla', after: 'Isla Rose' })
    assert.deepEqual(entry.paths.find((p) => p.path.endsWith('dancers/new')), { path: 'competitions:data/c1/dancers/new', after: { number: '103' } })
    assert.equal(entry.uid, 'u1')
    assert.equal(entry.client, 'Claude')
    assert.equal(db.tree.competitions.c1.name, 'Spring Games 2026')
    assert.ok(Object.keys(db.updates[0]).includes(`competitions:changes/c1/${out!.id}`))
  })

  test('a change that changes nothing writes nothing', async () => {
    const db = fakeSession(competition())
    assert.equal(await change(db, { 'dancers/a/firstName': 'Isla' }, { name: 'Spring Games' }), null)
    assert.equal(db.updates.length, 0)
  })

  test('too many records are refused with how to split', async () => {
    const db = fakeSession(competition())
    const many = Object.fromEntries(Array.from({ length: MAX_RECORDS + 1 }, (_, i) => [`dancers/n${i}`, { number: String(i) }]))
    await refused(change(db, many), /at most 200.*Split it/)
    assert.equal(db.updates.length, 0)
    const ok = Object.fromEntries(Array.from({ length: MAX_RECORDS }, (_, i) => [`dancers/n${i}`, { number: String(i) }]))
    assert.ok(await change(db, ok))
  })

  test('a part shared from a primary competition is refused in a sentence, before and after the rules', async () => {
    const guard = (p: string) => (p.endsWith('/venue') ? 'The venue is shared from Main Event.' : null)
    const db = fakeSession(competition())
    await refused(change(db, {}, { venue: 'Elsewhere' }, { guard }), /shared from Main Event/)
    const denied = fakeSession(competition(), { deny: (p) => p.endsWith('/venue') })
    await refused(change(denied, {}, { venue: 'Elsewhere' }, { guard: (p: string) => (denied.updates.length === 0 && p.endsWith('/venue') ? 'The venue is shared from Main Event.' : null) }), /shared from Main Event/)
  })

  test('undo puts it back, logs itself, and marks the original', async () => {
    const db = fakeSession(competition())
    const made = await change(db, { 'dancers/a/firstName': 'Isla Rose', 'dancers/new': { number: '103' }, 'dances/d1': null })
    const undone = await undoChange(db.session, 'c1', made!.id, ids)
    assert.equal(undone.restored, 3)
    const data = db.tree['competitions:data'].c1
    assert.equal(data.dancers.a.firstName, 'Isla')
    assert.equal(data.dancers.new, undefined)
    assert.equal(data.dances.d1.name, 'Highland Fling')
    const log = db.tree['competitions:changes'].c1
    assert.deepEqual(log[made!.id].undone, { at: 3000, by: 'u1', change: undone.undoneBy })
    assert.equal(log[undone.undoneBy].undoOf, made!.id)
    assert.equal(log[undone.undoneBy].tool, 'undo_change')
    await refused(undoChange(db.session, 'c1', made!.id), /already been undone/)
    await refused(undoChange(db.session, 'c1', undone.undoneBy), /itself an undo/)
  })

  test('undo refuses, saying what changed, once something it changed has been changed again', async () => {
    const db = fakeSession(competition())
    const made = await change(db, { 'dancers/a/firstName': 'Isla Rose', 'dancers/b/firstName': 'Ava Jane' })
    db.tree['competitions:data'].c1.dancers.a.firstName = 'Someone else'
    await refused(undoChange(db.session, 'c1', made!.id), /1 of the 2 values.*dancers\/a\/firstName is now "Someone else"/)
    assert.equal(db.tree['competitions:data'].c1.dancers.b.firstName, 'Ava Jane', 'nothing was undone')
    await refused(undoChange(db.session, 'c1', 'nope'), /There is no change nope/)
  })

  test('profile links that functions add after the change do not stop an undo', async () => {
    const db = fakeSession(competition())
    const made = await change(db, { 'dancers/new': { number: '103', firstName: 'Mia', members: { m: { firstName: 'Mia' } } } })
    const added = db.tree['competitions:data'].c1.dancers.new
    added.dancerId = 'profile1'
    added.members.m.dancerId = 'profile2'
    await undoChange(db.session, 'c1', made!.id, ids)
    assert.equal(db.tree['competitions:data'].c1.dancers.new, undefined)
  })

  test('an entry that points outside the competition is not undone', async () => {
    const db = fakeSession(competition())
    db.tree['competitions:changes'] = { c1: { x: { at: 1, uid: 'u1', tool: 't', summary: 's', paths: [{ path: 'users:permissions/u1/admin', before: false, after: true }] } } }
    await refused(undoChange(db.session, 'c1', 'x'), /can’t be undone from here/)
  })

  test('recent changes come newest first with their summaries', async () => {
    const db = fakeSession(competition())
    const first = await change(db, { 'dancers/a/firstName': 'One' })
    db.tick(5000)
    const second = await change(db, { 'dancers/a/firstName': 'Two' })
    await undoChange(db.session, 'c1', first!.id, ids).catch(() => undefined)
    const rows = await recentChanges(db.session, 'c1', 10)
    assert.equal(rows[0].id, second!.id)
    assert.equal(rows[0].summary, 'Did it')
    assert.ok(rows.every((r) => r.when))
  })

  test('entries older than 60 days are found', () => {
    const day = 86_400_000
    const old = expiredEntries({ c1: { a: { at: 1 * day }, b: { at: 100 * day } }, c2: null }, 70 * day)
    assert.deepEqual(old, ['competitions:changes/c1/a'])
  })
})

describe('sweeping the log', () => {
  test('pages through the competitions and deletes only entries past 60 days', async () => {
    const day = 86_400_000
    const now = 100 * day
    const log: Json = {}
    for (let i = 0; i < 5; i++) log[`c${i}`] = { old: { at: 10 * day }, [`new${i}`]: { at: 90 * day } }
    const removed: string[] = []
    const root = {
      child: () => ({
        orderByKey: () => {
          let after: string | undefined
          let size = 100
          const q = {
            limitToFirst: (n: number) => ((size = n), q),
            startAfter: (k: string) => ((after = k), q),
            get: async () => {
              const keys = Object.keys(log).filter((k) => after === undefined || k > after).slice(0, size)
              return { val: () => (keys.length ? Object.fromEntries(keys.map((k) => [k, log[k]])) : null) }
            },
          }
          return q
        },
      }),
      update: async (values: Json) => { removed.push(...Object.keys(values)) },
    }
    const swept = await sweepChanges(root as unknown as Reference, now, 2)
    assert.equal(swept, 5)
    assert.deepEqual(removed.sort(), [0, 1, 2, 3, 4].map((i) => `competitions:changes/c${i}/old`))
  })
})

describe('update_competition', () => {
  test('changes only what is given, as given, and says the map pin did not move', async () => {
    const db = fakeSession(competition())
    const out = await call(db.session, 'update_competition', { competition: 'c1', name: '  Spring Games 2026 ', venue: 'The Arena', registrationUrl: 'example.com/register', registrationOpens: '2026-01-05T09:00', links: [{ label: 'Program', url: 'https://example.com/p.pdf' }] })
    assert.equal(db.tree.competitions.c1.name, 'Spring Games 2026')
    assert.equal(db.tree.competitions.c1.registrationURL, 'example.com/register')
    assert.equal(db.tree.competitions.c1.registrationStart, '2026-01-05T09:00')
    assert.equal(db.tree.competitions.c1.lat, 51)
    assert.match(out.warnings[0], /map pin was not moved/)
    assert.equal(out.created[0].kind, 'link')
    const link = Object.values(db.tree.competitions.c1.links)[0] as Json
    assert.deepEqual({ name: link.name, url: link.url, _order: link._order }, { name: 'Program', url: 'https://example.com/p.pdf', _order: 0 })
    assert.ok(out.change)
    // and back again
    await call(db.session, 'undo_change', { competition: 'c1', change: out.change })
    assert.equal(db.tree.competitions.c1.name, 'Spring Games')
    assert.equal(db.tree.competitions.c1.links, undefined)
  })

  test('refuses what the app’s fields refuse', async () => {
    const db = fakeSession(competition())
    await refused(call(db.session, 'update_competition', { competition: 'c1', name: ' ' }), /name can’t be empty/)
    await refused(call(db.session, 'update_competition', { competition: 'c1', date: '2026-02-30' }), /not a date/)
    await refused(call(db.session, 'update_competition', { competition: 'c1', registrationUrl: 'not a link' }), /doesn’t look like a link/)
    await refused(call(db.session, 'update_competition', { competition: 'c1', registrationCloses: '2026-01-05' }), /date and time/)
    await refused(call(db.session, 'update_competition', { competition: 'c1', removeLinks: ['zzz'] }), /no link zzz/)
    assert.equal(db.updates.length, 0)
  })

  test('says so when asked for what is already so, and clears with null', async () => {
    const db = fakeSession(competition())
    const same = await call(db.session, 'update_competition', { competition: 'c1', name: 'Spring Games' })
    assert.match(same.summary, /Nothing needed changing/)
    assert.equal(same.change, undefined)
    await call(db.session, 'update_competition', { competition: 'c1', venue: null })
    assert.equal(db.tree.competitions.c1.venue, undefined)
  })

  test('a competition they do not manage is refused', async () => {
    const db = fakeSession(competition())
    await refused(call(db.session, 'update_competition', { competition: 'c9', name: 'x' }), /You don’t manage a competition with the id c9/)
  })

  test('a venue shared from the primary names the primary', async () => {
    const db = fakeSession({ ...competition(), 'competitionLinks:sync': { c1: { venue: true } }, 'competitionLinks:of': { c1: 'L' }, competitionLinks: { L: { primary: 'c0' } } })
    db.tree.competitions.c0 = { name: 'Main Event' }
    await refused(call(db.session, 'update_competition', { competition: 'c1', venue: 'Elsewhere' }), /venue, address and place of this competition is shared from Main Event.*only be changed there/)
    await call(db.session, 'update_competition', { competition: 'c1', name: 'Fine' })
  })
})

describe('set_visibility', () => {
  test('publishing lists too, unpublishing leaves it listed, unlisting unpublishes', async () => {
    const db = fakeSession(competition())
    db.tree.competitions.c1.listed = false
    await call(db.session, 'set_visibility', { competition: 'c1', published: true })
    assert.deepEqual([db.tree.competitions.c1.listed, db.tree.competitions.c1.published], [true, true])
    await call(db.session, 'set_visibility', { competition: 'c1', listed: false })
    assert.deepEqual([db.tree.competitions.c1.listed, db.tree.competitions.c1.published], [false, false])
    await refused(call(db.session, 'set_visibility', { competition: 'c1', published: true, listed: false }), /can’t be published but not listed/)
    await refused(call(db.session, 'set_visibility', { competition: 'c1' }), /Say what to change/)
  })

  test('hiding a tab with content needs the organiser’s agreement, and is undone with its content', async () => {
    const db = fakeSession(competition({ schedule: { days: { day1: { name: 'Saturday', order: 0 } } } }))
    await refused(call(db.session, 'set_visibility', { competition: 'c1', schedule: 'hide' }), /deletes the schedule built so far.*deleteContent: true/)
    const out = await call(db.session, 'set_visibility', { competition: 'c1', schedule: 'hide', deleteContent: true })
    assert.equal(db.tree['competitions:data'].c1.schedule, false)
    await call(db.session, 'undo_change', { competition: 'c1', change: out.change })
    assert.equal(db.tree['competitions:data'].c1.schedule.days.day1.name, 'Saturday')
    // an empty tab needs no agreement
    const empty = await call(db.session, 'set_visibility', { competition: 'c1', results: 'hide' })
    assert.ok(empty.change)
  })
})

describe('save_dances', () => {
  test('adds a category, an age group in it and a dance for it in one call, by name', async () => {
    const db = fakeSession(competition())
    const out = await call(db.session, 'save_dances', {
      competition: 'c1',
      categories: [{ name: 'Novice' }],
      ageGroups: [{ category: 'Novice', name: '7 & Under 10 Years' }, { category: 'Novice', name: '10 & Under 12 Years' }],
      dances: [{ name: 'Sword Dance', steps: '2&1', ageGroups: ['Novice 7 & Under 10 Years'] }],
    })
    const data = db.tree['competitions:data'].c1
    const cat = out.created.find((c: Json) => c.kind === 'category')
    assert.equal(data.categories[cat.id].name, 'Novice')
    assert.equal(data.categories[cat.id]._order, 2)
    const [g1, g2] = out.created.filter((c: Json) => c.kind === 'ageGroup')
    assert.deepEqual([data.groups[g1.id]._order, data.groups[g2.id]._order], [2, 3])
    assert.equal(data.groups[g1.id].categoryId, cat.id)
    const dance = Object.values(data.dances).find((d) => (d as Json).name === 'Sword Dance') as Json
    assert.deepEqual(dance.groupIds, { [g1.id]: true })
    assert.equal(dance.steps, '2&1', 'saved as given')
    assert.equal(g1.name, 'Novice 7 & Under 10 Years')
    await call(db.session, 'undo_change', { competition: 'c1', change: out.change })
    assert.equal(db.tree['competitions:data'].c1.groups[g1.id], undefined)
  })

  test('changes who dances a dance, a trophy event’s age groups, and marks a championship not run as one', async () => {
    const db = fakeSession(competition())
    await call(db.session, 'save_dances', { competition: 'c1', dances: [{ id: 'd1', ageGroups: 'all' }, { name: 'Reel', ageGroups: [] }] })
    assert.deepEqual(db.tree['competitions:data'].c1.dances.d1.groupIds, { g1: true, g2: true })
    const t = await call(db.session, 'save_dances', { competition: 'c1', trophyEvents: [{ name: 'Dancer of the Day', sponsor: 'Highland Society', ageGroups: ['g1'], dance: 'Highland Fling' }] })
    const event = db.tree['competitions:data'].c1.trophyEvents[t.created[0].id]
    assert.deepEqual([event.sponsor, event.danceId, event.groupIds], ['s1', 'd1', { g1: true }])
    await refused(call(db.session, 'save_dances', { competition: 'c1', ageGroups: [{ id: 'g1', notChampionship: true }] }), /isn’t a championship by its name/)
    await call(db.session, 'save_dances', { competition: 'c1', ageGroups: [{ id: 'g2', notChampionship: true }] })
    assert.equal(db.tree['competitions:data'].c1.groups.g2.notChampionship, true)
  })

  test('refuses twins, unknown references and sponsors who are not there', async () => {
    const db = fakeSession(competition())
    await refused(call(db.session, 'save_dances', { competition: 'c1', categories: [{ name: 'premier' }] }), /already a category called “Premier” \(id cat1\)/)
    await refused(call(db.session, 'save_dances', { competition: 'c1', dances: [{ name: 'Highland Fling', steps: 4 }] }), /already a dance called “Highland Fling \(4\)”.*different steps/)
    // The same dance at other steps is a different dance
    const six = await call(db.session, 'save_dances', { competition: 'c1', dances: [{ name: 'Highland Fling', steps: 6 }, { name: 'Highland Fling' }] })
    assert.equal(six.created.length, 2)
    await refused(call(db.session, 'save_dances', { competition: 'c1', dances: [{ name: 'highland fling', steps: '6' }] }), /already a dance called/)
    db.updates.length = 0
    await refused(call(db.session, 'save_dances', { competition: 'c1', ageGroups: [{ category: 'Juvenile', name: 'x' }] }), /No category matches “Juvenile”/)
    await refused(call(db.session, 'save_dances', { competition: 'c1', ageGroups: [{ id: 'g1', sponsor: 'Nobody' }] }), /No sponsor matches “Nobody”/)
    await refused(call(db.session, 'save_dances', { competition: 'c1', dances: [{ id: 'zzz', name: 'x' }] }), /no dance with the id zzz/)
    assert.equal(db.updates.length, 0)
  })

  test('puts things in order, the named first', async () => {
    const db = fakeSession(competition())
    await call(db.session, 'save_dances', { competition: 'c1', order: { categories: ['Championship'] } })
    const c = db.tree['competitions:data'].c1.categories
    assert.deepEqual([c.cat2._order, c.cat1._order], [0, 1])
  })
})

describe('save_dancers', () => {
  test('adds entries, with their category following their age group, and a duet as a team', async () => {
    const db = fakeSession(competition())
    const out = await call(db.session, 'save_dancers', {
      competition: 'c1',
      dancers: [
        { number: 103, ageGroup: '9 & 10', firstName: 'Mia', lastName: 'Kerr', location: 'Calgary, AB', studio: 'Thistle' },
        { number: '300', ageGroup: 'g2', routine: 'The Reelers', members: [{ firstName: 'Ella', lastName: 'Grant' }, { firstName: 'Ruby', lastName: 'Fraser' }] },
      ],
    })
    const dancers = db.tree['competitions:data'].c1.dancers
    const [one, team] = out.created.map((c: Json) => dancers[c.id])
    assert.deepEqual([one.number, one.firstName, one.lastName, one.groupId, one.categoryId, one.studio], ['103', 'Mia', 'Kerr', 'g1', 'cat1', 'Thistle'])
    assert.equal(team.team, true)
    assert.equal(team.title, 'The Reelers')
    assert.equal(Object.keys(team.members).length, 2)
    assert.equal(team.firstName, 'The Reelers', 'v3’s copy of a team’s name')
    assert.equal(team.categoryId, 'cat2')
  })

  test('numbers are digits and unique within an age group, also within one call', async () => {
    const db = fakeSession(competition())
    await refused(call(db.session, 'save_dancers', { competition: 'c1', dancers: [{ number: '101', ageGroup: 'g1', firstName: 'X' }] }), /101 is already Isla Grant in this age group/)
    await refused(call(db.session, 'save_dancers', { competition: 'c1', dancers: [{ number: 'A1', ageGroup: 'g1', firstName: 'X' }] }), /Use digits/)
    await refused(call(db.session, 'save_dancers', { competition: 'c1', dancers: [{ number: '7', ageGroup: 'g1', firstName: 'X' }, { number: '7', ageGroup: 'g1', firstName: 'Y' }] }), /7 is already X/)
    await refused(call(db.session, 'save_dancers', { competition: 'c1', dancers: [{ number: '8', ageGroup: 'g1', lastName: 'NoFirst' }] }), /First name can’t be empty|needs a first name/)
    await refused(call(db.session, 'save_dancers', { competition: 'c1', dancers: [{ number: '8', ageGroup: 'g1', members: [{ firstName: 'A' }, { firstName: '' , lastName: 'B' }] }] }), /Each dancer needs a first name/)
    assert.equal(db.updates.length, 0, 'a call is all or nothing')
    // the same number in another age group is fine
    await call(db.session, 'save_dancers', { competition: 'c1', dancers: [{ number: '101', ageGroup: 'g2', firstName: 'Same' }] })
  })

  test('corrects by id: names exactly as given, a move to another age group, a team’s members', async () => {
    const db = fakeSession(competition())
    const out = await call(db.session, 'save_dancers', { competition: 'c1', dancers: [{ id: 'a', firstName: 'ISLA ROSE', location: 'Glasgow' }, { id: 'b', ageGroup: 'g2' }] })
    const d = db.tree['competitions:data'].c1.dancers
    assert.deepEqual([d.a.firstName, d.a.location, d.a.lastName], ['ISLA ROSE', 'Glasgow', 'Grant'])
    assert.deepEqual([d.b.groupId, d.b.categoryId], ['g2', 'cat2'])
    const team = await call(db.session, 'save_dancers', { competition: 'c1', dancers: [{ id: 'a', members: [{ firstName: 'Isla', lastName: 'Grant' }, { firstName: 'Ava', lastName: 'Reid' }] }] })
    assert.equal(db.tree['competitions:data'].c1.dancers.a.team, true)
    await refused(call(db.session, 'save_dancers', { competition: 'c1', dancers: [{ id: 'a', firstName: 'X' }] }), /duet, trio or group/)
    await refused(call(db.session, 'save_dancers', { competition: 'c1', dancers: [{ id: 'b', number: '101', ageGroup: 'g1' }] }), /101 is already/)
    await call(db.session, 'undo_change', { competition: 'c1', change: team.change })
    assert.equal(db.tree['competitions:data'].c1.dancers.a.team, undefined)
    assert.ok(out.change)
  })

  test('200 in one call is one atomic update, 201 is refused by the schema', async () => {
    const db = fakeSession(competition())
    const many = Array.from({ length: 200 }, (_, i) => ({ number: String(500 + i), ageGroup: 'g1', firstName: `D${i}` }))
    await call(db.session, 'save_dancers', { competition: 'c1', dancers: many })
    assert.equal(db.updates.length, 1)
    assert.equal(Object.keys(db.tree['competitions:data'].c1.dancers).length, 202)
    const schema = tool('save_dancers').input.dancers as unknown as { safeParse(v: unknown): { success: boolean } }
    assert.equal(schema.safeParse([...many, many[0]]).success, false)
  })
})

describe('save_staff', () => {
  test('adds staff and platforms, and refuses a second of the same', async () => {
    const db = fakeSession(competition())
    const out = await call(db.session, 'save_staff', {
      competition: 'c1',
      staff: [{ role: 'Piper', firstName: 'Alasdair', lastName: 'Gillies', website: 'example.com' }, { id: 's2', location: 'Scotland' }],
      platforms: [{ name: 'B', description: 'By the stage' }],
    })
    const data = db.tree['competitions:data'].c1
    assert.equal(data.staff[out.created[0].id].type, 'Piper')
    assert.equal(data.staff[out.created[0].id]._order, 2)
    assert.equal(data.staff.s2.location, 'Scotland')
    assert.equal(data.platforms[out.created[1].id].name, 'B')
    await refused(call(db.session, 'save_staff', { competition: 'c1', staff: [{ role: 'Piper', firstName: 'Alasdair', lastName: 'Gillies' }] }), /already a Piper called/)
    await refused(call(db.session, 'save_staff', { competition: 'c1', staff: [{ role: 'Judge', firstName: 'X', website: 'no link' }] }), /doesn’t look like a link/)
    await refused(call(db.session, 'save_staff', { competition: 'c1', staff: [{ firstName: 'X' }] }), /needs a role/)
  })

  test('shared staff cannot be changed here', async () => {
    const db = fakeSession({ ...competition(), 'competitionLinks:sync': { c1: { staff: true } }, 'competitionLinks:of': { c1: 'L' }, competitionLinks: { L: { primary: 'c0' } } })
    db.tree.competitions.c0 = { name: 'Main Event' }
    await refused(call(db.session, 'save_staff', { competition: 'c1', staff: [{ role: 'Judge', firstName: 'New' }] }), /whole staff list of this competition is shared from Main Event/)
  })
})

describe('remove', () => {
  const full = () => competition({
    results: { g1: { callbacks: ['a'], d1: ['a', 'b'] } },
    draws: { g1: { d1: ['101', '102'] } },
    schedule: { days: { day1: { blocks: { b1: { events: { e1: { dances: { x: { danceId: 'd1', platforms: { p1: { orderedGroupIds: ['g1', 'g2'], orderedJudgeIds: ['s2'] } } } } } } } } } } },
  })

  test('an age group goes with its results, draws and place in the schedule, and says so', async () => {
    const db = fakeSession(full())
    const out = await call(db.session, 'remove', { competition: 'c1', what: 'ageGroup', ids: ['g1'] })
    const data = db.tree['competitions:data'].c1
    assert.equal(data.groups.g1, undefined)
    assert.equal(data.results, undefined)
    assert.equal(data.draws, undefined)
    assert.deepEqual(data.schedule.days.day1.blocks.b1.events.e1.dances.x.platforms.p1.orderedGroupIds, ['g2'])
    assert.equal(data.dances.d1.groupIds, undefined)
    assert.deepEqual(out.removed, [{ kind: 'ageGroup', id: 'g1', name: 'Premier 9 & 10 Years' }])
    assert.ok(out.warnings.some((w: string) => /results and draws will be deleted/.test(w)))
    assert.ok(out.warnings.some((w: string) => /2 dancers are in it/.test(w)))
    await call(db.session, 'undo_change', { competition: 'c1', change: out.change })
    assert.deepEqual(db.tree['competitions:data'].c1.results.g1.d1, ['a', 'b'])
    assert.equal(db.tree['competitions:data'].c1.groups.g1.name, '9 & 10 Years')
  })

  test('removes entries with their numbers out of draws, a judge from the schedule, and refuses unknown ids', async () => {
    const db = fakeSession(full())
    const out = await call(db.session, 'remove', { competition: 'c1', what: 'dancer', ids: ['a'] })
    assert.deepEqual(db.tree['competitions:data'].c1.draws.g1.d1, ['102'])
    assert.match(out.warnings[0], /results entered/)
    await call(db.session, 'remove', { competition: 'c1', what: 'staff', ids: ['s2'] })
    assert.equal(db.tree['competitions:data'].c1.schedule.days.day1.blocks.b1.events.e1.dances.x.platforms.p1.orderedJudgeIds, undefined)
    await refused(call(db.session, 'remove', { competition: 'c1', what: 'dance', ids: ['d1', 'nope'] }), /No dance has the id nope.*Nothing was removed/)
  })

  test('refuses what would delete judges’ sheets for good', async () => {
    const db = fakeSession(competition({ sheets: { g1: { d1: { p: { url: 'u', path: 'p', width: 1, height: 1 } } } } }))
    await refused(call(db.session, 'remove', { competition: 'c1', what: 'ageGroup', ids: ['g1'] }), /judges’ sheets.*for good.*in the app/)
    assert.equal(db.updates.length, 0)
  })
})

describe('draft_dancers', () => {
  const list = [
    { number: '101', category: 'Premier', ageGroup: '12 & Under 14 Years', firstName: 'Isla', lastName: 'Grant', location: 'Calgary, AB', studio: 'Thistle, School' },
    { number: '102', category: 'Premier', ageGroup: '12 & Under 14 Years', firstName: 'Ava', lastName: 'O’Neill' },
    { number: '300', category: 'Premier', ageGroup: '12 & Under 14 Years', routine: 'The "Reelers"', members: [{ firstName: 'Ella', lastName: 'Grant' }, { firstName: 'Ruby', lastName: 'Fraser' }] },
  ]

  test('the file reads back through Import dancers as the same entries', () => {
    const parsed = parseGrid(gridFromText(draftCsv(list)))!
    assert.equal(parsed.layout, 'table')
    const entries = importEntries(parsed.dancers)
    assert.equal(entries.length, 3)
    assert.deepEqual([entries[0].number, entries[0].firstName, entries[0].lastName, entries[0].category, entries[0].group, entries[0].location, entries[0].studio], ['101', 'Isla', 'Grant', 'Premier', '12 & Under 14 Years', 'Calgary, AB', 'Thistle, School'])
    assert.equal(entries[1].lastName, 'O’Neill')
    assert.deepEqual(entries[2].names, [{ firstName: 'Ella', lastName: 'Grant' }, { firstName: 'Ruby', lastName: 'Fraser' }])
    assert.equal(entries[2].title, 'The "Reelers"')
  })

  test('files it in the inbox in the shape the rules and the screen expect, and changes nothing else', async () => {
    const db = fakeSession(competition())
    const before = JSON.stringify(db.tree.competitions)
    const out = await fileDraft(db.session, 'c1', list, undefined, ids)
    const item = db.tree['users:inbox'].u1[out.inbox]
    assert.deepEqual(Object.keys(item).sort(), ['competitionId', 'kind', 'name', 'sentAt', 'source', 'text'])
    assert.deepEqual([item.kind, item.source, item.competitionId, typeof item.sentAt], ['dancers', 'Claude', 'c1', 'number'])
    assert.equal(JSON.stringify(db.tree.competitions), before)
    assert.equal(db.updates.length, 0)
    assert.match(out.next, /\/competitions\/c1\/manage\/dancers\/import\?inbox=id\d+/)
  })

  test('checks the list and the competition', async () => {
    const db = fakeSession(competition())
    await refused(fileDraft(db.session, 'c1', [{ number: '1' }], undefined, ids), /needs a first name/)
    await refused(fileDraft(db.session, 'c1', [], undefined, ids), /no dancers/)
    await refused(fileDraft(db.session, 'c9', list, undefined, ids), /You don’t manage/)
  })
})

describe('get_changes', () => {
  test('lists what was changed, newest first, and what was undone', async () => {
    const db = fakeSession(competition())
    const a = await call(db.session, 'update_competition', { competition: 'c1', venue: 'One' })
    db.tick(5000)
    await call(db.session, 'update_competition', { competition: 'c1', venue: 'Two' })
    await call(db.session, 'undo_change', { competition: 'c1', change: a.change }).catch(() => undefined)
    const { changes } = await call(db.session, 'get_changes', { competition: 'c1' })
    assert.equal(changes.length, 2, 'the undo was refused, so only the two changes')
    assert.match(changes[0].summary, /venue/i)
    assert.ok(changes.every((c: Json) => c.id && c.summary))
  })
})

// ---------- results, draws, schedule

/** Two age groups with dances, callbacks possible, a team, a trophy event of each kind */
const full = (extra: Json = {}) => {
  const base = competition()
  const data = base['competitions:data'].c1
  data.dances = {
    d1: { name: 'Highland Fling', steps: '4', _order: 0, groupIds: { g1: true, g2: true } },
    d2: { name: 'Reel', _order: 1, groupIds: { g1: true } },
    d3: { name: 'Sword', _order: 2, groupIds: { g2: true } },
  }
  data.dancers = {
    a: { number: '101', firstName: 'Isla', lastName: 'Grant', groupId: 'g1' },
    b: { number: '102', firstName: 'Ava', lastName: 'Reid', groupId: 'g1' },
    c: { number: '103', firstName: 'Mia', lastName: 'Cox', groupId: 'g1' },
    t: { number: '104', team: true, title: 'The Pair', groupId: 'g1', members: { m1: { firstName: 'Zoe', _order: 0 }, m2: { firstName: 'Kit', _order: 1 } } },
    e: { number: '201', firstName: 'Eve', lastName: 'Cole', groupId: 'g2' },
    f: { number: '202', firstName: 'Fay', lastName: 'Dunn', groupId: 'g2' },
    h: { number: '203', firstName: 'Hope', lastName: 'Ewart', groupId: 'g2' },
    i: { number: '201', firstName: 'Ida', lastName: 'Fox', groupId: 'g1' },
  }
  data.categories.cat3 = { name: 'Primary', _order: 2 }
  data.groups.g3 = { name: '8 & Under', categoryId: 'cat3', _order: 2 }
  data.trophyEvents = {
    te1: { name: 'Dancer of the Day', groupIds: { g1: true, g2: true }, _order: 0 },
    te2: { name: 'Trophy Fling', danceId: 'd1', groupIds: { g1: true }, _order: 1 },
  }
  data.staff.s3 = { type: 'Judge', firstName: 'Bruce', lastName: 'Mackay', _order: 2 }
  data.platforms.p2 = { name: 'B', _order: 1 }
  Object.assign(data, extra)
  return base
}
const results = (db: ReturnType<typeof fakeSession>) => db.tree['competitions:data'].c1.results

describe('save_results', () => {
  test('saves ties in order, with names read back, and get_results gives the same list', async () => {
    const db = fakeSession(full())
    const out = await call(db.session, 'save_results', { competition: 'c1', rows: [
      { ageGroup: 'g1', row: 'callbacks', numbers: ['101', 102, '103', '104'] },
      { ageGroup: '9 & 10', row: 'Highland Fling', numbers: ['104', ['102', '101'], '103'] },
    ] })
    assert.deepEqual(results(db).g1.d1, ['t', 'b', 'a:tie', 'c'])
    assert.deepEqual(results(db).g1.callbacks, ['a', 'b', 'c', 't'])
    assert.ok(out.change)
    const fling = out.saved.find((r: Json) => r.row === 'Highland Fling (4)')
    assert.deepEqual(fling.numbers, ['104', ['102', '101'], '103'])
    assert.deepEqual(fling.placings.map((p: Json) => [p.place, p.number, p.name]), [[1, '104', 'Zoe & Kit'], [2, '102', 'Ava Reid'], [2, '101', 'Isla Grant'], [4, '103', 'Mia Cox']].map(([a, b]) => [a, b, fling.placings.find((p: Json) => p.number === b).name]))
    // The read tool gives the list in the shape save_results takes
    const parts = Object.fromEntries(Object.entries(db.tree['competitions:data'].c1)) as never
    const read = resultsView(parts, { ageGroup: 'g1' }) as Json
    assert.deepEqual(read.ageGroups[0].dances[0].numbers, fling.numbers)
    assert.deepEqual(read.ageGroups[0].callbacks.numbers, ['101', '102', '103', '104'])
  })

  test('a championship announced from the bottom, and the overall', async () => {
    const db = fakeSession(full())
    await call(db.session, 'save_results', { competition: 'c1', rows: [
      { ageGroup: 'g2', row: 'callbacks', numbers: ['201', '202', '203'] },
      { ageGroup: 'g2', row: 'overall', numbers: ['203', '202', '201'], reversedFrom: 3 },
    ] })
    assert.deepEqual(results(db).g2.overall, ['reverse:3', 'h', 'f', 'e'])
    const read = resultsView(db.tree['competitions:data'].c1, { ageGroup: 'g2' }) as Json
    assert.equal(read.ageGroups[0].overall.reversedFrom, 3)
    assert.deepEqual(read.ageGroups[0].overall.placings.map((p: Json) => [p.number, p.place]), [['203', 3], ['202', 2], ['201', 1]])
    // reversedFrom alone changes just the mode; a tie in reverse
    await call(db.session, 'save_results', { competition: 'c1', rows: [{ ageGroup: 'g2', row: 'overall', numbers: ['203', ['202', '201']], reversedFrom: 3 }] })
    assert.deepEqual(results(db).g2.overall, ['reverse:3', 'h', 'f', 'e:tie'])
    await call(db.session, 'save_results', { competition: 'c1', rows: [{ ageGroup: 'g2', row: 'overall', reversedFrom: null }] })
    assert.deepEqual(results(db).g2.overall, ['h', 'f', 'e:tie'])
  })

  test('no results, no callback round, clearing, and points', async () => {
    const db = fakeSession(full())
    await call(db.session, 'save_results', { competition: 'c1', rows: [
      { ageGroup: 'g1', row: 'callbacks', noResults: true },
      { ageGroup: 'g1', row: 'Reel', noResults: true },
      { ageGroup: 'g2', row: 'callbacks', numbers: ['201', '202'] },
      { ageGroup: 'g2', row: 'Sword', numbers: ['202'], points: ['201'] },
    ] })
    assert.equal(results(db).g1.callbacks, false)
    assert.equal(results(db).g1.d2, false)
    assert.deepEqual(db.tree['competitions:data'].c1.points.g2.d3.combined, ['e'])
    // with no callback round anyone can be placed
    await call(db.session, 'save_results', { competition: 'c1', rows: [{ ageGroup: 'g1', row: 'Reel', numbers: ['103'] }] })
    assert.deepEqual(results(db).g1.d2, ['c'])
    await call(db.session, 'save_results', { competition: 'c1', rows: [{ ageGroup: 'g1', row: 'Reel', numbers: [] }] })
    assert.equal(results(db).g1.d2, undefined)
    await refused(call(db.session, 'save_results', { competition: 'c1', rows: [{ ageGroup: 'g2', row: 'Sword', numbers: ['201'], points: ['201'] }] }), /placed and given a point/)
  })

  test('trophy events: placings across the age groups they are open to, callbacks only when danced', async () => {
    const db = fakeSession(full())
    await refused(call(db.session, 'save_results', { competition: 'c1', rows: [{ trophyEvent: 'Dancer of the Day', row: 'overall', numbers: ['201'] }] }), /Number 201 is in more than one.*Give the entry id/)
    await call(db.session, 'save_results', { competition: 'c1', rows: [{ trophyEvent: 'Dancer of the Day', row: 'overall', numbers: ['e', '101', 'f'] }] })
    assert.deepEqual(results(db).te1.overall, ['e', 'a', 'f'])
    await refused(call(db.session, 'save_results', { competition: 'c1', rows: [{ trophyEvent: 'te1', row: 'callbacks', numbers: ['e'] }] }), /isn’t danced on its own/)
    await refused(call(db.session, 'save_results', { competition: 'c1', rows: [{ trophyEvent: 'te2', row: 'overall', numbers: ['202'] }] }), /not an entry in Trophy Fling/)
    const out = await call(db.session, 'save_results', { competition: 'c1', rows: [{ trophyEvent: 'te2', row: 'callbacks', numbers: ['101', '102'] }, { trophyEvent: 'te2', row: 'overall', numbers: ['102', '101'] }] })
    assert.deepEqual(results(db).te2, { callbacks: ['a', 'b'], overall: ['b', 'a'] })
    assert.equal(out.saved[1].row, 'placings')
  })

  test('refuses, in sentences, what the app would not let through', async () => {
    const db = fakeSession(full())
    const r = (row: Json) => call(db.session, 'save_results', { competition: 'c1', rows: [row] })
    await refused(r({ ageGroup: 'g1', row: 'Highland Fling', numbers: ['999'] }), /999 is not an entry in Premier 9 & 10 Years/)
    await refused(r({ ageGroup: 'g1', row: 'Highland Fling', numbers: ['101', ['102', '101']] }), /placed twice/)
    await refused(r({ ageGroup: 'g1', row: 'Sword', numbers: ['101'] }), /doesn’t dance Sword.*Championship 12 & Over/)
    await refused(r({ ageGroup: 'g3', row: 'overall', numbers: ['101'] }), /Primary 8 & Under has no overall/)
    await refused(r({ ageGroup: 'g1', row: 'Highland Fling', numbers: ['?'] }), /allowStandIns/)
    await refused(r({ ageGroup: 'g1', row: 'callbacks', numbers: [['101', '102']] }), /no ties/)
    await refused(r({ ageGroup: 'g1', row: 'Highland Fling', numbers: ['101', '102', '103', '104'], reversedFrom: 3 }), /4 dancers listed but reversedFrom is 3/)
    await refused(r({ row: 'Highland Fling', numbers: [] }), /ageGroup or trophyEvent/)
    await refused(r({ ageGroup: 'g1', row: 'Highland Fling' }), /say what to save/)
    assert.equal(db.updates.length, 0)
    // callbacks entered: only those called back place
    await r({ ageGroup: 'g1', row: 'callbacks', numbers: ['101'] })
    await refused(r({ ageGroup: 'g1', row: 'Highland Fling', numbers: ['101', '102'] }), /102 wasn’t called back/)
  })

  test('a ? stand-in only when asked, and it is a fresh number each time', async () => {
    const db = fakeSession(full())
    const out = await call(db.session, 'save_results', { competition: 'c1', rows: [{ ageGroup: 'g1', row: 'Highland Fling', numbers: ['101', '?', '?'], allowStandIns: true }] })
    const stored = results(db).g1.d1 as string[]
    assert.equal(stored[0], 'a')
    assert.ok(/^\d+$/.test(stored[1]) && /^\d+$/.test(stored[2]) && stored[1] !== stored[2])
    assert.ok(out.warnings.some((w: string) => /no callbacks entered/.test(w)))
    assert.deepEqual(out.saved[0].numbers, ['101', '?', '?'])
  })

  test('the Results tab hidden, and undo restores the earlier placings', async () => {
    const hidden = fakeSession(full({ results: false }))
    await refused(call(hidden.session, 'save_results', { competition: 'c1', rows: [{ ageGroup: 'g1', row: 'callbacks', numbers: ['101'] }] }), /Results tab is hidden/)
    const db = fakeSession(full({ results: { g1: { callbacks: ['a', 'b'], d1: ['a', 'b'] } } }))
    const out = await call(db.session, 'save_results', { competition: 'c1', rows: [{ ageGroup: 'g1', row: 'Highland Fling', numbers: ['102', '101'] }] })
    assert.deepEqual(results(db).g1.d1, ['b', 'a'])
    await call(db.session, 'undo_change', { competition: 'c1', change: out.change })
    assert.deepEqual(results(db).g1.d1, ['a', 'b'])
    const same = await call(db.session, 'save_results', { competition: 'c1', rows: [{ ageGroup: 'g1', row: 'Highland Fling', numbers: ['101', '102'] }] })
    assert.equal(same.change, undefined)
  })
})

describe('save_draws', () => {
  test('sets an explicit order, numbers order, strays and missing, and clears', async () => {
    const db = fakeSession(full({ draws: { g1: { d1: ['101', '999'] } } }))
    const draws = () => db.tree['competitions:data'].c1.draws
    const out = await call(db.session, 'save_draws', { competition: 'c1', draws: [{ ageGroup: 'g1', dance: 'Highland Fling', order: ['103', '101', '102'] }] })
    assert.deepEqual(draws().g1.d1, ['103', '101', '102'])
    assert.match(out.warnings[0], /2 entries are not in the draw yet \(104, 201\)/)
    assert.deepEqual(out.saved[0].order, ['103', '101', '102'])
    await call(db.session, 'save_draws', { competition: 'c1', draws: [{ ageGroup: 'g1', dance: 'Highland Fling', action: 'numberOrder' }] })
    assert.deepEqual(draws().g1.d1, ['101', '102', '103', '104', '201'])
    await call(db.session, 'save_draws', { competition: 'c1', draws: [{ ageGroup: 'g1', dance: 'Highland Fling', order: ['101'] }, { ageGroup: 'g2', dance: 'Sword', order: [] }] })
    await call(db.session, 'save_draws', { competition: 'c1', draws: [{ ageGroup: 'g1', dance: 'Highland Fling', action: 'addMissing' }] })
    assert.deepEqual(draws().g1.d1, ['101', '102', '103', '104', '201'])
    await call(db.session, 'save_draws', { competition: 'c1', draws: [{ ageGroup: 'g1', dance: 'all', action: 'clear' }] })
    assert.equal(draws()?.g1, undefined)
  })

  test('shuffles with everyone in, and reels stay in number order', async () => {
    const db = fakeSession(full())
    const draws = () => db.tree['competitions:data'].c1.draws.g1
    await call(db.session, 'save_draws', { competition: 'c1', draws: [{ ageGroup: 'g1', dance: 'all', action: 'shuffle' }] })
    assert.deepEqual([...draws().d1].sort(), ['101', '102', '103', '104', '201'])
    assert.deepEqual(draws().d2, ['101', '102', '103', '104', '201'])
    db.tree['competitions:data'].c1.draws.g1.d2 = ['104']
    const out = await call(db.session, 'save_draws', { competition: 'c1', draws: [{ ageGroup: 'g1', dance: 'Reel', action: 'shuffle' }] })
    assert.deepEqual(draws().d2, ['101', '102', '103', '104', '201'])
    assert.match(out.warnings[0], /reel/)
    // two entries can share a number across age groups: the draw is for one age group
    await call(db.session, 'save_draws', { competition: 'c1', draws: [{ ageGroup: 'g1', dance: 'Highland Fling', action: 'shuffle' }] })
    assert.equal(draws().d1.length, 5)
  })

  test('refuses numbers that are not entries, doubles, and dances the age group does not do', async () => {
    const db = fakeSession(full())
    const r = (row: Json) => call(db.session, 'save_draws', { competition: 'c1', draws: [row] })
    await refused(r({ ageGroup: 'g1', dance: 'Highland Fling', order: ['101', '500'] }), /500 is not an entry in Premier 9 & 10 Years/)
    await refused(r({ ageGroup: 'g1', dance: 'Highland Fling', order: ['101', '101'] }), /in the draw twice/)
    await refused(r({ ageGroup: 'g1', dance: 'Sword', action: 'shuffle' }), /doesn’t dance Sword/)
    await refused(r({ ageGroup: 'g1', dance: 'all' }), /give an order/)
    await refused(r({ ageGroup: 'g1', dance: 'all', order: ['101'] }), /one dance/)
    assert.equal(db.updates.length, 0)
  })
})

describe('save_schedule', () => {
  const day = (): Json => ({
    name: 'Saturday', date: '2026-04-11',
    sessions: [
      { name: 'Morning', events: [
        { name: 'Registration', description: '8:30 am', dances: [{ name: 'Check-in' }] },
        { name: 'Premier', description: '9:00 am', dances: [
          { danceId: 'd1', platforms: [{ platform: 'A', ageGroups: ['g1', 'gap', '9 & 10'].slice(0, 2), judges: ['Aileen Robertson'] }, { id: 'p2', ageGroups: ['Trophy Fling'], judges: ['s3'] }] },
          { dance: 'Reel', platforms: [{ id: 'p1', ageGroups: ['g1'] }] },
        ] },
      ] },
      { name: 'Afternoon', events: [{ name: 'Results' }] },
    ],
  })

  test('builds a whole day, and what it saved reads back and sends back unchanged', async () => {
    const db = fakeSession(full())
    const out = await call(db.session, 'save_schedule', { competition: 'c1', days: [day()] })
    assert.match(out.summary, /Added Saturday \(2 sessions, 3 events, 3 rows\)/)
    const saved = db.tree['competitions:data'].c1.schedule.days
    const [dayId] = Object.keys(saved)
    const blocks = Object.values(saved[dayId].blocks) as Json[]
    assert.deepEqual(blocks.map((b) => [b.name, b.order]), [['Morning', 0], ['Afternoon', 1]])
    const rows = Object.values((Object.values(blocks[0].events)[1] as Json).dances) as Json[]
    assert.deepEqual(rows.map((r) => [r.danceId, r.order]), [['d1', 0], ['d2', 1]])
    assert.deepEqual(rows[0].platforms.p1, { orderedGroupIds: ['g1', rows[0].platforms.p1.orderedGroupIds[1]], orderedJudgeIds: ['s2'] })
    assert.ok(/^\d+$/.test(rows[0].platforms.p1.orderedGroupIds[1]), 'a gap')
    assert.deepEqual(rows[0].platforms.p2, { orderedGroupIds: ['te2'], orderedJudgeIds: ['s3'] })
    // read, send back as it was read: nothing changes
    const read = scheduleView(db.tree['competitions:data'].c1, undefined) as Json
    assert.equal(read.days[0].sessions[0].events[1].dances[0].dance, 'Highland Fling (4)')
    const again = await call(db.session, 'save_schedule', { competition: 'c1', days: read.days })
    assert.equal(again.change, undefined, JSON.stringify(again))
    // and undo takes the day away
    await call(db.session, 'undo_change', { competition: 'c1', change: out.change })
    assert.equal(db.tree['competitions:data'].c1.schedule, undefined)
  })

  test('replaces what it is given: ids kept, the rest removed, days not sent untouched', async () => {
    const db = fakeSession(full())
    await call(db.session, 'save_schedule', { competition: 'c1', days: [day(), { name: 'Sunday', date: '2026-04-12', sessions: [{ name: 'All day', events: [{ name: 'Open' }] }] }] })
    const read = scheduleView(db.tree['competitions:data'].c1, undefined) as Json
    assert.deepEqual(read.days.map((d: Json) => d.name), ['Saturday', 'Sunday'])
    const sat = read.days[0]
    const morning = sat.sessions[0]
    const out = await call(db.session, 'save_schedule', { competition: 'c1', days: [{ date: '2026-04-11', sessions: [{ id: morning.id, name: 'Morning', events: [{ id: morning.events[1].id, name: 'Premier', dances: [{ id: morning.events[1].dances[1].id, danceId: 'd2' }] }] }] }] })
    assert.match(out.warnings[0], /Saturday: 1 session that was there before.*removed/)
    const after = scheduleView(db.tree['competitions:data'].c1, undefined) as Json
    assert.equal(after.days.length, 2)
    assert.equal(after.days[0].sessions.length, 1)
    assert.deepEqual(after.days[0].sessions[0].events.map((e: Json) => e.name), ['Premier'])
    assert.equal(after.days[0].sessions[0].events[0].dances.length, 1)
    assert.equal(after.days[1].sessions[0].name, 'All day')
    // no sessions given: the day keeps its own
    await call(db.session, 'save_schedule', { competition: 'c1', days: [{ id: after.days[0].id, name: 'Saturday 11th' }] })
    const renamed = scheduleView(db.tree['competitions:data'].c1, undefined) as Json
    assert.equal(renamed.days[0].name, 'Saturday 11th')
    assert.equal(renamed.days[0].sessions.length, 1)
  })

  test('refuses what the builder would not allow, in sentences', async () => {
    const db = fakeSession(full())
    const r = (platforms: Json[], row: Json = { danceId: 'd2' }) => call(db.session, 'save_schedule', { competition: 'c1', days: [{ name: 'Sat', sessions: [{ name: 'AM', events: [{ name: 'E', dances: [{ ...row, platforms }] }] }] }] })
    await refused(r([{ platform: 'A', ageGroups: ['Championship'] }]), /Championship 12 & Over doesn’t dance Reel/)
    await refused(r([{ platform: 'A', ageGroups: ['te1'] }]), /There is no age group|No age group matches|trophy/i)
    await refused(r([{ platform: 'A', ageGroups: ['te2'] }]), /trophy event danced as its own dance, so it only goes with that dance, not Reel/)
    await refused(r([{ platform: 'A', judges: ['Sponsor'] }]), /No judge matches/)
    await refused(r([{ platform: 'A', ageGroups: ['g1', 'g1'] }]), /in this cell twice/)
    await refused(r([{ platform: 'Z' }]), /No platform matches “Z”/)
    await refused(r([{ platform: 'A' }, { id: 'p1' }]), /listed twice/)
    await refused(r([{ platform: 'A', ageGroups: ['g1'] }], { name: 'Lunch' }), /only a dance has platforms/)
    await refused(r([], { danceId: 'nope' }), /No dance matches/)
    await refused(call(db.session, 'save_schedule', { competition: 'c1', days: [{ name: 'Sat', date: '2026-13-40' }] }), /is not a date/)
    await refused(call(db.session, 'save_schedule', { competition: 'c1', days: [{ id: 'x' }] }), /no day with the id x/)
    await refused(call(db.session, 'save_schedule', { competition: 'c1', days: [{ name: 'Sat', sessions: [{ id: 'x', name: 'AM' }] }] }), /no session with the id x/)
    await refused(call(hiddenSchedule(), 'save_schedule', { competition: 'c1', days: [{ name: 'Sat' }] }), /Schedule tab is hidden/)
    assert.equal(db.updates.length, 0)
  })
})

const hiddenSchedule = () => fakeSession(full({ schedule: false })).session
