import { describe, expect, it } from 'vitest'
import {
  currentLevel,
  levelOf,
  levelStretches,
  seasonLabel,
  seasonOf,
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


describe('seasonOf', () => {
  it('runs September to August, named by both years', () => {
    expect(seasonOf(ms('2025-09-01'))).toBe(2025)
    expect(seasonOf(ms('2026-03-14'))).toBe(2025)
    expect(seasonOf(ms('2025-08-31'))).toBe(2024)
    expect(seasonLabel(2025)).toBe('2025–26')
    expect(seasonLabel(1999)).toBe('1999–00')
  })
})
