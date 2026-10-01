import { describe, expect, it, vi } from 'vitest'
import { flush, sampleData, setup } from './harness'
import { ids, isSpacerId, ordered, type SSchedule } from '../builder'
import { blocks as publicBlocks, days as publicDays, dances as publicDances, events as publicEvents } from '@/lib/schedule'

vi.mock('firebase/database', async () => (await import('./fakeDb')).firebaseDatabase)
vi.mock('@/firebase', async () => (await import('./fakeDb')).firebaseMock)
vi.mock('@/lib/offline', async () => (await import('./fakeDb')).offlineMock)
vi.mock('@/lib/competitionMeta', () => ({ forgetCompetitionMeta: () => {} }))
vi.mock('@/composables/useCompetitions', () => ({ forgetCompetitionsList: () => {} }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ uid: 'u1' }) }))
vi.mock('@/stores/me', () => ({ useMeStore: () => ({ hasCompetitionPerm: () => true }) }))

type Days = Record<string, Record<string, unknown>>
const weekday = (y: number, m: number, d: number) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(y, m - 1, d))
const daysOf = (s: unknown) => (s as { days: Days }).days

/** A legacy (v3) schedule: no `order` anywhere, names on days, numbers as spacers. */
function legacySchedule(): SSchedule {
  return {
    days: {
      '-Lday1': {
        name: 'Saturday',
        blocks: {
          '-Lb1': {
            name: 'Morning',
            description: '8:30 am',
            events: {
              '-Le1': {
                name: 'Primary',
                dances: {
                  '-Lr1': { name: 'Registration' },
                  '-Lr2': {
                    danceId: 'dPas',
                    platforms: {
                      pA: { orderedGroupIds: ['gP6', 1575433498638 as unknown as string, 'gP7'], orderedJudgeIds: ['jRob'] },
                    },
                  },
                  '-Lr3': { danceId: 'dFling' },
                },
              },
              '-Le2': { name: 'Beginner' },
            },
          },
          '-Lb2': { name: 'Afternoon' },
          '-Lb3': { name: 'Evening' },
        },
      },
    },
  }
}

describe('building a schedule from nothing', () => {
  it('writes days › blocks › events › dances › platforms as the old apps read them', async () => {
    const t = setup(sampleData())
    const blockId = t.b.addBlock('Morning')
    await flush()
    const eventId = t.b.addEvent(blockId, 'Primary', '8:30 am')
    await flush()
    const rowId = t.b.addRow(blockId, eventId, { danceId: 'dFling' })
    await flush()
    const loc = { blockId, eventId, danceId: rowId, platformId: 'pA' }
    await t.b.addToCell('group', loc, 'gP6')
    await t.b.addToCell('group', loc, 'gP7')
    await t.b.addToCell('judge', loc, 'jRob')

    const days = Object.entries(daysOf(t.stored()))
    expect(days).toHaveLength(1)
    const [, day] = days[0]
    expect(day.blocks).toEqual({
      [blockId]: {
        name: 'Morning',
        order: 0,
        events: {
          [eventId]: {
            name: 'Primary',
            description: '8:30 am',
            order: 0,
            dances: {
              [rowId]: {
                danceId: 'dFling',
                order: 0,
                platforms: { pA: { orderedGroupIds: ['gP6', 'gP7'], orderedJudgeIds: ['jRob'] } },
              },
            },
          },
        },
      },
    })
    expect(day.order).toBe(0)
  })

  it('names the one day after the competition’s weekday, as older apps show day names', async () => {
    const t = setup(sampleData())
    // 2026-10-03 is a Saturday.
    t.m.competition.value = { name: 'Test', date: '2026-10-03' as unknown as number }
    t.b.addBlock('Morning')
    await flush()
    const [day] = Object.values(daysOf(t.stored()))
    expect(day.name).toBe(weekday(2026, 10, 3))
    expect(day.date).toBe('2026-10-03')
  })

  it('still names the day when the competition has no usable date', async () => {
    for (const date of [undefined, '', 'next Saturday']) {
      const t = setup(sampleData())
      t.m.competition.value = { name: 'Test', date: date as unknown as number }
      t.b.addBlock('Morning')
      await flush()
      const [day] = Object.values(daysOf(t.stored()))
      expect(day.name).toBe('Day 1')
      expect(day.date).toBeUndefined()
    }
  })

  it('keeps one day when sessions are added in a row', async () => {
    const t = setup(sampleData())
    t.b.addBlock('Morning')
    t.b.addBlock('Afternoon')
    t.b.addBlock('Evening')
    await flush()
    const days = Object.values(daysOf(t.stored()))
    expect(days).toHaveLength(1)
    expect(ordered(days[0].blocks as Record<string, { name?: string; order?: number }>).map(([, b]) => b.name)).toEqual([
      'Morning',
      'Afternoon',
      'Evening',
    ])
  })

  it('makes each edit one undoable change', async () => {
    const t = setup(sampleData())
    const blockId = t.b.addBlock('Morning')
    await flush()
    const eventId = t.b.addEvent(blockId, 'Primary')
    await flush()
    const before = t.stored()
    const change = await t.b.renameEvent(blockId, eventId, 'Primary 🎉')
    expect(change).toBeTypeOf('number')
    await t.m.undoChange(change!)
    expect(t.stored()).toEqual(before)
  })

  it('undoing the first session takes the schedule back to empty', async () => {
    const t = setup(sampleData())
    t.b.addBlock('Morning')
    await flush()
    expect(t.stored()).toBeTruthy()
    await t.m.undoChange()
    expect(t.stored()).toBeNull()
  })

  it('stores very long and emoji names as typed', async () => {
    const t = setup(sampleData())
    const long = 'Premier '.repeat(60).trim()
    const blockId = t.b.addBlock(long)
    await flush()
    t.b.addEvent(blockId, '💃 Highland 🏴󠁧󠁢󠁳󠁣󠁴󠁿')
    await flush()
    const [day] = Object.values(daysOf(t.stored()))
    const block = (day.blocks as Record<string, { name: string; events: Record<string, { name: string }> }>)[blockId]
    expect(block.name).toBe(long)
    expect(Object.values(block.events)[0].name).toBe('💃 Highland 🏴󠁧󠁢󠁳󠁣󠁴󠁿')
  })
})

describe('reading legacy schedules', () => {
  it('orders like the public pages when nothing has an order', () => {
    const t = setup(sampleData(legacySchedule()))
    expect(t.b.blocks.value.map(([id]) => id)).toEqual(['-Lb1', '-Lb2', '-Lb3'])
    const s = t.m.schedule.value!
    const pub = publicBlocks(publicDays(s)[0]).map((b) => b.id)
    expect(pub).toEqual(['-Lb1', '-Lb2', '-Lb3'])
  })

  it('agrees with the public pages on any mix of ordered and unordered siblings', () => {
    // Some siblings with `order`, some without (an old admin reordered, then
    // added more): both sides must agree, whatever the comparator does.
    let seed = 7
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let run = 0; run < 300; run++) {
      const n = 1 + Math.floor(rand() * 7)
      const rec: Record<string, { order?: number; name: string }> = {}
      for (let i = 0; i < n; i++) {
        const key = `-K${Math.floor(rand() * 1000).toString(36)}${i}`
        rec[key] = rand() < 0.6 ? { name: key, order: Math.floor(rand() * 5) } : { name: key }
      }
      const builder = ordered(rec).map(([id]) => id)
      const pub = publicBlocks({ blocks: rec }).map((b) => b.id)
      expect(builder).toEqual(pub)
    }
  })

  it('reads numeric spacers and object-shaped lists', () => {
    expect(ids([1575433498638, 'gP6', null, ''])).toEqual(['1575433498638', 'gP6'])
    expect(ids({ 0: 'a', 2: 'b' })).toEqual(['a', 'b'])
    expect(ids(undefined)).toEqual([])
    expect(isSpacerId('1575433498638')).toBe(true)
    expect(isSpacerId('-LFzNaNf3YjQaDXkoLfa')).toBe(false)
  })

  it('numbers all siblings when one is moved, and the public pages follow', async () => {
    const t = setup(sampleData(legacySchedule()))
    await t.b.reorderBlock(2, 0)
    const [day] = Object.values(daysOf(t.stored()))
    const blocks = day.blocks as Record<string, { order?: number }>
    expect(blocks['-Lb3'].order).toBe(0)
    expect(blocks['-Lb1'].order).toBe(1)
    expect(blocks['-Lb2'].order).toBe(2)
    expect(publicBlocks(publicDays(t.m.schedule.value!)[0]).map((b) => b.id)).toEqual(['-Lb3', '-Lb1', '-Lb2'])
    // The day keeps its name and gains no order it didn't need.
    expect(day.name).toBe('Saturday')
    expect(day.order).toBeUndefined()
  })

  it('only rewrites the cell it changes, keeping legacy spacers', async () => {
    const t = setup(sampleData(legacySchedule()))
    const loc = { blockId: '-Lb1', eventId: '-Le1', danceId: '-Lr2', platformId: 'pA' }
    await t.b.addToCell('group', loc, 'gB8')
    expect(t.writtenPaths()).toEqual(['schedule/days/-Lday1/blocks/-Lb1/events/-Le1/dances/-Lr2/platforms/pA/orderedGroupIds'])
    const cell = t.m.schedule.value!.days!['-Lday1'].blocks!['-Lb1'].events!['-Le1'].dances!['-Lr2'].platforms!.pA
    expect(cell.orderedGroupIds).toEqual(['gP6', '1575433498638', 'gP7', 'gB8'])
    expect(cell.orderedJudgeIds).toEqual(['jRob'])
  })

  it('adds a session to a legacy day without touching the others', async () => {
    const t = setup(sampleData(legacySchedule()))
    const id = t.b.addBlock('Late')
    await flush()
    const order = publicBlocks(publicDays(t.m.schedule.value!)[0]).map((b) => b.id)
    expect(order).toEqual(['-Lb1', '-Lb2', '-Lb3', id])
  })

  it('shows dangling ids with plain names instead of failing', () => {
    const t = setup(sampleData(legacySchedule()))
    expect(t.b.groupLabel('-Gone')).toBe('Unknown age group')
    expect(t.b.groupFullLabel('-Gone')).toBe('Unknown age group')
    expect(t.b.staffName('-Gone')).toBe('Unknown judge')
    expect(t.b.danceName('-Gone')).toBe('Unknown dance')
    expect(t.b.eligible('-Gone', 'gP6')).toBe(true)
  })

  it('treats a hidden schedule (false) as no days', () => {
    const t = setup(sampleData(false))
    expect(t.m.scheduleHidden.value).toBe(true)
    expect(t.b.days.value).toEqual([])
    expect(t.b.blocks.value).toEqual([])
  })
})

describe('several days', () => {
  const twoDays = (): SSchedule => ({
    days: {
      '-Lsat': { name: 'Saturday', order: 0, blocks: { '-Lb1': { name: 'Morning', order: 0 } } },
      '-Lsun': { name: 'Sunday', order: 1, blocks: { '-Lb9': { name: 'Championship', order: 0 } } },
    },
  })

  it('edits the day in the address, else the first', async () => {
    const t = setup(sampleData(twoDays()), { dayId: '-Lsun' })
    expect(t.b.dayId.value).toBe('-Lsun')
    expect(t.b.blocks.value.map(([id]) => id)).toEqual(['-Lb9'])
    t.b.addBlock('Afternoon')
    await flush()
    const s = t.m.schedule.value!
    expect(Object.keys(s.days!['-Lsun'].blocks!)).toHaveLength(2)
    expect(Object.keys(s.days!['-Lsat'].blocks!)).toHaveLength(1)

    t.dayParam.value = '-Lnope'
    expect(t.b.dayId.value).toBe('-Lsat')
  })

  it('adds the next day, named and dated after the last', async () => {
    const t = setup(sampleData())
    t.m.competition.value = { name: 'Test', date: '2026-10-03' as unknown as number }
    t.b.addBlock('Morning')
    await flush()
    const id = t.b.addDay()
    await flush()
    const s = t.m.schedule.value!
    expect(publicDays(s).map((d) => [d.name, d.date, d.order])).toEqual([
      [weekday(2026, 10, 3), '2026-10-03', 0],
      [weekday(2026, 10, 4), '2026-10-04', 1],
    ])
    expect(publicDays(s)[1].id).toBe(id)
  })

  it('adds days to legacy schedules without dates, from the competition’s date', async () => {
    const t = setup(sampleData(twoDays()))
    t.m.competition.value = { name: 'Test', date: '2019-01-12' as unknown as number }
    t.b.addDay()
    await flush()
    expect(publicDays(t.m.schedule.value!).map((d) => [d.name, d.date])).toEqual([
      ['Saturday', undefined],
      ['Sunday', undefined],
      [weekday(2019, 1, 14), '2019-01-14'],
    ])
  })

  it('numbers days when there are no dates at all', async () => {
    const t = setup(sampleData(twoDays()))
    t.b.addDay()
    await flush()
    expect(publicDays(t.m.schedule.value!).map((d) => d.name)).toEqual(['Saturday', 'Sunday', 'Day 3'])
  })

  it('renames, dates and deletes a day', async () => {
    const t = setup(sampleData(twoDays()))
    await t.b.renameDay('-Lsun', 'Sunday 🏆')
    await t.b.setDayDate('-Lsun', '2026-10-04')
    // A name someone typed stays when the date changes.
    expect(t.m.schedule.value!.days!['-Lsun']).toMatchObject({ name: 'Sunday 🏆', date: '2026-10-04' })
    await t.b.renameDay('-Lsun', weekday(2026, 10, 4))
    await t.b.setDayDate('-Lsun', '2026-10-05')
    // A name that was the weekday follows the date.
    expect(t.m.schedule.value!.days!['-Lsun']).toMatchObject({ name: weekday(2026, 10, 5), date: '2026-10-05' })
    await t.b.setDayDate('-Lsun', '')
    expect(t.m.schedule.value!.days!['-Lsun'].date).toBeUndefined()
    await t.b.removeDay('-Lsun')
    expect(Object.keys(t.m.schedule.value!.days!)).toEqual(['-Lsat'])
    const { historyState } = await import('@/lib/admin/history')
    expect(historyState(() => 'c1').undoLabel.value).toBe(`Deleted ${weekday(2026, 10, 5)}`)
    await t.m.undoChange()
    expect(Object.keys(t.m.schedule.value!.days!)).toEqual(['-Lsat', '-Lsun'])
  })

  it('clears only the day being edited', async () => {
    const t = setup(sampleData(twoDays()), { dayId: '-Lsun' })
    await t.b.clearDay()
    const s = t.m.schedule.value!
    expect(s.days!['-Lsun'].blocks).toBeUndefined()
    expect(s.days!['-Lsat'].blocks).toBeTruthy()
  })
})

describe('sessions, events and rows', () => {
  async function built() {
    const t = setup(sampleData())
    const b1 = t.b.addBlock('Morning')
    const b2 = t.b.addBlock('Afternoon')
    await flush()
    const e1 = t.b.addEvent(b1, 'Primary')
    const e2 = t.b.addEvent(b1, 'Beginner')
    const e3 = t.b.addEvent(b2, 'Novice')
    await flush()
    const r1 = t.b.addRow(b1, e1, { danceId: 'dFling' })
    const r2 = t.b.addRow(b1, e1, { danceId: 'dPas' })
    const r3 = t.b.addRow(b1, e1, { name: 'Results' })
    await flush()
    return { t, b1, b2, e1, e2, e3, r1, r2, r3 }
  }
  const rowsOf = (t: ReturnType<typeof setup>, b: string, e: string) =>
    publicDances({ dances: t.b.getEvent(b, e)?.dances }).map((r) => r.id)

  it('inserts a dropped dance where it was dropped', async () => {
    const { t, b1, e1, r1, r2, r3 } = await built()
    const r4 = t.b.addRow(b1, e1, { danceId: 'dSword' }, 1)
    await flush()
    expect(rowsOf(t, b1, e1)).toEqual([r1, r4, r2, r3])
  })

  it('reorders rows, events and sessions', async () => {
    const { t, b1, b2, e1, e2, r1, r2, r3 } = await built()
    await t.b.reorderRow(b1, e1, 2, 0)
    expect(rowsOf(t, b1, e1)).toEqual([r3, r1, r2])
    await t.b.reorderEvent(b1, 1, 0)
    expect(publicEvents({ events: t.b.getBlock(b1)?.events }).map((e) => e.id)).toEqual([e2, e1])
    await t.b.reorderBlock(1, 0)
    expect(t.b.blocks.value.map(([id]) => id)).toEqual([b2, b1])
  })

  it('ignores moves outside the list', async () => {
    const { t, b1, e1 } = await built()
    const before = JSON.stringify(t.stored())
    await t.b.reorderRow(b1, e1, 0, 9)
    await t.b.reorderRow(b1, e1, -1, 0)
    await t.b.reorderBlock(0, 0)
    expect(JSON.stringify(t.stored())).toBe(before)
  })

  it('moves a row (with its platforms) to another event', async () => {
    const { t, b1, b2, e1, e3, r1, r2 } = await built()
    await t.b.addToCell('group', { blockId: b1, eventId: e1, danceId: r2, platformId: 'pB' }, 'gP7')
    await t.b.moveRow({ blockId: b1, eventId: e1 }, r2, { blockId: b2, eventId: e3 }, 0)
    expect(rowsOf(t, b2, e3)).toEqual([r2])
    expect(rowsOf(t, b1, e1)).not.toContain(r2)
    expect(rowsOf(t, b1, e1)[0]).toBe(r1)
    expect(t.b.getRow(b2, e3, r2)?.platforms?.pB?.orderedGroupIds).toEqual(['gP7'])
  })

  it('deletes a session with everything in it', async () => {
    const { t, b1, b2 } = await built()
    await t.b.removeBlock(b1)
    expect(t.b.blocks.value.map(([id]) => id)).toEqual([b2])
    expect(JSON.stringify(t.stored())).not.toContain(b1)
  })

  it('renames and describes, clearing a note when emptied', async () => {
    const { t, b1, e1, r3 } = await built()
    await t.b.describeBlock(b1, '9:00 am\nDoors at 8')
    expect(t.b.getBlock(b1)?.description).toBe('9:00 am\nDoors at 8')
    await t.b.describeBlock(b1, '')
    expect(t.b.getBlock(b1)?.description).toBeUndefined()
    await t.b.setRowText(b1, e1, r3, 'description', 'In the hall')
    await t.b.setRowText(b1, e1, r3, 'name', 'Awards')
    expect(t.b.getRow(b1, e1, r3)).toMatchObject({ name: 'Awards', description: 'In the hall' })
  })
})

describe('platform cells', () => {
  async function withRow() {
    const t = setup(sampleData())
    const blockId = t.b.addBlock('Morning')
    await flush()
    const eventId = t.b.addEvent(blockId, 'Primary')
    await flush()
    const rowId = t.b.addRow(blockId, eventId, { danceId: 'dFling' })
    await flush()
    const at = (platformId: string) => ({ blockId, eventId, danceId: rowId, platformId })
    const cell = (platformId: string) => t.b.getRow(blockId, eventId, rowId)?.platforms?.[platformId]
    return { t, at, cell }
  }

  it('adds at a position and never twice', async () => {
    const { t, at, cell } = await withRow()
    await t.b.addToCell('group', at('pA'), 'gP6')
    await t.b.addToCell('group', at('pA'), 'gB8', 0)
    await t.b.addToCell('group', at('pA'), 'gP6')
    expect(cell('pA')?.orderedGroupIds).toEqual(['gB8', 'gP6'])
  })

  it('reorders within a cell and moves between cells', async () => {
    const { t, at, cell } = await withRow()
    for (const g of ['gP6', 'gP7', 'gB8']) await t.b.addToCell('group', at('pA'), g)
    await t.b.reorderInCell('group', at('pA'), 0, 2)
    expect(cell('pA')?.orderedGroupIds).toEqual(['gP7', 'gB8', 'gP6'])
    await t.b.moveBetweenCells('group', at('pA'), at('pB'), 'gB8', 0)
    expect(cell('pA')?.orderedGroupIds).toEqual(['gP7', 'gP6'])
    expect(cell('pB')?.orderedGroupIds).toEqual(['gB8'])
    // Already there: nothing moves.
    await t.b.addToCell('group', at('pA'), 'gB9')
    await t.b.addToCell('group', at('pB'), 'gB9')
    await t.b.moveBetweenCells('group', at('pA'), at('pB'), 'gB9')
    expect(cell('pA')?.orderedGroupIds).toContain('gB9')
  })

  it('keeps spacers apart from age groups', async () => {
    const { t, at, cell } = await withRow()
    await t.b.addToCell('group', at('pA'), 'gP6')
    await t.b.addToCell('group', at('pA'), '1700000000000')
    await t.b.addToCell('group', at('pA'), 'gP7')
    expect(cell('pA')?.orderedGroupIds).toEqual(['gP6', '1700000000000', 'gP7'])
    await t.b.removeFromCell('group', at('pA'), '1700000000000')
    expect(cell('pA')?.orderedGroupIds).toEqual(['gP6', 'gP7'])
  })

  it('leaves nothing behind when a cell is emptied', async () => {
    const { t, at, cell } = await withRow()
    await t.b.addToCell('judge', at('pA'), 'jRob')
    await t.b.removeFromCell('judge', at('pA'), 'jRob')
    expect(cell('pA')).toBeUndefined()
    // Clearing a cell that was never there writes nothing.
    const n = t.writtenPaths().length
    await t.b.setCell('group', at('pB'), [])
    expect(t.writtenPaths()).toHaveLength(n)
  })

  it('takes away a dangling (deleted) age group', async () => {
    const { t, at, cell } = await withRow()
    await t.b.setCell('group', at('pA'), ['-Gone', 'gP6'])
    await t.b.removeFromCell('group', at('pA'), '-Gone')
    expect(cell('pA')?.orderedGroupIds).toEqual(['gP6'])
  })

  it('labels changes for the undo history', async () => {
    const { t, at } = await withRow()
    const { historyState } = await import('@/lib/admin/history')
    const h = historyState(() => 'c1')
    await t.b.addToCell('group', at('pA'), 'gP6')
    expect(h.undoLabel.value).toBe('Added Pri 6 & Under to Highland Fling')
    await t.b.addToCell('group', at('pA'), '1700000000000')
    expect(h.undoLabel.value).toBe('Added a spacer to Highland Fling')
    await t.b.addToCell('judge', at('pA'), 'jRob')
    expect(h.undoLabel.value).toBe('Added Robertson to Highland Fling')
  })
})

describe('labels', () => {
  it('abbreviates categories without splitting emoji', () => {
    const data = sampleData()
    data.categories = { c1: { name: 'Pre-Premier' }, c2: { name: '🌟 Stars' }, c3: { name: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' }, c4: { name: 'Primary' } }
    data.groups = {
      g1: { name: '10 & Over', categoryId: 'c1' },
      g2: { name: 'Open', categoryId: 'c2' },
      g3: { name: 'Open', categoryId: 'c3' },
      g4: { name: '6 & Under', categoryId: 'c4' },
    }
    const t = setup(data)
    expect(t.b.groupLabel('g1')).toBe('PP 10 & Over')
    expect(t.b.groupLabel('g2')).toBe('🌟S Open')
    expect(t.b.groupLabel('g4')).toBe('Pri 6 & Under')
    for (const id of ['g1', 'g2', 'g3', 'g4']) expect(t.b.groupLabel(id).isWellFormed()).toBe(true)
  })

  it('tells judges with the same last name apart', () => {
    const data = sampleData()
    data.staff = {
      a: { firstName: 'Ann', lastName: 'Ross', type: 'Judge' },
      b: { firstName: 'Bea', lastName: 'Ross', type: 'Judge' },
      c: { firstName: 'Bea', lastName: 'Kerr', type: 'Judge' },
      d: { firstName: 'Bob', lastName: 'Kerr', type: 'Judge' },
      e: { firstName: 'Cal', lastName: 'Grant', type: 'Judge' },
    }
    const t = setup(data)
    expect(['a', 'b', 'c', 'd', 'e'].map(t.b.staffName)).toEqual(['A. Ross', 'B. Ross', 'Bea Kerr', 'Bob Kerr', 'Grant'])
  })
})
