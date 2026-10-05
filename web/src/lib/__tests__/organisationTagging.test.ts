import { describe, expect, it } from 'vitest'
import { familyKey, familyName, familyTags, groupFamilies, organisationsInNames, suggest, type TagCompetition } from '../organisationTagging'

const comp = (id: string, name: string, date: string, organisations?: Record<string, boolean>): TagCompetition => ({ id, name, date, organisations })

describe('families', () => {
  it('ignores years, edition numbers and filler words', () => {
    expect(familyKey('The 39th Annual Banff Highland Games 2025')).toBe('banff highland games')
    expect(familyKey('Banff Highland Games')).toBe('banff highland games')
    expect(familyKey('2026 Foothills Spring Competition')).toBe('foothills spring competition')
    expect(familyKey('Fête des Écossais')).toBe('fete des ecossais')
  })

  it('names a family by its latest year, without the year', () => {
    expect(familyName('Foothills Fall Classic 2026')).toBe('Foothills Fall Classic')
    expect(familyName('2026: Prairie Open')).toBe('Prairie Open')
    expect(familyName('Nationals')).toBe('Nationals')
    expect(familyName('The 39th Annual Banff Highland Games')).toBe('Banff Highland Games')
  })

  it('groups the years of one competition, latest family first', () => {
    const families = groupFamilies([
      comp('a', 'Foothills Spring Competition 2024', '2024-04-20'),
      comp('b', 'Foothills Spring Competition 2026', '2026-04-18'),
      comp('c', 'Banff Highland Games 2025', '2025-08-02'),
    ])
    expect(families.map((f) => f.key)).toEqual(['foothills spring competition', 'banff highland games'])
    expect(families[0].years).toEqual([2024, 2026])
    expect(families[0].competitions.map((c) => c.id)).toEqual(['b', 'a'])
  })
})

describe('suggestions', () => {
  const orgs = [
    { id: 'fhda', name: 'Foothills Highland Dancing Association', shortName: 'FHDA' },
    { id: 'pcs', name: 'Prairie Championship Series', shortName: 'PCS' },
    { id: 'bvhg', name: 'Bow Valley Highland Games' },
  ]

  it('suggests what other years have, strongly', () => {
    const [f] = groupFamilies([
      comp('a', 'Foothills Spring Competition 2024', '2024-04-20', { fhda: true }),
      comp('b', 'Foothills Spring Competition 2025', '2025-04-19', { fhda: true }),
      comp('c', 'Foothills Spring Competition 2026', '2026-04-18'),
    ])
    expect(familyTags(f)).toEqual({ all: [], some: ['fhda'] })
    expect(suggest(f, orgs)).toEqual([{ organisationId: 'fhda', reason: 'Tagged in 2 other years', strong: true }])
  })

  it('suggests an organisation named in the competition’s name, weakly', () => {
    const [f] = groupFamilies([comp('a', 'FHDA Winter Open 2026', '2026-01-10')])
    expect(suggest(f, orgs)).toEqual([{ organisationId: 'fhda', reason: '“FHDA” is in its name', strong: false }])
    const [g] = groupFamilies([comp('b', 'Bow Valley Highland Games 2026', '2026-08-01')])
    expect(suggest(g, orgs).map((s) => s.organisationId)).toEqual(['bvhg'])
  })

  it('suggests nothing a family already has everywhere', () => {
    const [f] = groupFamilies([comp('a', 'PCS Final 2026', '2026-11-01', { pcs: true })])
    expect(suggest(f, orgs)).toEqual([])
  })
})

describe('organisations in names', () => {
  const at = (id: string, name: string, location: string) => ({ ...comp(id, name, '2026-01-01'), location })

  it('finds abbreviations and ScotDance associations not here yet, most competitions first', () => {
    const found = organisationsInNames(
      [
        at('a', 'EHDA Evelyn Gerard Jones Competition 2026', 'Edmonton, AB'),
        at('b', 'EHDA Spring Fling', 'Edmonton, AB'),
        at('c', 'W&DHDA Winter Celtic Competition', 'Tecumseh, ON'),
        at('d', 'Scotdance Alberta Open Competition', 'Edmonton, AB'),
        // Sanctioned, and FHDA's already here.
        at('e', 'FHDA Novice Showcase RSOBHD', 'Calgary, AB'),
        // All capitals: nothing to tell apart.
        at('f', 'BANFF HIGHLAND GAMES', 'Banff, AB'),
      ],
      [{ name: 'Foothills Highland Dancing Association', shortName: 'FHDA' }],
    )
    expect(found.map((o) => [o.name, o.shortName, o.location, o.competitions.map((c) => c.id)])).toEqual([
      ['EHDA', 'EHDA', 'Edmonton, AB', ['a', 'b']],
      ['ScotDance Alberta', null, 'Edmonton, AB', ['d']],
      ['W&DHDA', 'W&DHDA', 'Tecumseh, ON', ['c']],
    ])
  })
})
