import { describe, expect, it } from 'vitest'
import { conversionUpdates, planConversion, type PlanGroup, type PlanRow } from '@/lib/admin/teamPlan'

// Making old team rows into teams (ADR 0012 decision 8), on a competition
// typed the way a 2026 choreography competition was, with made-up names.

const groups: PlanGroup[] = [
  { id: 'solo', label: 'Solo A' },
  { id: 'duet', label: 'Duet Group A' },
  { id: 'trophy', label: 'Highest Total Points' },
  { id: 'premier', label: 'Premier 12 & Under 14' },
]
const rows: PlanRow[] = [
  { id: 's1', num: '101', firstName: 'Celtic Spring', lastName: 'Ava Reid', location: 'Thistle Dance Academy', groupId: 'solo' },
  { id: 's2', num: '102', firstName: 'Ghillies Up', lastName: 'Mia Lee', location: 'House of Glen', groupId: 'solo' },
  { id: 's3', num: '103', firstName: 'Too Sweet', lastName: 'Isla Grant', location: 'Thistle Dance Academy', groupId: 'solo' },
  { id: 's4', num: '104', firstName: 'Fire & Thistle', lastName: 'Ruby Bain', location: 'Thistle Dance Academy', groupId: 'solo' },
  { id: 'd1', num: '201', firstName: 'Waterfall', lastName: 'Ava Reid & Mia Lee', location: 'House of Glen', groupId: 'duet' },
  { id: 'd2', num: '202', firstName: 'Nordic Storm', lastName: 'Isla Grant & Skye Munro', location: 'Thistle Dance Academy', groupId: 'duet' },
  { id: 't1', num: '1', firstName: 'Ava', lastName: 'Reid', groupId: 'trophy' },
  { id: 't2', num: '2', firstName: 'Mia', lastName: 'Lee', groupId: 'trophy' },
  { id: 'p1', num: '301', firstName: 'Ruby', lastName: 'Bain', location: 'Calgary, AB', groupId: 'premier' },
]

describe('planConversion', () => {
  const plan = planConversion(rows, groups)

  it('reads an age group named for teams as teams, with each row’s dancers', () => {
    expect(plan.groups.map((g) => [g.group.id, g.likely])).toEqual([['duet', true]])
    const [d1, d2] = plan.groups[0].teams
    expect(d1).toMatchObject({ title: 'Waterfall', studio: 'House of Glen', location: '', unsure: [] })
    expect(d1.members.map((m) => `${m.firstName} ${m.lastName}`)).toEqual(['Ava Reid', 'Mia Lee'])
    expect(d2).toMatchObject({ title: 'Nordic Storm', studio: 'Thistle Dance Academy' })
  })

  it('never reads an age group named for solos as teams, and tidies its routines', () => {
    expect(plan.routines.map((r) => [r.id, r.firstName, r.lastName, r.title, r.studio])).toEqual([
      ['s1', 'Ava', 'Reid', 'Celtic Spring', 'Thistle Dance Academy'],
      // A studio with no studio word, read as one because the competition types studios there.
      ['s2', 'Mia', 'Lee', 'Ghillies Up', 'House of Glen'],
      ['s3', 'Isla', 'Grant', 'Too Sweet', 'Thistle Dance Academy'],
      // An "&" in a routine's name doesn't make it a team.
      ['s4', 'Ruby', 'Bain', 'Fire & Thistle', 'Thistle Dance Academy'],
    ])
  })

  it('leaves ordinary dancers alone', () => {
    const touched = new Set([...plan.groups.flatMap((g) => g.teams.map((t) => t.id)), ...plan.routines.map((r) => r.id)])
    expect([...touched].filter((id) => id.startsWith('t') || id.startsWith('p'))).toEqual([])
  })

  it('reads a town as a town where Locations are towns', () => {
    const towns = planConversion(
      [
        { id: 'a', num: '1', firstName: 'Ava Reid &', lastName: 'Mia Lee', location: 'Calgary, AB', groupId: 'duet' },
        { id: 'b', num: '2', firstName: 'Isla Grant &', lastName: 'Skye Munro', location: 'MB', groupId: 'duet' },
      ],
      groups,
    )
    expect(towns.groups[0].teams.map((t) => [t.studio, t.location])).toEqual([
      ['', 'Calgary, AB'],
      ['', 'MB'],
    ])
  })
})

describe('a row is a team or a routine, never both', () => {
  it('tags each routine with its age group, so an age group switched to teams leaves its routines out', () => {
    const mixed = planConversion(
      [
        { id: 'a', num: '1', firstName: 'Ava Reid &', lastName: 'Mia Lee', groupId: 'cho' },
        { id: 'b', num: '2', firstName: 'Isla Grant &', lastName: 'Skye Munro', groupId: 'cho' },
        { id: 'c', num: '3', firstName: 'Celtic Fairy -', lastName: 'Lila Bain', groupId: 'cho' },
        { id: 'd', num: '4', firstName: 'Ruby', lastName: 'Shaw', groupId: 'cho' },
        { id: 'e', num: '5', firstName: 'Kirsty', lastName: 'Gow', groupId: 'cho' },
      ],
      [{ id: 'cho', label: 'Choreography 12 & Under' }],
    )
    // Shown (some rows read as teams) but not taken for teams to start.
    expect(mixed.groups.map((g) => [g.group.id, g.likely])).toEqual([['cho', false]])
    expect(mixed.routines.map((r) => [r.id, r.groupId])).toEqual([['c', 'cho']])
  })
})

describe('never guessing', () => {
  it('shows an age group whose rows only look like teams, switched off', () => {
    const plan = planConversion(
      [
        { id: 'a', num: '1', firstName: 'Ava Reid &', lastName: 'Mia Lee', groupId: 'g' },
        { id: 'b', num: '2', firstName: 'Isla Grant &', lastName: 'Skye Munro', groupId: 'g' },
        { id: 'c', num: '3', firstName: 'Ruby Bain &', lastName: 'Lila Shaw', groupId: 'g' },
      ],
      [{ id: 'g', label: 'Section B' }],
    )
    expect(plan.groups.map((g) => [g.group.id, g.likely, g.teams.length])).toEqual([['g', false, 3]])
  })

  it('reads routine-first solos as solos, not duets', () => {
    const plan = planConversion(
      [
        { id: 'a', num: '1', firstName: 'Home Again', lastName: 'Ella Reid', location: 'House of Glen', groupId: 'g' },
        { id: 'b', num: '2', firstName: 'Wild Thyme', lastName: 'Isla Grant', location: 'Thistle Dance Academy', groupId: 'g' },
        { id: 'c', num: '3', firstName: 'Ember', lastName: 'Ruby Bain', location: 'House of Glen', groupId: 'g' },
      ],
      [{ id: 'g', label: 'Choreography Premier' }],
    )
    expect(plan.groups).toEqual([])
    expect(plan.routines.map((r) => [r.id, r.firstName, r.lastName, r.title])).toEqual([
      ['a', 'Ella', 'Reid', 'Home Again'],
      ['b', 'Isla', 'Grant', 'Wild Thyme'],
      ['c', 'Ruby', 'Bain', 'Ember'],
    ])
  })

  it('doubts a routine that’s a first name dancing here', () => {
    const plan = planConversion(
      [
        { id: 'a', num: '1', firstName: 'Mary', lastName: 'Jane Smith', groupId: 'g' },
        { id: 'b', num: '2', firstName: 'Ember', lastName: 'Ruby Bain', groupId: 'g' },
        { id: 'c', num: '3', firstName: 'Wild Thyme', lastName: 'Isla Grant', groupId: 'g' },
        { id: 'd', num: '4', firstName: 'Mary', lastName: 'Shaw', groupId: 'solo' },
      ],
      [{ id: 'g', label: 'Choreography Premier' }, { id: 'solo', label: 'Premier 12' }],
    )
    expect(plan.routines.map((r) => [r.id, r.unsure.length > 0])).toEqual([
      ['a', true],
      ['b', false],
      ['c', false],
    ])
  })
})

describe('conversionUpdates', () => {
  it('makes the chosen rows teams, keeps v3’s name, and unlinks the old profile', () => {
    const plan = planConversion(rows, groups)
    let n = 0
    const updates = conversionUpdates({ teams: plan.groups[0].teams.slice(0, 1), routines: plan.routines.slice(0, 1) }, () => `k${++n}`)
    expect(updates).toEqual({
      'dancers/d1/team': true,
      'dancers/d1/title': 'Waterfall',
      'dancers/d1/studio': 'House of Glen',
      'dancers/d1/location': null,
      'dancers/d1/members': { k1: { firstName: 'Ava', lastName: 'Reid', _order: 0 }, k2: { firstName: 'Mia', lastName: 'Lee', _order: 1 } },
      'dancers/d1/dancerId': null,
      'dancers/s1/firstName': 'Ava',
      'dancers/s1/lastName': 'Reid',
      'dancers/s1/title': 'Celtic Spring',
      'dancers/s1/studio': 'Thistle Dance Academy',
      'dancers/s1/location': null,
    })
  })
})
