import { describe, expect, it } from 'vitest'
import { inboxFor, sentAgo } from '@/lib/admin/inbox'
import { gridFromText, parseGrid } from '@/lib/admin/importDancers'

const item = (extra: Record<string, unknown> = {}) => ({
  kind: 'dancers',
  source: 'Splits',
  name: 'splits.csv',
  text: '',
  sentAt: 1,
  ...extra,
})

describe('inboxFor', () => {
  it('shows lists for this competition and lists sent without one, newest first', () => {
    const tree = {
      a: item({ sentAt: 1, competitionId: 'c1' }),
      b: item({ sentAt: 3 }),
      c: item({ sentAt: 2, competitionId: 'c2' }),
    }
    expect(inboxFor(tree, 'c1').map((i) => i.id)).toEqual(['b', 'a'])
    expect(inboxFor(tree).map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('leaves out what it can’t read as a list of dancers', () => {
    expect(
      inboxFor(
        { a: item({ kind: 'results' }), b: { kind: 'dancers' }, c: 'x', d: null },
        'c1',
      ),
    ).toEqual([])
    expect(inboxFor(null, 'c1')).toEqual([])
  })
})

describe('sentAgo', () => {
  const now = Date.parse('2026-10-29T12:00:00')
  it('says how long ago, in minutes, then hours, then days', () => {
    expect(sentAgo(now - 20_000, now)).toBe('just now')
    expect(sentAgo(now - 2 * 60_000, now)).toBe('2 minutes ago')
    expect(sentAgo(now - 3 * 3_600_000, now)).toBe('3 hours ago')
  })
})

// What Splits exports: an age group heading, then its dancers (number, first, last, location).
it('a Splits export reads as a program, through the paste path', () => {
  const text = [
    'Primary 4 & Under 6 Years,,,',
    '100,Ava,Reid,Calgary',
    '101,Mia,Lee,"Edmonton, AB"',
    ',,,',
    'Beginner 6 & Under 8 Years,,,',
    '102,Isla,Ross,Banff',
  ].join('\r\n')
  const parsed = parseGrid(gridFromText(text))!
  expect(parsed.layout).toBe('program')
  expect(
    parsed.dancers.map((d) => [
      d.number,
      d.firstName,
      d.lastName,
      d.location,
      d.category,
      d.group,
    ]),
  ).toEqual([
    ['100', 'Ava', 'Reid', 'Calgary', 'Primary', '4 & Under 6 Years'],
    ['101', 'Mia', 'Lee', 'Edmonton, AB', 'Primary', '4 & Under 6 Years'],
    ['102', 'Isla', 'Ross', 'Banff', 'Beginner', '6 & Under 8 Years'],
  ])
})
