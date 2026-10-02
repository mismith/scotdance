import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clockMinutes, scheduleProgress } from '@/lib/scheduleProgress'
import type { ResultsTree, Schedule } from '@/types/competition'

describe('clockMinutes', () => {
  it('reads the times organisers write', () => {
    expect(clockMinutes('8:30 am')).toBe(510)
    expect(clockMinutes('Starts 1 pm')).toBe(780)
    expect(clockMinutes('12:15 p.m.')).toBe(735)
    expect(clockMinutes('12 am')).toBe(0)
    expect(clockMinutes('13:00')).toBe(780)
    expect(clockMinutes('After lunch')).toBeNull()
  })
})

// Day 1: Morning (8:30 am) with Primary then Beginner, a Ceilidh (no dances);
// day 2: Premier. Each event: one dance on one platform, two age groups.
const event = (order: number, groups: string[]) => ({
  order,
  dances: { d: { danceId: 'fling', platforms: { a: { orderedGroupIds: groups } } } },
})
const schedule: Schedule = {
  days: {
    day1: {
      order: 0,
      blocks: {
        b1: {
          order: 0,
          description: '8:30 am',
          events: { pri: event(0, ['g1', 'g2', '1546']), beg: event(1, ['g3', 'g4']), ceilidh: { order: 2, name: 'Ceilidh' } },
        },
      },
    },
    day2: { order: 1, blocks: { b2: { order: 0, events: { pre: event(0, ['g5']) } } } },
  },
}
const groupIds = new Set(['g1', 'g2', 'g3', 'g4', 'g5'])
const progress = (results: ResultsTree) => scheduleProgress({ schedule, results, groupIds, date: '2026-10-03' })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 3, 10, 0))
})
afterEach(() => vi.useRealTimers())

describe('scheduleProgress', () => {
  it('names today and tomorrow', () => {
    const p = progress({})
    expect(p.dayOffset.get('day1')).toBe(0)
    expect(p.dayOffset.get('day2')).toBe(1)
  })

  it('counts results per event, skipping spacers', () => {
    expect(progress({ g1: { fling: ['x'] } }).counts.get('pri')).toEqual({ posted: 1, total: 2 })
  })

  it('never guesses what’s on: only results decide, and an event is done once they’re all in', () => {
    // Past the start time, with nothing posted: nothing is marked.
    expect(progress({}).events.size).toBe(0)
    const partly = progress({ g1: { fling: ['x'] } })
    expect(partly.events.get('pri')).toBeUndefined()
    expect(partly.counts.get('pri')).toEqual({ posted: 1, total: 2 })
    const all = progress({ g1: { fling: ['x'] }, g2: { fling: false } })
    expect(all.events.get('pri')).toBe('done')
    expect(all.events.get('beg')).toBeUndefined()
    // A dance-free event is never done.
    expect(all.events.get('ceilidh')).toBeUndefined()
  })

  it('any day’s events can be done, not just today’s', () => {
    expect(progress({ g5: { fling: ['x'] } }).events.get('pre')).toBe('done')
  })
})
