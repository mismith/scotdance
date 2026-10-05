import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive, ref } from 'vue'

// Home's cards: which competition leads each followed dancer's card, read
// without fetching every competition they've ever entered.

vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date(2026, 9, 5, 10, 30))

const aggregates: Record<string, unknown> = {}
const recent: Record<string, unknown> = {}
const older: Record<string, unknown> = {}
const metaReads = vi.fn()
const entryReads = vi.fn()

vi.mock('@/firebase', () => ({ dataRef: (path: string) => ({ path }) }))
vi.mock('firebase/database', () => ({ child: (p: { path: string }, k: string) => ({ path: `${p.path}/${k}` }) }))
vi.mock('@/lib/offline', () => ({
  onReconnect: () => {},
  getSaved: async (r: { path: string }) => ({ val: () => aggregates[r.path.split('/').at(-1)!] ?? null }),
}))
vi.mock('@/lib/competitionMeta', () => ({
  fetchCompetitionMeta: async (id: string) => {
    metaReads(id)
    return older[id] ?? recent[id] ?? null
  },
}))
vi.mock('@/composables/useCompetitions', () => ({
  ensureCompetitionsList: async () => {},
  peekCompetition: (id: string) => recent[id] ?? null,
}))
vi.mock('@/stores/me', () => ({
  useMeStore: () => reactive({ isAdmin: false, managedCompetitionIds: [], hasCompetitionPerm: () => false }),
}))
vi.mock('@/lib/competitionData', () => {
  const stop = () => () => {}
  return {
    fetchEntries: async (cid: string, personId: string) => {
      entryReads(cid, personId)
      return { dancers: [{ id: `e-${cid}`, fullName: 'Isla Ross', dancerId: personId }], groups: [], categories: [] }
    },
    fetchResults: async () => ({ dances: [], results: {}, points: {}, hidden: false }),
    fetchSchedule: async () => ({ schedule: null, platforms: [], draws: {}, hidden: false }),
    watchEntries: stop,
    watchResults: stop,
    watchSchedule: stop,
  }
})

const { useDancerCards } = await import('@/composables/useDancerCards')

const entered = (...competitionIds: string[]) => ({
  name: 'Isla Ross',
  appearances: Object.fromEntries(competitionIds.map((c) => [`${c}:e-${c}`, { competitionId: c, dancerId: `e-${c}` }])),
})
const competition = (name: string, date: string) => ({ name, date, published: true })

function cardsFor(id: string) {
  const scope = effectScope()
  const { cards } = scope.run(() => useDancerCards(ref([{ id, name: 'Isla Ross' }])))!
  return { cards, stop: () => scope.stop() }
}

beforeEach(() => {
  for (const o of [aggregates, recent, older]) for (const k of Object.keys(o)) delete o[k]
  metaReads.mockClear()
  entryReads.mockClear()
})
afterAll(() => vi.useRealTimers())

describe('useDancerCards', () => {
  it('leads with what the recent list has, without reading older competitions', async () => {
    aggregates.a1 = entered('old', 'last-month', 'next-month')
    older.old = competition('Old', '2025-06-01')
    recent['last-month'] = competition('Last month', '2026-09-20')
    recent['next-month'] = competition('Next month', '2026-11-01')
    const { cards, stop } = cardsFor('a1')
    await vi.waitFor(() => expect(cards.value[0]?.focus?.competitionId).toBe('next-month'))
    expect(metaReads).not.toHaveBeenCalled()
    stop()
  })

  it('reads only the followed dancer’s own entries for their day', async () => {
    aggregates.a3 = entered('next-month')
    recent['next-month'] = competition('Next month', '2026-11-01')
    const { cards, stop } = cardsFor('a3')
    await vi.waitFor(() => expect(cards.value[0]?.focus?.days).toHaveLength(1))
    expect(entryReads.mock.calls).toEqual([['next-month', 'a3']])
    stop()
  })

  it('reads older competitions only for someone who hasn’t competed lately', async () => {
    aggregates.a2 = entered('2024', '2025')
    older['2024'] = competition('2024', '2024-05-01')
    older['2025'] = competition('2025', '2025-06-01')
    const { cards, stop } = cardsFor('a2')
    await vi.waitFor(() => expect(cards.value[0]?.focus?.competitionId).toBe('2025'))
    expect(metaReads.mock.calls.map(([id]) => id).sort()).toEqual(['2024', '2025'])
    stop()
  })
})
