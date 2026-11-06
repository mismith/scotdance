import { beforeEach, describe, expect, it, vi } from 'vitest'

// No real database here: reads come from `data` (paths under the namespace).
const data: Record<string, unknown> = {}
let failing = false
vi.mock('@/firebase', () => ({ database: {} }))
vi.mock('firebase/database', () => ({
  ref: (_db: unknown, path: string) => path,
  get: async (path: string) => {
    if (failing) throw new Error('offline')
    const key = path.replace(/^[^/]+\/competitions:data\//, '')
    return { val: () => data[key] ?? null }
  },
}))

const { fetchEntrySummary } = await import('@/lib/entrySummary')

let n = 0
function seed(results: Record<string, unknown>) {
  const c = `c${(n += 1)}`
  data[`${c}/dancers/me`] = { groupId: 'g' }
  data[`${c}/groups/g`] = { name: '9 & 10 Years', categoryId: 'cat' }
  data[`${c}/categories/cat`] = { name: 'Novice' }
  data[`${c}/dances`] = {
    fling: { name: 'Highland Fling', groupIds: { g: true } },
    sword: { name: 'Sword Dance', groupIds: { g: true } },
    reel: { name: 'Reel', groupIds: { other: true } },
  }
  data[`${c}/results/g`] = results
  return c
}

beforeEach(() => {
  failing = false
})

describe('fetchEntrySummary', () => {
  it('lists the placings, best first, with the overall', async () => {
    const c = seed({
      fling: ['x', 'me:tie', 'y'],
      sword: ['reverse:3', 'me', 'y', 'x'],
      reel: ['me'],
      overall: ['y', 'me'],
    })
    expect(await fetchEntrySummary(c, 'me')).toEqual({
      groupName: 'Novice 9 & 10 Years',
      danced: [],
      placings: [
        { danceId: 'fling', name: 'Highland Fling', place: 1, tied: true },
        { danceId: 'sword', name: 'Sword Dance', place: 3, tied: false },
      ],
      overall: { place: 2, tied: false },
      overallMissed: false,
      trophyEvents: [],
    })
  })

  it('adds the trophy events their age group can win, read narrowly', () => {
    const c = seed({ fling: ['me'] })
    data[`${c}/trophyEvents`] = {
      b: { name: ' Most Points ', groupIds: { g: true }, _order: 2 },
      a: { name: 'Premier Dancer of the Day', groupIds: { g: true, other: true }, _order: 1 },
      none: { name: 'Not placed in', groupIds: { g: true }, _order: 3 },
      elsewhere: { name: 'Other groups only', groupIds: { other: true } },
    }
    data[`${c}/results/a/overall`] = ['x', 'me:tie']
    data[`${c}/results/b/overall`] = ['me']
    data[`${c}/results/none/overall`] = ['x']
    data[`${c}/results/elsewhere/overall`] = ['me']
    return fetchEntrySummary(c, 'me').then((s) => {
      expect(s?.trophyEvents).toEqual([
        { id: 'a', name: 'Premier Dancer of the Day', place: 1, tied: true },
        { id: 'b', name: 'Most Points', place: 1, tied: false },
      ])
    })
  })

  it('says when overall results are posted without them, and not when there are none', async () => {
    expect(await fetchEntrySummary(seed({ fling: ['me'], overall: ['x', 'y'] }), 'me')).toMatchObject({ overall: null, overallMissed: true })
    expect(await fetchEntrySummary(seed({ fling: ['me'] }), 'me')).toMatchObject({ overall: null, overallMissed: false })
  })

  it('has nothing for a championship start alone or "none placed"', async () => {
    const c = seed({ fling: ['reverse:6'], sword: false })
    expect(await fetchEntrySummary(c, 'me')).toMatchObject({ placings: [], overall: null })
  })

  it('lists posted dances with no place as danced, and leaves unposted ones out', async () => {
    const c = seed({ fling: ['x', 'y'], sword: ['reverse:3'] })
    expect(await fetchEntrySummary(c, 'me')).toMatchObject({
      placings: [],
      danced: [{ danceId: 'fling', name: 'Highland Fling' }],
    })
  })

  it('tries again after a failed read instead of keeping nothing', async () => {
    const c = seed({ fling: ['me'] })
    failing = true
    expect(await fetchEntrySummary(c, 'me')).toBeNull()
    failing = false
    expect((await fetchEntrySummary(c, 'me'))?.placings).toHaveLength(1)
  })
})
