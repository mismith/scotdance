import { describe, expect, it } from 'vitest'
import {
  compareChoices,
  matches,
  ROW_CLOSEST,
  ROW_MAX,
  sections,
  shortlist,
  type CompetitionChoice,
} from '@/components/search/choices'

function choice(id: string, days: number, extra: Partial<CompetitionChoice> & { name?: string; location?: string } = {}): CompetitionChoice {
  const { name = id, location, ...rest } = extra
  return {
    id,
    competition: { id, name, location },
    days,
    today: days === 0,
    followed: false,
    dancers: [],
    near: false,
    ...rest,
  }
}
const ids = (list: CompetitionChoice[]) => list.map((c) => c.id)
const ranked = (...list: CompetitionChoice[]) => [...list].sort(compareChoices)

describe('compareChoices', () => {
  it('puts what’s on today first, then the nearest by days, either way', () => {
    expect(ids(ranked(choice('later', 9), choice('lastWeek', -6), choice('today', 0), choice('tomorrow', 1)))).toEqual([
      'today',
      'tomorrow',
      'lastWeek',
      'later',
    ])
  })

  it('counts day 2 of a competition that started yesterday as today', () => {
    expect(ids(ranked(choice('tomorrow', 1), choice('dayTwo', -1, { today: true })))).toEqual(['dayTwo', 'tomorrow'])
  })

  it('breaks a tie with yours (followed, or your dancers entered), then your area, then the earlier', () => {
    expect(ids(ranked(choice('a', 0), choice('mine', 0, { followed: true })))).toEqual(['mine', 'a'])
    expect(ids(ranked(choice('a', 0), choice('ava', 0, { dancers: [{ id: 'p1', name: 'Ava' }] })))).toEqual(['ava', 'a'])
    expect(ids(ranked(choice('far', 0), choice('near', 0, { near: true })))).toEqual(['near', 'far'])
    expect(ids(ranked(choice('next', 2), choice('last', -2)))).toEqual(['last', 'next'])
    // Yours never beats a nearer one: the closest stays first.
    expect(ids(ranked(choice('mine', 3, { followed: true }), choice('soon', 1)))).toEqual(['soon', 'mine'])
  })
})

describe('shortlist', () => {
  it('shows every choice when there are only a few', () => {
    const list = ranked(...Array.from({ length: ROW_MAX }, (_, i) => choice(`c${i}`, i)))
    expect(ids(shortlist(list))).toEqual(ids(list))
  })

  it('with many, shows the closest few, then yours further out', () => {
    const list = ranked(
      ...Array.from({ length: 30 }, (_, i) => choice(`c${i}`, i)),
      choice('followed', 20, { followed: true }),
      choice('entered', -25, { dancers: [{ id: 'p1', name: 'Ava' }] }),
    )
    const row = shortlist(list)
    expect(ids(row)).toEqual(['c0', 'c1', 'c2', 'followed', 'entered'].slice(0, ROW_MAX))
    expect(row.slice(0, ROW_CLOSEST).every((c) => !c.followed)).toBe(true)
  })

  it('keeps one picked from the full list at the front, and nothing twice', () => {
    const list = ranked(...Array.from({ length: 30 }, (_, i) => choice(`c${i}`, i)))
    expect(ids(shortlist(list, ['c20']))).toEqual(['c20', 'c0', 'c1', 'c2'])
    expect(ids(shortlist(list, ['c1']))).toEqual(['c0', 'c1', 'c2'])
    expect(ids(shortlist(list, ['gone']))).toEqual(['c0', 'c1', 'c2'])
  })
})

describe('matches', () => {
  const c = choice('x', 3, { name: 'Montréal Highland Games', location: 'Montréal, QC' })

  it('finds by any part of the name or town, ignoring case and accents', () => {
    expect(matches(c, 'montreal')).toBe(true)
    expect(matches(c, 'HIGHLAND')).toBe(true)
    expect(matches(c, 'qc games')).toBe(true)
    expect(matches(c, '')).toBe(true)
    expect(matches(c, '   ')).toBe(true)
  })

  it('needs every word typed', () => {
    expect(matches(c, 'montreal fling')).toBe(false)
    expect(matches(c, 'fergus')).toBe(false)
  })
})

describe('sections', () => {
  it('splits by date: today, coming up soonest first, earlier latest first', () => {
    const out = sections(ranked(choice('t', 0), choice('next', 1), choice('later', 9), choice('last', -2), choice('old', -20)))
    expect(out.map((s) => [s.label, ids(s.choices)])).toEqual([
      ['Today', ['t']],
      ['Coming up', ['next', 'later']],
      ['Earlier', ['last', 'old']],
    ])
  })

  it('leaves out empty sections', () => {
    expect(sections([choice('next', 1)]).map((s) => s.key)).toEqual(['upcoming'])
  })
})
