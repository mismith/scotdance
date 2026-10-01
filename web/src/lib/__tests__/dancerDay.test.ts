import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  Category,
  EnrichedDance,
  EnrichedDancer,
  EnrichedGroup,
  Platform,
  ResultsTree,
  Schedule,
} from '@/types/competition'

// dancerDay → schedule → competitionData imports the Firebase app. Unit tests
// must never open a connection (outside `--mode emulator` that would be the
// production database), so stub both.
vi.mock('@/firebase', () => ({ database: {}, auth: {}, NAMESPACE: 'test', dataRef: () => ({}) }))
vi.mock('firebase/database', () => ({
  ref: () => ({}),
  child: () => ({}),
  get: () => new Promise(() => {}),
  onValue: () => () => {},
}))

const { bestPlacing, competitionPhase, dancerDay, scheduleIndex } = await import('@/lib/dancerDay')
type DayBundle = Parameters<typeof dancerDay>[1]

// --- Fixtures, shaped like enriched competition data.

const category = (name: string): Category => ({ id: `cat-${name}`, name })
function group(id: string, cat = 'Beginner', name = '7 & 8 Years'): EnrichedGroup {
  const c = category(cat)
  return { id, name, categoryId: c.id, category: c, fullName: `${cat} ${name}` }
}
function dance(id: string, groupIds: string[], name = id): EnrichedDance {
  return { id, name, fullName: name, groupIds: Object.fromEntries(groupIds.map((g) => [g, true])) }
}
function dancer(id: string, g: EnrichedGroup | undefined, number: number | undefined = 101): EnrichedDancer {
  return { id, firstName: 'Isla', lastName: 'Ross', fullName: 'Isla Ross', number, groupId: g?.id, group: g }
}

type Slot = { danceId: string; platforms: Record<string, string[]> }
type DayDef = { name?: string; date?: string; blocks: Array<{ name?: string; description?: string; events: Slot[][] }> }

/** Days › blocks › events › dances, in order; each dance lists groups per platform. */
function schedule(days: DayDef[]): Schedule {
  return {
    days: Object.fromEntries(
      days.map((day, di) => [
        `day${di}`,
        {
          order: di,
          name: day.name,
          date: day.date as unknown as number,
          blocks: Object.fromEntries(
            day.blocks.map((b, bi) => [
              `b${di}${bi}`,
              {
                order: bi,
                name: b.name,
                description: b.description,
                events: Object.fromEntries(
                  b.events.map((ev, ei) => [
                    `e${di}${bi}${ei}`,
                    {
                      order: ei,
                      name: `Event ${ei}`,
                      dances: Object.fromEntries(
                        ev.map((s, si) => [
                          `s${si}`,
                          {
                            order: si,
                            danceId: s.danceId,
                            platforms: Object.fromEntries(
                              Object.entries(s.platforms).map(([p, ids]) => [p, { orderedGroupIds: ids }]),
                            ),
                          },
                        ]),
                      ),
                    },
                  ]),
                ),
              },
            ]),
          ),
        },
      ]),
    ),
  }
}

const platforms: Platform[] = [
  { id: 'pA', name: 'A', _order: 0 },
  { id: 'pB', name: 'B', _order: 1 },
]

function bundle(over: Partial<DayBundle> = {}): DayBundle {
  return { dances: [], results: {}, points: {}, schedule: null, platforms, draws: {}, ...over }
}

const states = (day: ReturnType<typeof dancerDay>) => day.dances.map((s) => `${s.dance.id}:${s.state}`)

// One group, three dances, all on platform A in one block.
const g1 = group('g1')
const fling = dance('fling', ['g1', 'g2'], 'Highland Fling')
const sword = dance('sword', ['g1', 'g2'], 'Sword Dance')
const reel = dance('reel', ['g1'], 'Reel')
const oneDay = schedule([
  {
    name: 'Saturday',
    blocks: [
      {
        name: 'Morning',
        description: '8:30 am\nDoors open at 8',
        events: [
          [
            { danceId: 'fling', platforms: { pA: ['g2', 'g1'] } },
            { danceId: 'sword', platforms: { pA: ['g2', 'g1'] } },
            { danceId: 'reel', platforms: { pA: ['g1'] } },
          ],
        ],
      },
    ],
  },
])

describe('competitionPhase', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 3, 10, 30))
  })
  afterEach(() => vi.useRealTimers())

  it('reads the competition date in every stored shape', () => {
    expect(competitionPhase('2026-10-03')).toBe('today')
    expect(competitionPhase('2026-10-04')).toBe('before')
    expect(competitionPhase('2026-10-02')).toBe('after')
    expect(competitionPhase(new Date(2026, 9, 3).getTime())).toBe('today')
    // Old admin: ISO strings, with and without a zone.
    expect(competitionPhase(new Date(2026, 9, 3, 6).toISOString())).toBe('today')
    expect(competitionPhase('2026-10-03T09:00')).toBe('today')
  })

  it('treats a competition with no date as not happened yet', () => {
    expect(competitionPhase(undefined)).toBe('before')
    expect(competitionPhase(null)).toBe('before')
  })

  it('is on today for every day of a multi-day schedule', () => {
    const twoDays = schedule([
      { name: 'Saturday', blocks: [] },
      { name: 'Sunday', blocks: [] },
    ])
    // Started yesterday: day 2 is today.
    expect(competitionPhase('2026-10-02', twoDays)).toBe('today')
    expect(competitionPhase('2026-10-01', twoDays)).toBe('after')
    expect(competitionPhase('2026-10-04', twoDays)).toBe('before')
    // Without the schedule, only the first day counts.
    expect(competitionPhase('2026-10-02')).toBe('after')
    // A disabled or missing schedule is one day.
    expect(competitionPhase('2026-10-02', null)).toBe('after')
  })

  it('uses a schedule day’s own date when it has one', () => {
    const dated = schedule([
      { name: 'Friday', date: '2026-10-01', blocks: [] },
      { name: 'Sunday', date: '2026-10-03', blocks: [] },
    ])
    expect(competitionPhase('2026-10-01', dated)).toBe('today')
    // The rest day in between still counts as during the competition.
    vi.setSystemTime(new Date(2026, 9, 2, 10))
    expect(competitionPhase('2026-10-01', dated)).toBe('today')
    vi.setSystemTime(new Date(2026, 9, 4, 10))
    expect(competitionPhase('2026-10-01', dated)).toBe('after')
  })
})

describe('scheduleIndex', () => {
  it('numbers slots in schedule order with the group’s place on its platform', () => {
    const index = scheduleIndex(oneDay, platforms)
    expect(index.slots.map((s) => s.danceId)).toEqual(['fling', 'sword', 'reel'])
    const s = index.byGroupDance.get('g1:fling')!
    expect(s).toMatchObject({
      platformName: 'A',
      groupPos: 2,
      groupCount: 2,
      dayName: 'Saturday',
      blockName: 'Morning',
      blockTime: '8:30 am',
    })
    expect(index.byGroupDance.get('g2:fling')!.groupPos).toBe(1)
  })

  it('leaves spacers out of “group 2 of 3”, and deleted age groups when it knows the groups', () => {
    const spaced = schedule([
      { blocks: [{ events: [[{ danceId: 'fling', platforms: { pA: ['g2', '1546578400203', 'gone', 'g1'] } }]] }] },
    ])
    expect(scheduleIndex(spaced, platforms).byGroupDance.get('g1:fling')).toMatchObject({ groupPos: 3, groupCount: 3 })
    const me = dancer('d1', g1)
    const day = dancerDay(me, bundle({ dances: [fling], schedule: spaced, groups: [g1, group('g2')] }), 'today')
    expect(day.dances[0].slot).toMatchObject({ groupPos: 2, groupCount: 2 })
  })

  it('copes with no schedule and with legacy slots missing pieces', () => {
    expect(scheduleIndex(null, platforms).slots).toEqual([])
    const legacy = schedule([{ blocks: [{ events: [[{ danceId: 'fling', platforms: { pA: [] } }]] }] }])
    // A dance row with no dance (a break) and one with no platforms.
    const ev = Object.values(Object.values(Object.values(legacy.days!)[0].blocks!)[0].events!)[0]
    ev.dances!.brk = { order: 5, name: 'Lunch' }
    ev.dances!.nop = { order: 6, danceId: 'sword' }
    expect(scheduleIndex(legacy, platforms).slots).toEqual([])
  })
})

describe('dancerDay', () => {
  const me = dancer('d1', g1, 107)

  it('marks the first dance next and the rest later, on competition day', () => {
    const day = dancerDay(me, bundle({ dances: [fling, sword, reel], schedule: oneDay }), 'today')
    expect(states(day)).toEqual(['fling:next', 'sword:later', 'reel:later'])
    expect(day.next?.dance.id).toBe('fling')
    expect(day.next?.slot?.platformName).toBe('A')
    expect(day.resultsIn).toBe(0)
  })

  it('reads placings, ties and unplaced dances from posted results', () => {
    const results: ResultsTree = {
      g1: {
        fling: ['x1', 'd1:tie', 'x3'],
        sword: ['x1', 'x2'],
      },
    }
    const day = dancerDay(me, bundle({ dances: [fling, sword, reel], schedule: oneDay, results }), 'today')
    expect(states(day)).toEqual(['fling:placed', 'sword:unplaced', 'reel:next'])
    expect(day.dances[0]).toMatchObject({ place: 1, tied: true })
    expect(day.resultsIn).toBe(2)
    expect(bestPlacing(day)?.dance.id).toBe('fling')
  })

  it('shows “no placings” when the organiser posted none', () => {
    const day = dancerDay(me, bundle({ dances: [fling], results: { g1: { fling: false } } }), 'today')
    expect(states(day)).toEqual(['fling:no-placings'])
    expect(day.resultsIn).toBe(1)
  })

  it('counts a dance as danced once anything after it on its platform is posted', () => {
    // g2 dances the Sword after g1's Fling on the same platform.
    const day = dancerDay(
      me,
      bundle({ dances: [fling, sword, reel], schedule: oneDay, results: { g2: { sword: ['x9'] } } }),
      'today',
    )
    expect(states(day)).toEqual(['fling:waiting', 'sword:next', 'reel:later'])
  })

  it('counts earlier dances as danced once a later one of theirs is posted', () => {
    const day = dancerDay(me, bundle({ dances: [fling, sword, reel], schedule: oneDay, results: { g1: { sword: ['d1'] } } }), 'today')
    expect(states(day)).toEqual(['fling:waiting', 'sword:placed', 'reel:next'])
  })

  it('lists upcoming before the day and not-posted after it', () => {
    const b = bundle({ dances: [fling, sword], results: { g1: { fling: ['d1'] } } })
    expect(states(dancerDay(me, b, 'before'))).toEqual(['fling:placed', 'sword:upcoming'])
    expect(states(dancerDay(me, b, 'after'))).toEqual(['fling:placed', 'sword:not-posted'])
    expect(dancerDay(me, b, 'after').next).toBeNull()
  })

  it('finds the dancing order in the draw, with numbers stored as strings or numbers', () => {
    const draws = { g1: { fling: ['110', '107', '102'], sword: [102, 107] as unknown as string[] } }
    const day = dancerDay(me, bundle({ dances: [fling, sword, reel], draws }), 'today')
    expect(day.dances.map((s) => [s.drawPos, s.drawSize])).toEqual([
      [2, 3],
      [2, 2],
      [null, null],
    ])
    // No number, no draw position.
    const noNumber = dancerDay(dancer('d9', g1, undefined), bundle({ dances: [fling], draws }), 'today')
    expect(noNumber.dances[0].drawPos).toBeNull()
  })

  it('falls back to the admin’s dance order when there’s no schedule', () => {
    const day = dancerDay(me, bundle({ dances: [reel, fling], schedule: null }), 'today')
    expect(states(day)).toEqual(['reel:next', 'fling:later'])
    expect(day.dances[0].slot).toBeNull()
  })

  it('puts dances missing from the schedule after the scheduled ones', () => {
    const partial = schedule([{ blocks: [{ events: [[{ danceId: 'sword', platforms: { pB: ['g1'] } }]] }] }])
    const day = dancerDay(me, bundle({ dances: [fling, sword], schedule: partial }), 'today')
    expect(states(day)).toEqual(['sword:next', 'fling:later'])
    expect(day.next?.slot?.platformName).toBe('B')
  })

  it('returns an empty day for a dancer with no age group', () => {
    const day = dancerDay(dancer('d2', undefined), bundle({ dances: [fling] }), 'today')
    expect(day.dances).toEqual([])
    expect(day.next).toBeNull()
  })

  it('works out each entry of a dancer entered in two age groups on its own', () => {
    const premier = group('g3', 'Premier', '12 & Over')
    const broadsword = group('g4', 'Premier', 'Broadsword')
    const dances = [dance('fling', ['g3']), dance('sword', ['g3', 'g4'])]
    const results = { g4: { sword: ['e2'] } }
    const a = dancerDay({ ...dancer('e1', premier, 200), dancerId: 'agg' }, bundle({ dances, results }), 'today')
    const b = dancerDay({ ...dancer('e2', broadsword, 200), dancerId: 'agg' }, bundle({ dances, results }), 'today')
    expect(states(a)).toEqual(['fling:next', 'sword:later'])
    expect(states(b)).toEqual(['sword:placed'])
  })

  it('adds Overall for non-Primary groups, and callbacks when posted', () => {
    const primary = group('gp', 'Primary', 'Under 7')
    expect(dancerDay(dancer('p1', primary), bundle({ dances: [dance('fling', ['gp'])] }), 'today').overall).toBeNull()

    const results: ResultsTree = { g1: { fling: ['d1'], overall: ['x1', 'd1'], callbacks: ['d1', 'x2'] } }
    const day = dancerDay(me, bundle({ dances: [fling], results }), 'today')
    expect(day.overall).toMatchObject({ state: 'placed', place: 2 })
    expect(day.calledBack).toBe(true)
    expect(dancerDay(me, bundle({ dances: [fling] }), 'today').overall?.state).toBe('later')
    expect(dancerDay(me, bundle({ dances: [fling] }), 'after').overall?.state).toBe('not-posted')
    expect(dancerDay(me, bundle({ dances: [fling] }), 'today').calledBack).toBeNull()
    const notCalled = dancerDay(me, bundle({ dances: [fling], results: { g1: { callbacks: ['x2'] } } }), 'today')
    expect(notCalled.calledBack).toBe(false)
  })

  it('doesn’t count a Championship start (“reverse:N”, nobody placed yet) as posted', () => {
    const results: ResultsTree = { g1: { fling: ['reverse:3'], overall: ['reverse:3'] } }
    const day = dancerDay(me, bundle({ dances: [fling, sword], results }), 'today')
    expect(states(day)).toEqual(['fling:next', 'sword:later'])
    expect(day.overall?.state).toBe('later')
    expect(day.resultsIn).toBe(0)
    // Nor does it make the dances before it look danced.
    const later = dancerDay(me, bundle({ dances: [fling, sword], results: { g1: { sword: ['reverse:3'] } } }), 'today')
    expect(states(later)).toEqual(['fling:next', 'sword:later'])
  })

  it('reads reverse-order placings', () => {
    // Entered last place first: "reverse:3" then 3rd, 2nd, 1st.
    const results: ResultsTree = { g1: { fling: ['reverse:3', 'x3', 'd1', 'x1'] } }
    const day = dancerDay(me, bundle({ dances: [fling], results }), 'today')
    expect(day.dances[0]).toMatchObject({ state: 'placed', place: 2 })
  })

  it('ignores placeholder ids and odd legacy keys in the results tree', () => {
    const results = {
      ' 10 Years': { fling: ['1546578400203', 'x'] },
      g1: { fling: ['1546578400203', 'd1'] },
    } as ResultsTree
    const day = dancerDay(me, bundle({ dances: [fling], results }), 'today')
    expect(day.dances[0]).toMatchObject({ state: 'placed', place: 2 })
  })
})

describe('dancerDay over several days', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 4, 10, 30))
  })
  afterEach(() => vi.useRealTimers())

  // Saturday: the Fling. Sunday: the Sword and Reel. Today is Sunday.
  const weekend = schedule([
    { name: 'Saturday', blocks: [{ events: [[{ danceId: 'fling', platforms: { pA: ['g1'] } }]] }] },
    {
      name: 'Sunday',
      blocks: [
        {
          events: [
            [
              { danceId: 'sword', platforms: { pA: ['g1'] } },
              { danceId: 'reel', platforms: { pA: ['g1'] } },
            ],
          ],
        },
      ],
    },
  ])

  it('is still competition day on day two', () => {
    const phase = competitionPhase('2026-10-03', weekend)
    expect(phase).toBe('today')
    const day = dancerDay(dancer('d1', g1), bundle({ dances: [fling, sword, reel], schedule: weekend, results: { g1: { fling: ['d1'] } } }), phase)
    expect(states(day)).toEqual(['fling:placed', 'sword:next', 'reel:later'])
  })
})
