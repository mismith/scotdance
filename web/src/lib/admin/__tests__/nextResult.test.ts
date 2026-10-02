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
