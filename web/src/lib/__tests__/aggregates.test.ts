import { describe, expect, it } from 'vitest'
import { aggregatesFor, enrichAggregates, openToText } from '@/lib/aggregates'

const categories = [
  { id: 'p', name: 'Premier' },
  { id: 'i', name: 'Intermediate' },
  { id: 'b', name: 'Beginner' },
]
const groups = [
  { id: 'p1', categoryId: 'p', name: '12 & Under 14' },
  { id: 'p2', categoryId: 'p', name: '14 & Under 16' },
  { id: 'p3', categoryId: 'p', name: '16 & Over' },
  { id: 'i1', categoryId: 'i', name: '12 & Under 14' },
  { id: 'i2', categoryId: 'i', name: '14 & Over' },
  { id: 'b1', categoryId: 'b', name: '' },
]

describe('openToText', () => {
  it('names a whole category alone', () => {
    expect(openToText({ p1: true, p2: true, p3: true }, groups, categories)).toBe('All Premier')
  })
  it('lists part of a category after its name', () => {
    expect(openToText({ p2: true, p3: true }, groups, categories)).toBe('Premier 14 & Under 16, 16 & Over')
  })
  it('keeps categories apart, in list order', () => {
    expect(openToText({ i1: true, p1: true, p2: true, p3: true }, groups, categories)).toBe('All Premier · Intermediate 12 & Under 14')
  })
  it('says a one-group category by its name', () => {
    expect(openToText({ b1: true }, groups, categories)).toBe('Beginner')
  })
  it('ignores age groups that are gone, and is empty with none on', () => {
    expect(openToText({ gone: true }, groups, categories)).toBe('')
    expect(openToText(undefined, groups, categories)).toBe('')
  })
})

describe('enrichAggregates', () => {
  it('adds its age groups in list order and a name to show', () => {
    const [a] = enrichAggregates([{ id: 'a', groupIds: { p3: true, p1: true } }], groups, categories)
    expect(a.groups.map((g) => g.id)).toEqual(['p1', 'p3'])
    expect(a.fullName).toBe('Untitled aggregate')
    expect(a.openTo).toBe('Premier 12 & Under 14, 16 & Over')
  })
})

describe('aggregatesFor', () => {
  it('finds the aggregates an age group can win', () => {
    const list = [{ id: 'a', groupIds: { p1: true } }, { id: 'b', groupIds: { i1: true } }]
    expect(aggregatesFor(list, 'p1').map((a) => a.id)).toEqual(['a'])
    expect(aggregatesFor(list, null)).toEqual([])
  })
})
