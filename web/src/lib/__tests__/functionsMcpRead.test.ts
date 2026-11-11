// @vitest-environment node
import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { ToolError } from '../../../../functions/src/mcp/errors'
import { loadParts, readCompetition } from '../../../../functions/src/mcp/read'
import type { Session } from '../../../../functions/src/mcp/session'
import { DatabaseError } from '../../../../functions/src/mcp/session'
import {
  competitionSummary,
  dancersView,
  dancesView,
  findView,
  isoDate,
  resultsView,
  scheduleView,
  staffView,
  DANCER_CAP,
  type Parts,
} from '../../../../functions/src/mcp/view'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>

const parts: Parts = {
  categories: { cp: { name: 'Primary', _order: 0 }, cn: { name: 'Novice', _order: 1 }, cr: { name: 'Premier', _order: 2 } },
  groups: {
    g1: { name: 'Under 7', categoryId: 'cp', _order: 0 },
    g2: { name: '9 & 10 Years', categoryId: 'cn', _order: 1, trophy: 'Duncan Cup', sponsor: 's2', notChampionship: true },
    g3: { name: '12 & Over', categoryId: 'cr', _order: 2, teams: true, sponsor: 'Typed Sponsor' },
  },
  dances: {
    d1: { name: 'Highland Fling', steps: 4, _order: 0, groupIds: { g1: true, g2: true, g3: true } },
    d2: { name: 'Sword Dance', steps: '2&1', _order: 1, groupIds: { g2: true } },
  },
  trophyEvents: { t1: { name: 'Dancer of the Day', trophy: 'The Quaich', groupIds: { g2: true, g3: true }, _order: 0 } },
  dancers: {
    a: { firstName: 'Isla', lastName: 'Ó Briain', number: '9', groupId: 'g2', studio: 'Highland Arts', location: 'Calgary, AB' },
    b: { firstName: 'Ava', lastName: 'Reid', number: '10', groupId: 'g2' },
    c: { firstName: 'Mia', lastName: 'Kerr', number: '11', groupId: 'g2' },
    d: { firstName: 'Lucy', lastName: 'Ross', number: '12', groupId: 'g2' },
    e: { team: true, title: 'The Reelers', number: '300', groupId: 'g3', members: { m1: { firstName: 'Ella', lastName: 'Grant', _order: 0 }, m2: { firstName: 'Ruby', lastName: 'Fraser', _order: 1 } } },
    f: { firstName: 'Cara', lastName: 'Stewart', number: '1', groupId: 'g1' },
  },
  staff: {
    s1: { type: 'Judge', firstName: 'Aileen', lastName: 'Robertson', _order: 0 },
    s2: { type: 'Sponsor', firstName: 'Calgary Highland', lastName: 'Society', _order: 1 },
    s3: { type: 'Piper', firstName: 'Alasdair', lastName: 'Gillies', _order: 2 },
  },
  platforms: { p1: { name: 'Platform A', _order: 0 }, p2: { name: 'Platform B', _order: 1 } },
  schedule: {
    days: {
      day1: {
        order: 0, name: 'Saturday', date: '2026-11-14',
        blocks: { b1: { order: 0, name: 'Morning', events: { e1: { order: 0, name: 'Novice', dances: {
          sd1: { order: 0, danceId: 'd1', platforms: { p1: { orderedGroupIds: ['g2', '1731000000000', 'g3', 't1'], orderedJudgeIds: ['s1'] }, p2: { orderedGroupIds: ['g1'] } } },
        } } } } },
      },
      day2: { order: 1, name: 'Sunday' },
    },
  },
  results: {
    g2: {
      callbacks: ['a', 'b', 'c'],
      d1: ['a', 'b:tie', 'c', 'd'],
      d2: false,
      overall: ['reverse:3', 'c', 'b:tie', 'a'],
    },
    g1: { d1: ['1731000000000', 'f'] },
    g3: { d1: ['gone'] },
    t1: { overall: ['e'] },
  },
  draws: { g2: { d1: ['12', '9', '10', '11'] } },
}

describe('get_dances', () => {
  const out = dancesView(parts) as Json
  test('age groups carry their category, trophy, sponsor, flags and dances, in order', () => {
    assert.deepEqual(out.ageGroups.map((g: Json) => g.name), ['Primary Under 7', 'Novice 9 & 10 Years', 'Premier 12 & Over'])
    const g2 = out.ageGroups[1]
    assert.deepEqual(g2.category, { id: 'cn', name: 'Novice' })
    assert.equal(g2.trophy, 'Duncan Cup')
    assert.deepEqual(g2.sponsor, { id: 's2', name: 'Calgary Highland Society' })
    assert.equal(g2.notRunAsChampionship, true)
    assert.deepEqual(g2.dances, ['d1', 'd2'])
    assert.equal(g2.entries, 4)
    assert.equal(out.ageGroups[2].teams, true)
    assert.deepEqual(out.ageGroups[2].sponsor, { name: 'Typed Sponsor' })
    assert.equal(out.ageGroups[0].notRunAsChampionship, undefined)
  })
  test('dances say their age groups, “all” when every one does them', () => {
    assert.deepEqual(out.dances.map((d: Json) => [d.id, d.name, d.ageGroups]), [['d1', 'Highland Fling (4)', 'all'], ['d2', 'Sword Dance (2&1)', ['g2']]])
  })
  test('trophy events say who can win them', () => {
    assert.deepEqual(out.trophyEvents[0].ageGroups, ['g2', 'g3'])
    assert.deepEqual(out.trophyEvents[0].openTo, ['Novice 9 & 10 Years', 'Premier 12 & Over'])
  })
})

describe('get_dancers', () => {
  test('by number, numerically, with team members', () => {
    const out = dancersView(parts, undefined) as Json
    assert.deepEqual(out.entries.map((e: Json) => e.number), ['1', '9', '10', '11', '12', '300'])
    const team = out.entries.at(-1)
    assert.equal(team.name, 'The Reelers')
    assert.equal(team.team, true)
    assert.deepEqual(team.members.map((m: Json) => m.name), ['Ella Grant', 'Ruby Fraser'])
    assert.equal(out.entries[1].studio, 'Highland Arts')
  })
  test('narrowed by an age group’s id or its name', () => {
    assert.equal((dancersView(parts, 'g2') as Json).total, 4)
    assert.equal((dancersView(parts, 'novice 9') as Json).total, 4)
  })
  test('a name that fits nothing or several says which', () => {
    assert.throws(() => dancersView(parts, 'Juvenile'), /No age group matches “Juvenile”\. They are: Primary Under 7/)
    assert.throws(() => dancersView(parts, 'r'), /fits \d+ age groups/)
  })
  test('a long list is capped with a note on how to get the rest', () => {
    const many = { ...parts, dancers: Object.fromEntries(Array.from({ length: DANCER_CAP + 30 }, (_, i) => [`x${i}`, { firstName: 'A', lastName: `B${i}`, number: String(i + 1), groupId: 'g1' }])) }
    const out = dancersView(many, undefined) as Json
    assert.equal(out.entries.length, DANCER_CAP)
    assert.equal(out.more, 30)
    assert.match(out.note, /offset 200/)
    assert.equal((dancersView(many, undefined, DANCER_CAP) as Json).entries.length, 30)
  })
})

describe('get_staff and get_schedule', () => {
  test('staff by type, and platforms', () => {
    const out = staffView(parts) as Json
    assert.deepEqual(out.judges.map((j: Json) => j.name), ['Aileen Robertson'])
    assert.deepEqual(out.pipers.map((j: Json) => j.id), ['s3'])
    assert.deepEqual(out.platforms.map((p: Json) => p.name), ['Platform A', 'Platform B'])
  })
  test('the schedule resolves names, keeps gaps, and can be narrowed to a day', () => {
    const out = scheduleView(parts) as Json
    assert.deepEqual(out.days.map((d: Json) => d.name), ['Saturday', 'Sunday'])
    const dance = out.days[0].sessions[0].events[0].dances[0]
    assert.equal(dance.dance, 'Highland Fling (4)')
    assert.equal(dance.name, undefined)
    const [a, b] = dance.platforms
    assert.deepEqual(a.ageGroups.map((g: Json) => g.id), ['g2', '1731000000000', 'g3', 't1'])
    assert.equal(a.ageGroups[1].gap, true)
    assert.equal(a.ageGroups[3].name, 'Dancer of the Day (trophy event)')
    assert.deepEqual(a.judges, [{ id: 's1', name: 'Aileen Robertson' }])
    assert.equal(b.name, 'Platform B')
    assert.deepEqual((scheduleView(parts, 'sunday') as Json).days.map((d: Json) => d.id), ['day2'])
  })
  test('a hidden schedule is said to be hidden', () => {
    assert.equal((scheduleView({ ...parts, schedule: false }) as Json).scheduleTabHidden, true)
  })
})

describe('get_results', () => {
  const group = (ageGroup: string, extra: Json = {}) => ((resultsView(parts, { ageGroup, ...extra }) as Json).ageGroups[0]) as Json
  test('“:tie” ties a dancer with the one before', () => {
    const d1 = group('g2').dances[0]
    // a, b:tie, c, d: b ties a for 1st; c is 3rd; d 4th
    assert.deepEqual(d1.placings.map((p: Json) => [p.number, p.place, p.tied]), [['9', 1, true], ['10', 1, true], ['11', 3, undefined], ['12', 4, undefined]])
  })
  test('reversed order is read from the bottom up and said so', () => {
    const overall = group('g2').overall
    assert.equal(overall.reversedFrom, 3)
    assert.deepEqual(overall.placings.map((p: Json) => [p.number, p.place]), [['11', 2], ['10', 2], ['9', 1]])
  })
  test('“no results”, not entered, callbacks, stand-ins and removed entries are told apart', () => {
    const g2 = group('g2')
    assert.equal(g2.dances[1].state, 'no results')
    assert.match(g2.dances[1].meaning, /none placed/)
    assert.deepEqual(g2.callbacks.called.map((c: Json) => c.number), ['9', '10', '11'])
    const g1 = group('g1')
    assert.equal(g1.dances[0].state, 'entered, with a ? to fix')
    assert.equal(g1.dances[0].placings[0].standIn, true)
    assert.equal(g1.callbacks.state, 'not entered')
    assert.equal(group('g3').dances[0].placings[0].missing, true)
  })
  test('Primary has no overall; the others do', () => {
    assert.equal(group('g1').overall, undefined)
    assert.equal(group('g2').overall.state, 'entered')
  })
  test('trophy events, and draws only when asked', () => {
    const t = (resultsView(parts, { trophyEvent: 'Dancer of the Day' }) as Json).trophyEvents[0]
    assert.deepEqual(t.placings.placings.map((p: Json) => p.number), ['300'])
    assert.equal(group('g2').dances[0].draw, undefined)
    assert.deepEqual(group('g2', { draws: true }).dances[0].draw, ['12', '9', '10', '11'])
  })
  test('a gap in an old draw is not a feature: left out, as the app does, even when the draw came back sparse', () => {
    const sparse = { ...parts, draws: { g2: { d1: { 0: '12', 2: '10', 3: '', 4: '11' } } } }
    const out = ((resultsView(sparse, { ageGroup: 'g2', draws: true }) as Json).ageGroups[0]) as Json
    assert.deepEqual(out.dances[0].draw, ['12', '10', '11'])
    const holes = { ...parts, draws: { g2: { d1: ['12', null, '', '9'] } } }
    assert.deepEqual((((resultsView(holes, { ageGroup: 'g2', draws: true }) as Json).ageGroups[0]) as Json).dances[0].draw, ['12', '9'])
  })
  test('each dance and overall gives where to add its judges’ sheet, and how many pages it has', () => {
    const withSheet = { ...parts, sheets: { g2: { d1: { p1: { url: 'x' }, p2: { url: 'y' } } } } }
    const g = ((resultsView(withSheet, { ageGroup: 'g2', competition: 'c1' }) as Json).ageGroups[0]) as Json
    assert.match(g.dances[0].judgesSheet.addInApp, /\/competitions\/c1\/manage\/results\/g2\/d1$/)
    assert.equal(g.dances[0].judgesSheet.pages, 2)
    assert.match(g.overall.judgesSheet.addInApp, /\/manage\/results\/g2\/overall$/)
    assert.equal(g.overall.judgesSheet.pages, 0)
  })
  test('with no filter it lists age groups, and past the cap summarises the rest', () => {
    const all = resultsView(parts, {}) as Json
    assert.equal(all.ageGroups.length, 3)
    assert.equal(all.moreAgeGroups, undefined)
    const big = Array.from({ length: 50 }, (_, j) => `a${j}`)
    const many = {
      ...parts,
      groups: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`h${i}`, { name: `Group ${i}`, categoryId: 'cn', _order: i }])),
      dances: { dx: { name: 'Fling', _order: 0, groupIds: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`h${i}`, true])) } },
      results: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`h${i}`, { dx: big }])),
    }
    const out = resultsView(many, {}) as Json
    assert.ok(out.ageGroups.length < 12)
    assert.equal(out.ageGroups.length + out.moreAgeGroups.length, 12)
    assert.match(out.note, /Pass ageGroup/)
  })
  test('a hidden results tab is said to be hidden', () => {
    assert.equal((resultsView({ ...parts, results: false }, {}) as Json).resultsTabHidden, true)
  })
})

describe('find', () => {
  test('by number, and by name ignoring accents and apostrophes', () => {
    assert.deepEqual((findView(parts, '9') as Json).entries.map((e: Json) => e.name), ['Isla Ó Briain'])
    assert.deepEqual((findView(parts, 'o briain') as Json).entries.map((e: Json) => e.number), ['9'])
    assert.deepEqual((findView(parts, 'ó  BRIAIN') as Json).entries.map((e: Json) => e.number), ['9'])
  })
  test('across kinds, and team members', () => {
    const out = findView(parts, 'robertson') as Json
    assert.deepEqual(out.staff, [{ id: 's1', name: 'Aileen Robertson', type: 'Judge' }])
    assert.equal((findView(parts, 'ruby fraser') as Json).entries[0].number, '300')
    assert.equal((findView(parts, 'fling') as Json).dances[0].id, 'd1')
    assert.equal((findView(parts, 'platform b') as Json).platforms[0].id, 'p2')
  })
  test('nothing found says so; an empty query is refused', () => {
    assert.match(String((findView(parts, 'zzz') as Json).nothingFound), /Nothing matches/)
    assert.throws(() => findView(parts, '  '), /Give a name or number/)
  })
})

describe('get_competition', () => {
  const ctx = {
    id: 'c1', today: '2026-11-11', organisations: { o1: 'SDCCS' },
    info: { name: 'Fall Classic', date: 1763006400000, venue: 'Town Hall', listed: true, published: false, organisations: { o1: true }, registrationURL: 'https://x.test', links: { l: { name: 'Rules', url: 'https://r.test' } }, description: 'x'.repeat(700) },
    link: { primary: 'c0', competitions: { c0: 'Fall Opener', c1: 'Fall Classic' } },
    sync: { staff: true, venue: true, about: false },
  }
  test('details, flags, counts and what follows the primary', () => {
    const out = competitionSummary(ctx, parts) as Json
    assert.equal(out.today, '2026-11-11')
    assert.equal(out.date, '2025-11-13')
    assert.equal(out.listed, true)
    assert.equal(out.published, false)
    assert.deepEqual(out.organisations, [{ id: 'o1', name: 'SDCCS' }])
    assert.match(out.description, /100 more characters/)
    assert.deepEqual(out.linked.takenFromPrimary, ['the whole staff list', 'venue, address and place'])
    assert.deepEqual(out.counts, { categories: 3, ageGroups: 3, dances: 2, trophyEvents: 1, entries: 6, teams: 1, judges: 1, pipers: 1, volunteers: 0, sponsors: 1, platforms: 2, scheduleDays: 2, danceResultsEntered: 4, ageGroupsWithDraws: 1 })
    assert.equal(out.resultsTabHidden, undefined)
  })
  test('hidden tabs, and no link', () => {
    const out = competitionSummary({ ...ctx, link: null }, { ...parts, results: false, schedule: false }) as Json
    assert.equal(out.resultsTabHidden, true)
    assert.equal(out.scheduleTabHidden, true)
    assert.equal(out.linked, undefined)
  })
  test('dates, however stored', () => {
    assert.equal(isoDate('2026-10-03'), '2026-10-03')
    assert.equal(isoDate(Date.UTC(2026, 9, 3, 12)), '2026-10-03')
    assert.equal(isoDate(''), null)
    assert.equal(isoDate('nonsense'), null)
  })
})

/** A session over a map of paths, recording what it read */
function fakeSession(data: Record<string, unknown>, denied: string[] = []): Session & { reads: string[] } {
  const reads: string[] = []
  return {
    uid: 'u1', connection: 'c', reads,
    read: async (path: string) => {
      reads.push(path)
      if (denied.some((d) => path.startsWith(d))) throw new DatabaseError('permission-denied', 401)
      return data[path] ?? null
    },
    write: async () => { throw new Error('read only') },
    update: async () => { throw new Error('read only') },
    remove: async () => { throw new Error('read only') },
  } as never
}

describe('reading as the person', () => {
  test('a competition they don’t manage is refused in a sentence, even when it is published', async () => {
    const session = fakeSession({ 'competitions:data/pub/groups': { g: { name: 'Public' } } })
    await assert.rejects(loadParts(session, 'pub', ['groups']), (e) => e instanceof ToolError && /You don’t manage a competition with the id pub/.test(e.message))
    assert.deepEqual(session.reads, ['users:permissions/u1/competitions/pub'])
  })
  test('the rules saying no becomes a sentence about this competition', async () => {
    const session = fakeSession({ 'users:permissions/u1/competitions/c1': true }, ['competitions:data/c1'])
    await assert.rejects(loadParts(session, 'c1', ['groups']), (e) => e instanceof ToolError && /didn’t allow reading competition c1/.test(e.message))
  })
  test('a made-up id is turned away before any read', async () => {
    const session = fakeSession({})
    await assert.rejects(loadParts(session, '../users', ['groups']), /not a competition id/)
    assert.deepEqual(session.reads, [])
  })
  test('only the sections asked for are read, and get_competition adds the details, link and organisation names', async () => {
    const session = fakeSession({
      'users:permissions/u1/competitions/c1': true,
      'competitions/c1': { name: 'Fall Classic', date: '2026-11-14', organisations: { o1: true } },
      'competitions:data/c1/groups': parts.groups,
      'competitionLinks:of/c1': 'L1',
      'competitionLinks/L1': { primary: 'c0', competitions: { c0: true, c1: true } },
      'competitionLinks:sync/c1': { staff: true },
      'competitions/c0/name': 'Opener',
      'competitions/c1/name': 'Fall Classic',
      'organisations/o1/name': 'SDCCS',
    })
    await loadParts(session, 'c1', ['groups'])
    assert.deepEqual(session.reads.filter((p) => p.startsWith('competitions:data')), ['competitions:data/c1/groups'])
    const out = (await readCompetition(session, 'c1', () => '2026-11-11')) as Json
    assert.equal(out.name, 'Fall Classic')
    assert.deepEqual(out.linked.competitions, [{ id: 'c0', name: 'Opener' }, { id: 'c1', name: 'Fall Classic' }])
    assert.deepEqual(out.organisations, [{ id: 'o1', name: 'SDCCS' }])
    assert.equal(out.counts.ageGroups, 3)
  })
})
