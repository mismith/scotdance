import { describe, expect, it } from 'vitest'
import { calledBackIds, enrichTrophyEvents, isDanced, openToText, trophyEventEntrants, trophyEventsFor, turnResultId } from '@/lib/trophyEvents'

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

describe('enrichTrophyEvents', () => {
  it('adds its age groups in list order and a name to show', () => {
    const [a] = enrichTrophyEvents([{ id: 'a', groupIds: { p3: true, p1: true } }], groups, categories)
    expect(a.groups.map((g) => g.id)).toEqual(['p1', 'p3'])
    expect(a.fullName).toBe('Untitled trophy event')
    expect(a.openTo).toBe('Premier 12 & Under 14, 16 & Over')
  })
})

describe('trophyEventsFor', () => {
  it('finds the trophy events an age group can win', () => {
    const list = [{ id: 'a', groupIds: { p1: true } }, { id: 'b', groupIds: { i1: true } }]
    expect(trophyEventsFor(list, 'p1').map((a) => a.id)).toEqual(['a'])
    expect(trophyEventsFor(list, null)).toEqual([])
  })
})

describe('danced trophy events', () => {
  const dancers = [
    { id: 'e1', groupId: 'p1' },
    { id: 'e2', groupId: 'p2' },
    { id: 'e3', groupId: 'i1' },
  ]
  const fling = { id: 't', groupIds: { p1: true, p2: true }, danceId: 'fling' }

  it('is danced by everyone it’s open to until its callbacks are in, then by those called back', () => {
    expect(trophyEventEntrants(fling, dancers, {}).map((d) => d.id)).toEqual(['e1', 'e2'])
    expect(calledBackIds(fling, {})).toBeNull()
    const results = { t: { callbacks: ['e2', 'e3'] } }
    // e3 can't win it (Intermediate), so isn't dancing it either.
    expect(trophyEventEntrants(fling, dancers, results).map((d) => d.id)).toEqual(['e2'])
    // Marked "No callbacks": everyone dances it.
    expect(trophyEventEntrants(fling, dancers, { t: { callbacks: false } }).map((d) => d.id)).toEqual(['e1', 'e2'])
  })
  it('has no callbacks when it isn\'t danced', () => {
    expect(calledBackIds({ id: 't' }, { t: { callbacks: ['e1'] } })).toBeNull()
    expect(isDanced({ danceId: 'fling' })).toBe(true)
  })
  it('fills its one list from any schedule turn', () => {
    const ids = new Set(['t'])
    expect(turnResultId('t', 'fling', ids)).toBe('overall')
    expect(turnResultId('p1', 'fling', ids)).toBe('fling')
  })
})
