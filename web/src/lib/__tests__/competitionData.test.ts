import { beforeEach, describe, expect, it, vi } from 'vitest'

// The competition's sections as the screens use them, read once or streamed
// on competition day. Firebase is stubbed: values come from `db` below.

const db: Record<string, unknown> = {}
const listeners = new Map<string, Array<(snap: { val: () => unknown }) => void>>()
let failReads = 0

vi.mock('@/firebase', () => ({ database: {} }))
vi.mock('firebase/database', () => ({ ref: (_db: unknown, path: string) => ({ path }) }))
vi.mock('@/lib/offline', () => ({
  onReconnect: () => {},
  getSaved: async (r: { path: string }) => {
    if (failReads > 0) {
      failReads--
      throw new Error('permission_denied')
    }
    return { val: () => db[section(r.path)] ?? null }
  },
  onValueSaved: (r: { path: string }, cb: (snap: { val: () => unknown }) => void) => {
    const key = section(r.path)
    listeners.set(key, [...(listeners.get(key) ?? []), cb])
    return () => listeners.set(key, (listeners.get(key) ?? []).filter((x) => x !== cb))
  },
}))
// competitions:data/{id}/{section} → section
const section = (path: string) => path.split('/').slice(-1)[0]
const push = (key: string, value: unknown) => {
  db[key] = value
  for (const cb of listeners.get(key) ?? []) cb({ val: () => value })
}

const data = await import('@/lib/competitionData')

let n = 0
const id = () => `c${++n}` // a fresh competition each test: the caches are per id

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k]
  listeners.clear()
  failReads = 0
})

describe('ordering helpers', () => {
  it('compares push ids byte by byte, as Firebase orders them', () => {
    expect(['-LEgsiq', '-LEgsT0', '-LEgsa'].sort(data.compareKeys)).toEqual(['-LEgsT0', '-LEgsa', '-LEgsiq'])
  })

  it('puts dragged items first, then the rest by creation', () => {
    const items = [{ id: 'b' }, { id: 'a', _order: 1 }, { id: 'c', _order: 0 }, { id: 'a0' }]
    expect(items.sort(data.byDragOrder).map((i) => i.id)).toEqual(['c', 'a', 'a0', 'b'])
  })

  it('reads a keyed list, and nothing for anything else', () => {
    expect(data.snapshotToArray({ x: { name: 'X' } })).toEqual([{ id: 'x', name: 'X' }])
    expect(data.snapshotToArray(null)).toEqual([])
    expect(data.snapshotToArray(false as never)).toEqual([])
  })
})

describe('fetchDancers', () => {
  it('names, numbers and groups each dancer', async () => {
    db.categories = { cB: { name: 'Beginner', _order: 1 }, cP: { name: 'Primary', _order: 0 } }
    db.groups = { g1: { name: '7 & 8', categoryId: 'cB' }, g0: { name: 'Under 7', categoryId: 'cP', _order: 0 } }
    db.dancers = {
      d1: { firstName: 'Isla', lastName: 'Ross', number: '107', groupId: 'g1' },
      d2: { firstName: 'Ava', number: 'abc', groupId: 'missing' },
      d3: { number: '5' }, // no name: a blank row from an import
      d4: { firstName: 'Ó Briain', lastName: '', number: 12 },
    }
    const b = await data.fetchDancers(id())
    expect(b.dancers.map((d) => [d.id, d.fullName, d.number, d.group?.fullName])).toEqual([
      ['d1', 'Isla Ross', 107, 'Beginner 7 & 8'],
      ['d2', 'Ava', undefined, undefined],
      ['d4', 'Ó Briain', 12, undefined],
    ])
    expect(b.groups.map((g) => g.id)).toEqual(['g0', 'g1'])
    expect(b.categories.map((c) => c.id)).toEqual(['cP', 'cB'])
  })

  it('shares one read per competition, and retries after a failure', async () => {
    const c = id()
    failReads = 1
    await expect(data.fetchDancers(c)).rejects.toThrow('permission_denied')
    db.dancers = { d1: { firstName: 'Isla' } }
    const [a, b] = await Promise.all([data.fetchDancers(c), data.fetchDancers(c)])
    expect(a).toBe(b)
    expect(a.dancers).toHaveLength(1)
  })
})

describe('fetchSchedule and fetchResults', () => {
  it('tells a hidden schedule (false) from one not made yet (null)', async () => {
    db.schedule = false
    expect(await data.fetchSchedule(id())).toMatchObject({ schedule: null, hidden: true, draws: {} })
    delete db.schedule
    expect(await data.fetchSchedule(id())).toMatchObject({ schedule: null, hidden: false })
  })

  it('tells hidden results from none yet, and names dances with their steps', async () => {
    db.results = false
    db.dances = { d2: { name: 'Sword Dance', steps: '2&1', _order: 1 }, d1: { name: 'Fling', steps: 4, _order: 0 } }
    const r = await data.fetchResults(id())
    expect(r.hidden).toBe(true)
    expect(r.results).toEqual({})
    expect(r.dances.map((d) => d.fullName)).toEqual(['Fling (4)', 'Sword Dance (2&1)'])
    db.results = { g1: { d1: ['x'] } }
    expect((await data.fetchResults(id())).hidden).toBe(false)
  })
})

describe('watch*', () => {
  it('calls back once every section has arrived, then on each change, and refreshes the cache', async () => {
    const c = id()
    const seen: string[][] = []
    const off = data.watchDancers(c, (b) => seen.push(b.dancers.map((d) => d.fullName)))
    push('dancers', { d1: { firstName: 'Isla', groupId: 'g1' } })
    push('groups', { g1: { name: '7 & 8' } })
    expect(seen).toEqual([])
    push('categories', null)
    expect(seen).toEqual([['Isla']])
    // A late entry on the day.
    push('dancers', { d1: { firstName: 'Isla', groupId: 'g1' }, d2: { firstName: 'Late', groupId: 'g1' } })
    expect(seen.at(-1)).toEqual(['Isla', 'Late'])
    expect((await data.fetchDancers(c)).dancers).toHaveLength(2)
    off()
    push('dancers', {})
    expect(seen).toHaveLength(2)
  })

  it('streams the schedule with its draws', () => {
    const got: Array<{ hidden: boolean; draws: unknown }> = []
    data.watchSchedule(id(), (b) => got.push({ hidden: b.hidden, draws: b.draws }))
    push('schedule', { days: {} })
    push('platforms', { pA: { name: 'A' } })
    push('draws', { g1: { d1: ['107', '108'] } })
    push('draws', { g1: { d1: ['108', '107'] } })
    expect(got).toEqual([
      { hidden: false, draws: { g1: { d1: ['107', '108'] } } },
      { hidden: false, draws: { g1: { d1: ['108', '107'] } } },
    ])
  })
})
