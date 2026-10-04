import { describe, expect, it, vi } from 'vitest'
import { blocks, dances, dayLabel, days, events, idList, isSpacerId, platformLabel, slugline, toOrderedArray } from '@/lib/schedule'
import { forEachScheduleDance } from '@/lib/admin/scheduleTree'
import type { Schedule } from '@/types/competition'

// Keep Firebase (and its connection) out of unit tests.
vi.mock('@/firebase', async () => (await import('@/components/admin/schedule/__tests__/fakeDb')).firebaseMock)
vi.mock('@/lib/offline', async () => (await import('@/components/admin/schedule/__tests__/fakeDb')).offlineMock)

const weekday = (y: number, m: number, d: number) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(y, m - 1, d))

describe('platformLabel (as the old app showed platforms)', () => {
  it.each([
    ['B', 'Platform B'],
    [' B ', 'Platform B'],
    ['Platform B', 'Platform B'],
    ['platform  2', 'Platform 2'],
    ['Platform', 'Platform'],
    ['Platforms A & B', 'Platform Platforms A & B'],
    ['Platforms', 'Platform Platforms'],
    ['Main Platform', 'Main Platform'],
    ['main platform', 'main platform'],
    ['Main Dancing Platform', 'Main Dancing Platform'],
    ['Main Platforms', 'Platform Main Platforms'],
    ['=Main hall', 'Main hall'],
    ['= Stage ', 'Stage'],
    ['🎪', 'Platform 🎪'],
    ['', ''],
    [undefined, ''],
    [null, ''],
  ])('%j → %j', (name, label) => {
    expect(platformLabel(name)).toBe(label)
  })
})

describe('dayLabel', () => {
  it('uses the name, else the weekday of the date, else the day number', () => {
    expect(dayLabel({ name: ' Saturday ' }, 0)).toBe('Saturday')
    expect(dayLabel({ date: '2026-10-04' }, 1)).toBe(weekday(2026, 10, 4))
    expect(dayLabel({ date: '2018-07-02T06:00:00.000Z' }, 0)).toBe(
      new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date('2018-07-02T06:00:00.000Z')),
    )
    expect(dayLabel({}, 2)).toBe('Day 3')
    expect(dayLabel({ name: '  ', date: '' }, 0)).toBe('Day 1')
  })

  it('doesn’t fail on a date it can’t read', () => {
    expect(dayLabel({ date: 'next Saturday' }, 1)).toBe('Day 2')
  })
})

describe('ordering', () => {
  it('sorts by order, by key when any sibling lacks one, and skips non-objects', () => {
    const rec = {
      '-Lc': { order: 0 },
      '-La': { order: 2 },
      '-Lb': { order: 1 },
    }
    expect(toOrderedArray(rec).map((x) => x.id)).toEqual(['-Lc', '-Lb', '-La'])
    expect(toOrderedArray({ '-Lb': {}, '-La': {}, '-LB': {} }).map((x) => x.id)).toEqual(['-LB', '-La', '-Lb'])
    expect(toOrderedArray({ x: 'stray', '-La': {} } as unknown as Record<string, Record<string, unknown>>).map((x) => x.id)).toEqual(['-La'])
    expect(toOrderedArray(null)).toEqual([])
  })

  it('walks days › blocks › events › dances', () => {
    const s: Schedule = {
      days: {
        d2: { order: 1, blocks: {} },
        d1: { order: 0, blocks: { b1: { name: 'Morning', events: { e1: { name: 'Primary', dances: { r2: { order: 1 }, r1: { order: 0 } } } } } } },
      },
    }
    const [d1] = days(s)
    expect(days(s).map((d) => d.id)).toEqual(['d1', 'd2'])
    const [b1] = blocks(d1)
    const [e1] = events(b1)
    expect(dances(e1).map((r) => r.id)).toEqual(['r1', 'r2'])
    expect(days(null)).toEqual([])
  })
})

describe('platform lists', () => {
  it('reads every stored shape as a list of id strings', () => {
    expect(idList(['a', 'b'])).toEqual(['a', 'b'])
    expect(idList([1575433498638, 'a'])).toEqual(['1575433498638', 'a'])
    expect(idList({ 1: 'b', 0: 'a' })).toEqual(['a', 'b'])
    expect(idList([null, 'a', '', undefined])).toEqual(['a'])
    expect(idList(undefined)).toEqual([])
    expect(idList('a')).toEqual([])
  })

  it('gives schedule dances clean platform lists, whatever was stored', () => {
    const [row] = dances({
      dances: {
        r1: {
          danceId: 'd1',
          platforms: {
            pA: { orderedGroupIds: { 0: 'g1', 2: 'g2' } as unknown as string[], orderedJudgeIds: undefined },
            pB: { orderedGroupIds: ['g3', 1575433498638 as unknown as string] },
            pC: null as unknown as { orderedGroupIds: string[] },
          },
        },
      },
    })
    expect(row.platforms).toEqual({
      pA: { orderedGroupIds: ['g1', 'g2'], orderedJudgeIds: [] },
      pB: { orderedGroupIds: ['g3', '1575433498638'], orderedJudgeIds: [] },
    })
    expect(isSpacerId(row.platforms!.pB.orderedGroupIds![1])).toBe(true)
  })
})

describe('slugline', () => {
  // (Plain text goes through DOMPurify differently under happy-dom than in a
  // browser; the e2e tests cover it.)
  it('takes the first line of text without its tags', () => {
    expect(slugline('<p>8:30 am</p><p>Doors open</p>')).toBe('8:30 am')
    expect(slugline(undefined)).toBe('')
  })
})

describe('forEachScheduleDance', () => {
  it('visits every dance with its path, across days', () => {
    const seen: string[] = []
    forEachScheduleDance(
      {
        days: {
          d1: { blocks: { b1: { events: { e1: { dances: { r1: { danceId: 'x' }, r2: { name: 'Results' } } } } } } },
          d2: { blocks: { b2: { events: { e2: {} } } } },
        },
      },
      (path) => seen.push(path),
    )
    expect(seen).toEqual([
      'schedule/days/d1/blocks/b1/events/e1/dances/r1',
      'schedule/days/d1/blocks/b1/events/e1/dances/r2',
    ])
    expect(() => forEachScheduleDance(null, () => {})).not.toThrow()
  })
})
