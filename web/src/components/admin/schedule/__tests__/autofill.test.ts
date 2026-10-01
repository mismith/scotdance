import { describe, expect, it, vi } from 'vitest'
import { flush, sampleData, setup } from './harness'
import type { SSchedule } from '../builder'
import { blocks, dances, days, events } from '@/lib/schedule'

vi.mock('firebase/database', async () => (await import('./fakeDb')).firebaseDatabase)
vi.mock('@/firebase', async () => (await import('./fakeDb')).firebaseMock)
vi.mock('@/lib/offline', async () => (await import('./fakeDb')).offlineMock)
vi.mock('@/lib/competitionMeta', () => ({ forgetCompetitionMeta: () => {} }))
vi.mock('@/composables/useCompetitions', () => ({ forgetCompetitionsList: () => {} }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ uid: 'u1' }) }))
vi.mock('@/stores/me', () => ({ useMeStore: () => ({ hasCompetitionPerm: () => true }) }))

/** The day's sessions › events › rows, as the public pages read them. */
function outline(s: SSchedule | null, dayIndex = 0) {
  const day = days(s)[dayIndex]
  return blocks(day).map((b) => ({
    name: b.name,
    events: events(b).map((e) => ({
      name: e.name,
      description: e.description,
      rows: dances(e).map((r) => ({
        dance: r.danceId,
        cells: Object.fromEntries(
          Object.entries(r.platforms ?? {}).map(([p, c]) => [p, [...c.orderedGroupIds!, ...c.orderedJudgeIds!]]),
        ),
      })),
    })),
  }))
}

describe('autofill the schedule', () => {
  it('builds a morning and afternoon from the categories, in one change', async () => {
    const t = setup(sampleData())
    const change = await t.auto.fillSchedule()
    expect(change).toBeTypeOf('number')
    expect(outline(t.m.schedule.value)).toEqual([
      {
        name: 'Morning',
        events: [
          { name: 'Registration', description: '9:00 am', rows: [] },
          {
            name: 'Primary',
            description: undefined,
            rows: [
              // Judges A–Z (Fraser, Robertson, Wardrope), moving along a platform each dance.
              { dance: 'dFling', cells: { pA: ['gP6', 'jFra'], pB: ['gP7', 'jRob'] } },
              { dance: 'dPas', cells: { pA: ['gP6', 'jWar'], pB: ['gP7', 'jFra'] } },
            ],
          },
          { name: 'Results', description: undefined, rows: [] },
        ],
      },
      {
        name: 'Afternoon',
        events: [
          { name: 'Registration', description: '1:00 pm', rows: [] },
          {
            name: 'Beginner',
            description: undefined,
            rows: [
              { dance: 'dFling', cells: { pA: ['gB8', 'jFra'], pB: ['gB9', 'jRob'] } },
              { dance: 'dSword', cells: { pA: ['gB8', 'jWar'], pB: ['gB9', 'jFra'] } },
            ],
          },
          { name: 'Results', description: undefined, rows: [] },
        ],
      },
    ])
    // One undo takes it all back.
    await t.m.undoChange(change!)
    expect(t.stored()).toBeNull()
  })

  it('replaces the sessions of the day showing, and only that day', async () => {
    const schedule: SSchedule = {
      days: {
        '-Lsat': { name: 'Saturday', order: 0, blocks: { '-Lold': { name: 'Old', order: 0 } } },
        '-Lsun': { name: 'Sunday', order: 1, blocks: { '-Lkeep': { name: 'Keep', order: 0 } } },
      },
    }
    const t = setup(sampleData(schedule), { dayId: '-Lsat' })
    await t.auto.fillSchedule()
    const s = t.m.schedule.value!
    expect(blocks(days(s)[0]).map((b) => b.name)).toEqual(['Morning', 'Afternoon'])
    expect(blocks(days(s)[1]).map((b) => b.name)).toEqual(['Keep'])
    expect(s.days!['-Lsat'].name).toBe('Saturday')
  })

  it('does nothing without categories', async () => {
    const data = sampleData()
    delete data.categories
    const t = setup(data)
    expect(await t.auto.fillSchedule()).toBeNull()
    expect(t.stored()).toBeNull()
  })

  it('makes sessions but no cells without platforms or judges', async () => {
    const data = sampleData()
    delete data.platforms
    delete data.staff
    const t = setup(data)
    await t.auto.fillSchedule()
    const o = outline(t.m.schedule.value)
    expect(o.map((b) => b.name)).toEqual(['Morning', 'Afternoon'])
    expect(o[0].events[1].rows).toEqual([
      { dance: 'dFling', cells: {} },
      { dance: 'dPas', cells: {} },
    ])
  })

  it('handles one category (no afternoon) and age groups without a category', async () => {
    const data = sampleData()
    data.categories = { cPri: { name: 'Primary' } }
    data.groups!.gStray = { name: 'Adult', categoryId: '-Deleted' }
    const t = setup(data)
    await t.auto.fillSchedule()
    const o = outline(t.m.schedule.value)
    expect(o.map((b) => b.name)).toEqual(['Morning'])
    // Category-less age groups aren't put into a category's event.
    expect(JSON.stringify(o)).not.toContain('gStray')
  })
})

describe('autofill one event', () => {
  async function withEvent(data = sampleData()) {
    const t = setup(data)
    const blockId = t.b.addBlock('Morning')
    await flush()
    const eventId = t.b.addEvent(blockId, 'Mixed')
    await flush()
    const rows = () => dances({ dances: t.b.getEvent(blockId, eventId)?.dances })
    return { t, blockId, eventId, rows }
  }

  it('places a category’s dances, then the rest, never twice', async () => {
    const { t, blockId, eventId, rows } = await withEvent()
    await t.auto.placeDances(blockId, eventId, new Set(['cBeg']))
    expect(rows().map((r) => r.danceId)).toEqual(['dFling', 'dSword'])
    await t.auto.placeDances(blockId, eventId)
    expect(rows().map((r) => r.danceId)).toEqual(['dFling', 'dSword', 'dPas'])
    expect(await t.auto.placeDances(blockId, eventId)).toBeNull()
  })

  it('shares each dance’s age groups across the platforms, replacing what was there', async () => {
    const { t, blockId, eventId, rows } = await withEvent()
    await t.auto.placeDances(blockId, eventId)
    const fling = rows()[0].id
    await t.b.addToCell('group', { blockId, eventId, danceId: fling, platformId: 'pB' }, '1700000000000')
    await t.auto.fillGroups(blockId, eventId)
    const cells = Object.fromEntries(rows().map((r) => [r.danceId, r.platforms]))
    expect(cells.dFling).toMatchObject({ pA: { orderedGroupIds: ['gP6', 'gB8'] }, pB: { orderedGroupIds: ['gP7', 'gB9'] } })
    expect(cells.dSword).toMatchObject({ pA: { orderedGroupIds: ['gB8'] }, pB: { orderedGroupIds: ['gB9'] } })
    expect(cells.dPas).toMatchObject({ pA: { orderedGroupIds: ['gP6'] }, pB: { orderedGroupIds: ['gP7'] } })
  })

  it('gives platforms beyond the number of judges no judge', async () => {
    const data = sampleData()
    data.platforms = { pA: { name: 'A', _order: 0 }, pB: { name: 'B', _order: 1 }, pC: { name: 'C', _order: 2 }, pD: { name: 'D', _order: 3 } }
    const { t, blockId, eventId, rows } = await withEvent(data)
    t.b.addRow(blockId, eventId, { name: 'Registration' })
    await flush()
    await t.auto.placeDances(blockId, eventId)
    await t.auto.cycleJudges(blockId, eventId)
    const [reg, fling, sword] = rows()
    expect(reg.platforms).toBeUndefined()
    // Fraser, Robertson, Wardrope, one platform along per row (the
    // Registration row counts, as in the prototype).
    expect(Object.values(fling.platforms!).map((c) => c.orderedJudgeIds)).toEqual([['jWar'], ['jFra'], ['jRob']])
    expect(Object.keys(fling.platforms!)).toEqual(['pA', 'pB', 'pC'])
    expect(Object.values(sword.platforms!).map((c) => c.orderedJudgeIds)).toEqual([['jRob'], ['jWar'], ['jFra']])
  })
})
