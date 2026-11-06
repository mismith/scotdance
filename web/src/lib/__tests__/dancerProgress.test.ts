import { describe, expect, it } from 'vitest'
import {
  currentLevel,
  levelOf,
  levelStretches,
  moments,
  nextCount,
  seasonLabel,
  seasonOf,
  seasons,
  type CompetitionPoint,
  type Level,
} from '@/lib/dancerProgress'

let n = 0
const pt = (date: string, level: Level | null, name?: string, extra: Partial<CompetitionPoint> = {}): CompetitionPoint => ({
  competitionId: `c${(n += 1)}`,
  competitionName: name ?? `Games ${n}`,
  date: new Date(`${date}T12:00:00`).getTime(),
  level,
  ...extra,
})
const day = (i: number) => new Date(ms('2020-01-01') + i * 86_400_000).toISOString().slice(0, 10)
const ms = (date: string) => new Date(`${date}T12:00:00`).getTime()

describe('levelOf', () => {
  it('reads the level word, any case', () => {
    expect(levelOf('Primary')).toBe('Primary')
    expect(levelOf('BEGINNER')).toBe('Beginner')
    expect(levelOf('novice')).toBe('Novice')
    expect(levelOf('Intermediate')).toBe('Intermediate')
    expect(levelOf('Premier')).toBe('Premier')
  })

  it('treats Pre-Premier as Intermediate and Restricted Premier as Premier', () => {
    expect(levelOf('Pre-Premier')).toBe('Intermediate')
    expect(levelOf('Pre Premier')).toBe('Intermediate')
    expect(levelOf('pre-premier')).toBe('Intermediate')
    expect(levelOf('Restricted Premier')).toBe('Premier')
  })

  it('ignores ages and other words', () => {
    expect(levelOf('Premier Special Jig')).toBe('Premier')
    expect(levelOf('Novice 12 & Under')).toBe('Novice')
  })

  it('is null for two levels, none, or nothing', () => {
    expect(levelOf('Beginner/Novice')).toBeNull()
    expect(levelOf('Novice & Intermediate')).toBeNull()
    expect(levelOf('Pre-Premier & Premier')).toBeNull()
    expect(levelOf('Championship')).toBeNull()
    expect(levelOf('Premiership')).toBeNull()
    expect(levelOf('12 & Under')).toBeNull()
    expect(levelOf('')).toBeNull()
    expect(levelOf(null)).toBeNull()
    expect(levelOf(undefined)).toBeNull()
  })
})

describe('levelStretches', () => {
  const record = [
    pt('2019-07-01', 'Primary'),
    pt('2019-07-20', 'Primary'),
    pt('2023-03-05', 'Premier'),
    pt('2023-05-05', 'Premier'),
    pt('2023-06-05', null),
  ]

  it('lists the stretches newest first with the quiet years between', () => {
    expect(levelStretches(record)).toEqual([
      { kind: 'level', level: 'Premier', from: ms('2023-03-05'), to: ms('2023-05-05'), competitions: 2 },
      { kind: 'gap', fromYear: 2020, toYear: 2022 },
      { kind: 'level', level: 'Primary', from: ms('2019-07-01'), to: ms('2019-07-20'), competitions: 2 },
    ])
  })

  it('does not mind input order', () => {
    expect(levelStretches([...record].reverse())).toEqual(levelStretches(record))
  })

  it('lets a competition with no level sit inside a stretch', () => {
    const s = levelStretches([pt('2023-01-01', 'Novice'), pt('2023-02-01', null), pt('2023-03-01', 'Novice')])
    expect(s).toEqual([{ kind: 'level', level: 'Novice', from: ms('2023-01-01'), to: ms('2023-03-01'), competitions: 2 }])
  })

  it('starts a new stretch when the level changes, even in the same year', () => {
    const s = levelStretches([pt('2023-01-01', 'Novice'), pt('2023-02-01', 'Intermediate'), pt('2024-02-01', 'Novice')])
    expect(s.map((x) => x.kind === 'level' && x.level)).toEqual(['Novice', 'Intermediate', 'Novice'])
  })

  it('has no gap when every calendar year had a competition', () => {
    const s = levelStretches([pt('2019-12-01', 'Novice'), pt('2020-01-15', 'Novice'), pt('2021-12-30', 'Novice')])
    // 2020 had a competition, so there is no gap here
    expect(s).toEqual([{ kind: 'level', level: 'Novice', from: ms('2019-12-01'), to: ms('2021-12-30'), competitions: 3 }])
  })

  it('has a gap even when the level is the same on both sides', () => {
    const s = levelStretches([pt('2019-07-01', 'Novice'), pt('2022-07-01', 'Novice')])
    expect(s.map((x) => x.kind)).toEqual(['level', 'gap', 'level'])
    expect(s[1]).toEqual({ kind: 'gap', fromYear: 2020, toYear: 2021 })
  })

  it('is empty with nothing, and has no level stretch when none is known', () => {
    expect(levelStretches([])).toEqual([])
    expect(levelStretches([pt('2023-01-01', null)])).toEqual([])
  })
})

describe('moments', () => {
  const titles = (points: CompetitionPoint[]) => moments(points).map((m) => m.title)

  it('marks the first competition ScotDance.app knows of, as a peak, linked to their entry', () => {
    const p = pt('2023-01-01', null, 'Cowal', { entryId: 'e1' })
    expect(moments([p])).toEqual([
      {
        kind: 'first',
        weight: 'peak',
        date: ms('2023-01-01'),
        title: 'First competition on ScotDance.app',
        detail: 'Cowal',
        competitionId: p.competitionId,
        entryId: 'e1',
      },
    ])
  })

  it('marks the 10th, 25th, 50th, 75th and 100th competitions, then every 50th', () => {
    const points = Array.from({ length: 150 }, (_, i) => pt(day(i), null))
    const counts = moments(points).filter((m) => m.kind === 'count')
    expect(counts.map((m) => m.n)).toEqual([150, 100, 75, 50, 25, 10])
    expect(counts.every((m) => m.weight === 'notable')).toBe(true)
    expect(nextCount(147)).toBe(150)
    expect(nextCount(3)).toBe(10)
  })

  it('marks a step up in level, but not the first level or a step down', () => {
    const m = moments([
      pt('2019-01-01', 'Primary'),
      pt('2019-06-01', 'Beginner'),
      pt('2020-01-01', 'Primary'),
      pt('2021-01-01', 'Beginner'),
      pt('2021-06-01', 'Novice'),
    ])
    expect(m.filter((x) => x.kind === 'level').map((x) => x.title)).toEqual(['Moved up to Novice', 'Moved up to Beginner'])
  })

  it('marks the first placing, win and trophy at each level, telling a first placing that was a win once', () => {
    const t = titles([
      pt('2019-01-01', 'Primary', 'A', { dances: [{ name: 'Highland Fling', place: 4 }] }),
      pt('2019-02-01', 'Primary', 'B', { dances: [{ name: 'Sword Dance', place: 1 }], overall: 1 }),
      pt('2019-03-01', 'Beginner', 'C', { dances: [{ name: 'Irish Jig', place: 1 }] }),
    ])
    // Newest first, so on one day the step up comes below what followed it.
    expect(t).toEqual([
      'First win at Beginner',
      'Moved up to Beginner',
      'First trophy at Primary',
      'First win at Primary',
      'First placing at Primary',
      'First competition on ScotDance.app',
    ])
    const placing = moments([pt('2019-01-01', 'Primary', 'A', { dances: [{ name: 'Highland Fling', place: 4 }] })]).find((m) => m.kind === 'placing')
    expect(placing).toMatchObject({ detail: '4th, Highland Fling', danceKind: 'highland', weight: 'notable' })
  })

  it('marks championships, the Canadian Championships and a first competition abroad', () => {
    const t = titles([
      pt('2019-01-01', null, 'Calgary Open', { country: 'CA' }),
      pt('2019-02-01', null, 'Calgary Open', { country: 'CA' }),
      pt('2019-03-01', null, 'Alberta Provincial Championship', { country: 'CA' }),
      pt('2019-04-01', null, 'SDCCS 2019', { country: 'CA', categories: ['Premier 12'] }),
      pt('2019-05-01', null, 'Spokane Games', { country: 'US', categories: ['Pre-Championship', 'Championship 12 & Under'] }),
    ])
    expect(t).toEqual([
      'First Championship',
      'First competition abroad',
      'First ScotDance Canada Championships',
      'First provincial championship',
      'First competition on ScotDance.app',
    ])
  })

  it('marks a dance that rarely placed, then placed three times running', () => {
    const jig = (place: number | null) => ({ dances: [{ name: 'Irish Jig', place }] })
    const places = [null, null, 5, null, null, 4, 3, 2]
    const m = moments(places.map((p, i) => pt(day(i * 40), null, undefined, jig(p))))
    expect(m.find((x) => x.kind === 'streak')).toMatchObject({
      title: 'Placed in the Irish Jig 3 times running',
      detail: 'A dance that had placed 1 of 5 times before',
      danceKind: 'character',
    })
  })

  it('marks one best ever top three a season, and never a drop', () => {
    const fling = (date: string, place: number) => pt(date, null, undefined, { dances: [{ name: 'Highland Fling', place }] })
    const best = moments([fling('2019-01-01', 5), fling('2019-02-01', 3), fling('2019-03-01', 2), fling('2019-04-01', 6), fling('2020-01-01', 1)]).filter(
      (m) => m.kind === 'best',
    )
    expect(best.map((m) => m.detail)).toEqual(['1st, up from 2nd', '3rd, up from 5th'])
    expect(best[0].weight).toBe('quiet')
  })

  it('marks a day placed in three kinds of dance, once', () => {
    const all = { dances: [{ name: 'Highland Fling', place: 2 }, { name: 'Scottish Lilt', place: 3 }, { name: 'Sailors Hornpipe', place: 5 }] }
    const t = titles([pt('2019-01-01', null, 'A', all), pt('2019-02-01', null, 'B', all)])
    expect(t.filter((x) => x.startsWith('Placed in 3 kinds'))).toEqual(['Placed in 3 kinds of dance in one day'])
  })

  it('marks the kind of dance that improved most on the season before, and only a clear gain', () => {
    const season = (year: number, lilt: number | null, fling: number | null) =>
      [1, 2, 3, 4].map((m) => pt(`${year}-0${m}-01`, null, undefined, { dances: [{ name: 'Scottish Lilt', place: lilt }, { name: 'Highland Fling', place: fling }] }))
    const m = moments([...season(2023, null, 2), ...season(2024, 2, 2)])
    expect(m.find((x) => x.kind === 'improved')).toMatchObject({ title: 'National dances improved most in 2023–24', detail: 'Placed more often than in 2022–23' })
    expect(moments([...season(2023, 2, 2), ...season(2024, 2, 2)]).some((x) => x.kind === 'improved')).toBe(false)
  })

  it('is newest first, and empty with nothing', () => {
    const m = moments([pt('2019-01-01', 'Primary'), pt('2019-06-01', 'Beginner')])
    expect(m.map((x) => x.kind)).toEqual(['level', 'first'])
    expect(moments([])).toEqual([])
  })
})

describe('currentLevel', () => {
  it('is the latest clear level and when its run began', () => {
    const points = [
      pt('2019-07-01', 'Primary'),
      pt('2023-03-05', 'Premier'),
      pt('2023-04-05', null),
      pt('2024-05-05', 'Premier'),
      pt('2024-06-05', null),
    ]
    expect(currentLevel(points)).toEqual({ level: 'Premier', since: ms('2023-03-05') })
  })

  it('starts again after quiet years, as the timeline does', () => {
    expect(currentLevel([pt('2019-07-01', 'Novice'), pt('2023-07-01', 'Novice')])).toEqual({
      level: 'Novice',
      since: ms('2023-07-01'),
    })
  })

  it('is null when no level is known', () => {
    expect(currentLevel([])).toBeNull()
    expect(currentLevel([pt('2023-01-01', null)])).toBeNull()
  })
})

describe('seasons', () => {
  it('runs September to August, named by both years', () => {
    expect(seasonOf(ms('2025-09-01'))).toBe(2025)
    expect(seasonOf(ms('2026-03-14'))).toBe(2025)
    expect(seasonOf(ms('2025-08-31'))).toBe(2024)
    expect(seasonLabel(2025)).toBe('2025–26')
    expect(seasonLabel(1999)).toBe('1999–00')
  })

  it('lists seasons newest first, quiet seasons run together, and stops at the latest', () => {
    expect(
      seasons([pt('2019-07-01', 'Primary'), pt('2019-08-01', null), pt('2023-03-05', 'Premier'), pt('2023-05-05', null)]),
    ).toEqual([
      { kind: 'year', year: 2022, count: 2, placed: 0, level: 'Premier', levels: ['Premier', null] },
      { kind: 'gap', fromYear: 2019, toYear: 2021 },
      { kind: 'year', year: 2018, count: 2, placed: 0, level: 'Primary', levels: ['Primary', null] },
    ])
  })

  it('puts an autumn competition in the season after the summer before it', () => {
    expect(seasons([pt('2025-07-01', null), pt('2025-10-01', null)]).map((s) => s.kind === 'year' && s.year)).toEqual([2025, 2024])
  })

  it('takes the latest clear level when it changes within a season', () => {
    const [s] = seasons([pt('2024-01-01', 'Novice'), pt('2024-06-01', 'Intermediate'), pt('2024-07-01', null)])
    expect(s).toMatchObject({ level: 'Intermediate', levels: ['Novice', 'Intermediate', null] })
  })

  it('counts the competitions they placed at', () => {
    const [s] = seasons([pt('2024-01-01', null, 'A', { overall: 2 }), pt('2024-02-01', null, 'B', { dances: [{ name: 'Irish Jig', place: null }] })])
    expect(s).toMatchObject({ count: 2, placed: 1 })
  })

  it('is empty with nothing', () => {
    expect(seasons([])).toEqual([])
  })
})
