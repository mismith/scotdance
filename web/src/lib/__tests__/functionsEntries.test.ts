// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { entryName, isTeam, namesList, teamMembers } from '../../../../functions/src/utility/entries'
import { asEntries, searchDocs } from '../../../../functions/src/dancers'

// Entries in a competition's `dancers` list on the server side (ADR 0012):
// a dancer's, or a team's with its members.

const team = {
  team: true,
  number: '201',
  groupId: 'g1',
  location: 'Ontario',
  members: {
    b: { firstName: 'Mairi', lastName: 'Shaw', _order: 1, dancerId: '-P2' },
    a: { firstName: 'Isla', lastName: 'Grant', _order: 0 },
    blank: { firstName: ' ', lastName: '' },
  },
}

describe('entries', () => {
  it('tells a team from a dancer', () => {
    expect(isTeam(team)).toBe(true)
    expect(isTeam({ firstName: 'Isla', team: 'yes' })).toBe(false)
    expect(isTeam(null)).toBe(false)
  })

  it('lists members in their order, leaving out nameless ones', () => {
    expect(teamMembers(team).map(([k]) => k)).toEqual(['a', 'b'])
    expect(teamMembers({ team: true })).toEqual([])
  })

  it('names a team by its title, else members, else studio, else number', () => {
    expect(entryName({ ...team, title: ' Celtic Sisters ' })).toBe('Celtic Sisters')
    expect(entryName(team)).toBe('Isla Grant & Mairi Shaw')
    expect(entryName({ team: true, studio: 'Thistle School', number: '9' })).toBe('Thistle School')
    expect(entryName({ team: true, number: 205 })).toBe('Entry 205')
    expect(entryName({ firstName: 'Isla', lastName: 'Grant' })).toBe('Isla Grant')
  })

  it('lists a few names in full, and counts the rest', () => {
    expect(namesList(['Ava'])).toBe('Ava')
    expect(namesList(['Ava', 'Skye', 'Isla'])).toBe('Ava, Skye & Isla')
    expect(namesList(['Ava', 'Skye', 'Isla', 'Mairi', 'Eilidh'])).toBe('Ava, Skye, Isla & 2 more')
  })
})

describe('search documents', () => {
  it('index a dancer’s entry as before', () => {
    const [doc] = searchDocs({ firstName: 'Isla', lastName: 'Grant', number: '101' }, { dancerId: 'd1', competitionId: 'c1' })
    expect(doc).toMatchObject({ id: 'd1', competitionId: 'c1', name: 'Isla Grant', number: '101' })
  })

  it('index a team’s members, never the team, each pointing at the team’s entry', () => {
    const docs = searchDocs({ ...team, title: 'Celtic Sisters' }, { dancerId: 't1', competitionId: 'c1' })
    expect(docs).toEqual([
      { id: 't1.a', entryId: 't1', competitionId: 'c1', firstName: 'Isla', lastName: 'Grant', name: 'Isla Grant', number: '201', groupId: 'g1' },
      { id: 't1.b', entryId: 't1', competitionId: 'c1', firstName: 'Mairi', lastName: 'Shaw', name: 'Mairi Shaw', number: '201', groupId: 'g1' },
    ])
  })

  it('give v3 the team’s entry id for a member’s hit', () => {
    const hit = (document: object) => ({ document })
    const out = asEntries({
      grouped_hits: [{ hits: [hit({ id: 't1.a', entryId: 't1', name: 'Isla Grant' }), hit({ id: 'd1', name: 'Isla Grant' })] }],
    })
    expect(out.grouped_hits[0].hits.map((h: { document: { id: string } }) => h.document.id)).toEqual(['t1', 'd1'])
    expect(out.grouped_hits[0].hits[0].document.entryId).toBeUndefined()
  })
})
