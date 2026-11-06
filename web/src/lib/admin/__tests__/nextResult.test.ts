import { describe, expect, it } from 'vitest'
import { nextResult, resultsOrder, type ResultsWork } from '@/lib/admin/nextResult'
import type { ResultsTree, Schedule } from '@/types/competition'

// Two age groups: Primary (no overall) and Novice, each doing Fling and Sword.
// The schedule has Novice's Sword first, then Primary's Fling.
const groups = [
  { id: 'pri', category: { name: 'Primary' } },
  { id: 'nov', category: { name: 'Novice' } },
]
const dances = [{ id: 'fling' }, { id: 'sword' }]
const schedule = {
  days: {
    d1: {
      order: 0,
      blocks: {
        b1: {
          order: 0,
          events: {
            e1: {
              order: 0,
              dances: {
                r1: { order: 0, danceId: 'sword', platforms: { A: { orderedGroupIds: ['nov', 'gone'] } } },
                r2: { order: 1, danceId: 'fling', platforms: { A: { orderedGroupIds: ['pri'] } } },
              },
            },
          },
        },
      },
    },
  },
} as unknown as Schedule

const work = (results: ResultsTree = {}, s: Schedule | null = schedule): ResultsWork => ({
  groups,
  dancesOf: () => dances,
  results,
  schedule: s,
  platforms: [{ id: 'A', name: 'A' }],
})
const keys = (w: ResultsWork) => resultsOrder(w).map((s) => `${s.groupId}:${s.danceId}`)

describe('resultsOrder', () => {
  it('follows the schedule, callbacks first, then the rest by age group, overalls last', () => {
    expect(keys(work())).toEqual([
      'nov:callbacks',
      'nov:sword',
      'pri:callbacks',
      'pri:fling',
      'pri:sword',
      'nov:fling',
      'nov:overall',
    ])
  })

  it('goes by age group when there’s no schedule', () => {
    expect(keys(work({}, null))).toEqual(['pri:callbacks', 'pri:fling', 'pri:sword', 'nov:callbacks', 'nov:fling', 'nov:sword', 'nov:overall'])
  })
})

describe('trophy events', () => {
  const withTrophyEvents = (results: ResultsTree = {}, s: Schedule | null = schedule): ResultsWork => ({ ...work(results, s), trophyEvents: [{ id: 'dotd' }, { id: 'pts' }] })

  it('come after every age group, in their own order', () => {
    expect(keys(withTrophyEvents()).slice(-3)).toEqual(['nov:overall', 'dotd:overall', 'pts:overall'])
    expect(keys(withTrophyEvents({}, null)).slice(-3)).toEqual(['nov:overall', 'dotd:overall', 'pts:overall'])
  })

  it('are what is next once the age groups are in', () => {
    const all = { pri: { callbacks: ['a'], fling: ['a'], sword: ['a'] }, nov: { callbacks: ['b'], fling: ['b'], sword: ['b'], overall: ['b'] } }
    expect(nextResult(withTrophyEvents(all))).toEqual({ groupId: 'dotd', danceId: 'overall' })
    expect(nextResult(withTrophyEvents({ ...all, dotd: { overall: ['b'] } }))).toEqual({ groupId: 'pts', danceId: 'overall' })
    // “None placed” counts as entered.
    expect(nextResult(withTrophyEvents({ ...all, dotd: { overall: ['b'] }, pts: { overall: false } }))).toBeNull()
  })

  it('never have callbacks', () => {
    expect(keys(withTrophyEvents()).filter((k) => k.startsWith('dotd') || k.startsWith('pts'))).toEqual(['dotd:overall', 'pts:overall'])
  })
})

describe('danced trophy events', () => {
  // A Trophy Fling on platform A after Novice's Sword: only some dance it.
  const withFling = (id: string, results: ResultsTree = {}): ResultsWork => ({
    ...work(results),
    trophyEvents: [{ id, danceId: 'sword' }, { id: 'dotd' }],
    schedule: {
      days: {
        d1: {
          order: 0,
          blocks: {
            b1: {
              order: 0,
              events: {
                e1: {
                  order: 0,
                  dances: {
                    r1: { order: 0, danceId: 'sword', platforms: { A: { orderedGroupIds: ['nov', id] } } },
                    r2: { order: 1, danceId: 'fling', platforms: { A: { orderedGroupIds: ['pri', id] } } },
                  },
                },
              },
            },
          },
        },
      },
    } as unknown as Schedule,
  })

  it('are entered where the schedule has them, callbacks first, as an age group’s dance', () => {
    // (Not under the Fling row: it isn’t danced there.)
    expect(keys(withFling('tf')).slice(0, 5)).toEqual(['nov:callbacks', 'nov:sword', 'tf:callbacks', 'tf:overall', 'pri:callbacks'])
    expect(keys(withFling('tf')).filter((k) => k.startsWith('tf'))).toEqual(['tf:callbacks', 'tf:overall'])
  })

  it('carry on from callbacks to the placings, then the rest', () => {
    expect(nextResult(withFling('tf', { nov: { callbacks: ['b'], sword: ['b'] } }))).toEqual({ groupId: 'tf', danceId: 'callbacks' })
    expect(nextResult(withFling('tf', { nov: { callbacks: ['b'], sword: ['b'] }, tf: { callbacks: ['b'] } }))).toEqual({ groupId: 'tf', danceId: 'overall' })
    // Marked “No callbacks” counts as entered.
    expect(nextResult(withFling('tf', { nov: { callbacks: ['b'], sword: ['b'] }, tf: { callbacks: false, overall: ['b'] } }))).toEqual({ groupId: 'pri', danceId: 'callbacks' })
  })

  it('are not entered at the end as well', () => {
    expect(keys(withFling('tf')).filter((k) => k === 'tf:overall')).toHaveLength(1)
    expect(keys(withFling('tf')).slice(-2)).toEqual(['nov:overall', 'dotd:overall'])
  })
})

describe('nextResult', () => {
  it('is the first thing not entered, skipping “none placed”', () => {
    expect(nextResult(work({ nov: { callbacks: ['x'], sword: false } }))).toEqual({ groupId: 'pri', danceId: 'callbacks' })
  })

  it('skips an age group’s callbacks once its placings are going in', () => {
    expect(nextResult(work({ nov: { sword: ['x'] } }))).toEqual({ groupId: 'pri', danceId: 'callbacks' })
  })

  it('is nothing once everything is in', () => {
    const all = { pri: { callbacks: ['a'], fling: ['a'], sword: ['a'] }, nov: { callbacks: ['b'], fling: ['b'], sword: ['b'], overall: ['b'] } }
    expect(nextResult(work(all))).toBeNull()
  })
})
