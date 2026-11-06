import { describe, expect, it } from 'vitest'
import { resultsCount } from '@/lib/resultsCount'
import type { EnrichedDance, EnrichedGroup, ResultsTree } from '@/types/competition'

const group = (id: string, name = '9 & 10 Years'): EnrichedGroup => ({ id, name, categoryId: 'c', category: { id: 'c', name: 'Novice' }, fullName: `Novice ${name}` })
const dance = (id: string): EnrichedDance => ({ id, name: id, fullName: id, groupIds: { g1: true } })

describe('resultsCount', () => {
  const groups = [group('g1')]
  const dances = [dance('fling')]

  it('counts dances and Overall', () => {
    expect(resultsCount(groups, dances, { g1: { fling: ['a'] } })).toEqual({ posted: 1, total: 2 })
  })

  it('counts each aggregate once, posted when it has placings or none placed', () => {
    const aggregates = [{ id: 'a1', groupIds: { g1: true } }, { id: 'a2', groupIds: { g1: true } }, { id: 'a3', groupIds: { g1: true } }]
    const results: ResultsTree = { g1: { fling: ['a'], overall: ['a'] }, a1: { overall: ['a'] }, a2: { overall: false }, a3: { overall: ['reverse:3'] } }
    expect(resultsCount(groups, dances, results, aggregates)).toEqual({ posted: 4, total: 5 })
  })

  it('doesn’t wait on an aggregate nobody can win yet', () => {
    const aggregates = [{ id: 'a1', groupIds: { g1: true } }, { id: 'a2' }, { id: 'a3', groups: [] }]
    expect(resultsCount(groups, dances, { a1: { overall: ['a'] } }, aggregates)).toEqual({ posted: 1, total: 3 })
  })
})
