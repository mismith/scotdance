import { describe, expect, it } from 'vitest'
import { danceName, groupByDance, type DanceMark } from '@/lib/danceResults'

let n = 0
const mark = (rawName: string, date: string, place: number | null = 1, extra: Partial<DanceMark> = {}): DanceMark => ({
  competitionId: `c${(n += 1)}`,
  entryId: 'me',
  date: new Date(`${date}T12:00:00`).getTime(),
  competitionName: `Games ${n}`,
  rawName,
  place,
  tied: false,
  ...extra,
})

describe('danceName', () => {
  it('folds spellings and steps into the standard dance', () => {
    for (const raw of ['Fling', 'FLING', 'Fling (4)', 'Highland Fling', 'Trophy Fling', 'Highland Fling Championship']) {
      expect(danceName(raw)).toMatchObject({ key: 'std:Highland Fling', name: 'Highland Fling', standard: true })
    }
  })

  it('marks special-event versions as variants', () => {
    expect(danceName('Fling').variant).toBe(false)
    expect(danceName('Trophy Fling').variant).toBe(true)
    expect(danceName('Special Event Hornpipe')).toMatchObject({ key: 'std:Sailors Hornpipe', variant: true })
    expect(danceName('Hornpipe - Dance Off')).toMatchObject({ key: 'std:Sailors Hornpipe', variant: true })
  })

  it('keeps other dances as typed, grouped ignoring case and apostrophes', () => {
    expect(danceName("Santa's Fling")).toMatchObject({ standard: false, name: "Santa's Fling" })
    expect(danceName("Santa's Fling").key).toBe(danceName('SANTAS FLING').key)
    expect(danceName('Jingle Bell Jig')).toMatchObject({ key: 'raw:jingle bell jig', standard: false, variant: false })
  })

  it('recognises Overall in any case', () => {
    expect(danceName('Overall').key).toBe('overall')
    expect(danceName(' OVERALL ').key).toBe('overall')
  })

  it('does not strip a variant word down to nothing', () => {
    expect(danceName('Special')).toMatchObject({ key: 'raw:special', standard: false })
  })
})

describe('groupByDance', () => {
  it('folds spellings into one row with the other spellings as aka', () => {
    const { dances } = groupByDance([
      mark('Fling', '2023-05-01'),
      mark('FLING', '2023-06-01'),
      mark('Fling (4)', '2024-05-01'),
      mark('Trophy Fling', '2024-06-01'),
      mark('Highland Fling', '2024-07-01'),
    ])
    expect(dances).toHaveLength(1)
    expect(dances[0]).toMatchObject({ key: 'std:Highland Fling', name: 'Highland Fling', standard: true, count: 5 })
    expect(dances[0].aka).toEqual(['Fling', 'Fling (4)', 'Trophy Fling'])
  })

  it('does not list the display name as aka, ignoring case', () => {
    const { dances } = groupByDance([mark('HIGHLAND FLING', '2023-05-01'), mark('Highland Fling', '2023-06-01')])
    expect(dances[0].aka).toEqual([])
  })

  it('buckets by season (September to August), oldest first, marks oldest first', () => {
    const { dances } = groupByDance([
      mark('Fling', '2024-08-01'),
      mark('Fling', '2022-04-01'),
      mark('Fling', '2024-03-01'),
      mark('Fling', '2024-09-14'),
    ])
    expect(dances[0].years.map((y) => y.year)).toEqual([2021, 2023, 2024])
    expect(dances[0].years[1].marks.map((m) => new Date(m.date).getMonth())).toEqual([2, 7])
  })

  it('keeps a one-off as its own row, named as typed', () => {
    const { dances } = groupByDance([mark('Fling', '2023-01-01'), mark('Jingle Bell Jig', '2023-12-01')])
    expect(dances.map((d) => [d.name, d.standard])).toEqual([
      ['Highland Fling', true],
      ['Jingle Bell Jig', false],
    ])
  })

  it('names a non-standard row by its most common spelling', () => {
    const { dances } = groupByDance([
      mark("SANTAS FLING", '2022-12-01'),
      mark("Santa's Fling", '2023-12-01'),
      mark("Santa's Fling", '2024-12-01'),
    ])
    expect(dances).toHaveLength(1)
    expect(dances[0]).toMatchObject({ name: "Santa's Fling", count: 3, aka: ['SANTAS FLING'] })
  })

  it('orders by count, then standard order, then non-standard by name', () => {
    const { dances } = groupByDance([
      mark('Zebra Jig', '2023-01-01'),
      mark('Apple Jig', '2023-01-02'),
      mark('Hornpipe', '2023-01-03'),
      mark('Fling', '2023-01-04'),
      mark('Sword', '2023-01-05'),
      mark('Sword', '2023-02-05'),
      mark('Sword', '2023-03-05'),
    ])
    expect(dances.map((d) => d.name)).toEqual([
      'Sword Dance',
      'Highland Fling',
      'Sailors Hornpipe',
      'Apple Jig',
      'Zebra Jig',
    ])
  })

  it('keeps Overall apart', () => {
    const { dances, overall } = groupByDance([mark('Fling', '2023-01-01'), mark('Overall', '2023-01-01', 2), mark('OVERALL', '2024-01-01', 1)])
    expect(dances.map((d) => d.name)).toEqual(['Highland Fling'])
    expect(overall).toMatchObject({ key: 'overall', count: 2 })
    expect(overall?.years.map((y) => y.year)).toEqual([2022, 2023])
  })

  it('has no overall when there are no overall marks', () => {
    expect(groupByDance([mark('Fling', '2023-01-01')]).overall).toBeNull()
    expect(groupByDance([])).toEqual({ dances: [], overall: null })
  })

  it('keeps danced-but-not-placed marks', () => {
    const { dances } = groupByDance([mark('Fling', '2023-01-01', null), mark('Fling', '2023-06-01', 3)])
    expect(dances[0].count).toBe(2)
    expect(dances[0].years[0].marks.map((m) => m.place)).toEqual([null, 3])
  })
})
