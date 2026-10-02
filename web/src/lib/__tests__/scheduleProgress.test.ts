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
const progress = (results: ResultsTree, minutes = 600) =>
  scheduleProgress({ schedule, results, groupIds, date: '2026-10-03', minutes })

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

  it('before anything is posted, the first event is on once its start time has passed', () => {
    expect(progress({}, 8 * 60).events.get('pri')).toBeUndefined()
    expect(progress({}, 9 * 60).events.get('pri')).toBe('now')
  })

  it('the event with results coming in is on now; one with all its results in is done', () => {
    const partly = progress({ g1: { fling: ['x'] } })
    expect(partly.events.get('pri')).toBe('now')
    const all = progress({ g1: { fling: ['x'] }, g2: { fling: false } })
    expect(all.events.get('pri')).toBe('done')
    expect(all.events.get('beg')).toBe('now')
    // A dance-free event is never done or on.
    expect(all.events.get('ceilidh')).toBeUndefined()
  })

  it('a day that isn’t today has no "now", only what’s done', () => {
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0))
    const p = progress({ g5: { fling: ['x'] } })
    expect(p.events.get('pre')).toBe('done')
    expect(p.events.get('pri')).toBeUndefined()
  })
})
