import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  buildAppearances,
  countCompsThisYear,
  countTotalComps,
  countUniqueVenues,
  filterPast,
  filterUpcoming,
  findFirstSeen,
  findLastSeen,
  latestNonNull,
} from '@/lib/appearanceStats'
import type { Competition } from '@/types/competition'

// "Today" is 15 June 2026 for these.
beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 5, 15, 10, 0))
})
afterAll(() => {
  vi.useRealTimers()
})

const meta: Record<string, Competition | null> = {
  old: { name: 'Old', date: '2019-01-22' as unknown as number, venue: 'Spruce Meadows' },
  spring: { name: 'Spring', date: '2026-03-01' as unknown as number, venue: ' spruce meadows ' },
  today: { name: 'Today', date: '2026-06-15' as unknown as number, venue: 'Hall' },
  next: { name: 'Next', date: '2026-09-01T06:00:00.000Z' as unknown as number },
  undated: { name: 'Undated' },
}
const raw = {
  a: { competitionId: 'spring' },
  b: { competitionId: 'old' },
  c: { competitionId: 'next' },
  d: { competitionId: 'today' },
  e: { competitionId: 'undated' },
  f: { competitionId: 'spring' },
  g: { competitionId: 'gone' },
}
const list = buildAppearances(raw, meta)
const names = (xs: typeof list) => xs.map((a) => a.competition?.name ?? null)

describe('appearance stats', () => {
  it('lists newest first, with undated and unknown competitions last', () => {
    expect(names(list).slice(0, 5)).toEqual(['Next', 'Today', 'Spring', 'Spring', 'Old'])
    expect(names(list).slice(5).sort()).toEqual([null, 'Undated'].sort())
  })

  it('splits upcoming (today on) from past', () => {
    expect(names(filterUpcoming(list))).toEqual(['Today', 'Next'])
    expect(names(filterPast(list))).toEqual(['Spring', 'Spring', 'Old'])
  })

  it('counts competitions once each', () => {
    expect(countTotalComps(list)).toBe(6)
    expect(countCompsThisYear(list)).toBe(3)
    expect(countUniqueVenues(list)).toBe(2)
  })

  it('finds the first and the last one already danced', () => {
    expect(findFirstSeen(list)?.competition?.name).toBe('Old')
    expect(findLastSeen(list)?.competition?.name).toBe('Spring')
  })

  it('takes the first real value', () => {
    expect(latestNonNull([{ v: '' }, { v: null }, { v: 'Calgary' }, { v: 'Edmonton' }], (x) => x.v)).toBe('Calgary')
    expect(latestNonNull([], () => 'x')).toBeNull()
  })
})
