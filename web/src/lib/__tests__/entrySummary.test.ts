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
      placings: [
        { danceId: 'fling', name: 'Highland Fling', place: 1, tied: true },
        { danceId: 'sword', name: 'Sword Dance', place: 3, tied: false },
      ],
      overall: { place: 2, tied: false },
    })
  })

  it('has nothing for a championship start alone or "none placed"', async () => {
    const c = seed({ fling: ['reverse:6'], sword: false })
    expect(await fetchEntrySummary(c, 'me')).toMatchObject({ placings: [], overall: null })
  })

  it('tries again after a failed read instead of keeping nothing', async () => {
    const c = seed({ fling: ['me'] })
    failing = true
    expect(await fetchEntrySummary(c, 'me')).toBeNull()
    failing = false
    expect((await fetchEntrySummary(c, 'me'))?.placings).toHaveLength(1)
  })
})
