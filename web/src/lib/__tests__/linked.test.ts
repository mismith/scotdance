import { describe, expect, it } from 'vitest'
import { PARTS } from '../../../../functions/src/links'
import { LINK_PART_IDS, groupInPlace, orderLinked, railOf, setLabel, setsByCompetition, withOthersLine } from '../linked'

// Linked competitions in lists (ADR 0007 §8): where each goes, and the words
// that say how many there are and when.

const c = (id: string, date: string, name: string) => ({ id, date, name })
const ids = (blocks: Array<{ items: Array<{ id: string }> }>) => blocks.map((b) => b.items.map((i) => i.id).join('+'))
/** Normalises the locale's range dash and its spaces, for comparing. */
const plain = (s: string | null) => s?.replace(/\s*[–-]\s*/g, '–').replace(/ | /g, ' ') ?? null

describe('orderLinked', () => {
  it('moves nothing for a weekend pair: others on its first day go above it, on its last day below', () => {
    const links: Record<string, string> = { canada: 'a', maritime: 'a' }
    const list = [
      c('riverview', '2027-07-04', 'Riverview Highland Games'),
      c('maritime', '2027-07-04', 'Maritime Open'),
      c('canada', '2027-07-03', 'Canada Day Classic'),
      c('spring', '2027-07-03', 'Moncton Spring Fling'),
    ]
    expect(ids(orderLinked(list, (id) => links[id]))).toEqual(['spring', 'canada+maritime', 'riverview'])
  })

  it('puts one on a longer group’s middle day straight after it', () => {
    const links: Record<string, string> = { opener: 'b', champ: 'b', closing: 'b' }
    const list = [
      c('lakeside', '2027-07-10', 'Lakeside Highland Games'),
      c('closing', '2027-07-11', 'Highland Week Closing'),
      c('opener', '2027-07-09', 'Highland Week Opener'),
      c('champ', '2027-07-10', 'Highland Week Championship'),
      c('later', '2027-07-12', 'Later Games'),
    ]
    expect(ids(orderLinked(list, (id) => links[id]))).toEqual(['opener+champ+closing', 'lakeside', 'later'])
  })

  it('keeps two groups starting the same day apart, first by name first', () => {
    const links: Record<string, string> = { coastal: 'c', island: 'c', prairie: 'd', chinook: 'd' }
    const list = [
      c('chinook', '2027-07-18', 'Chinook Open'),
      c('prairie', '2027-07-17', 'Prairie Summer Classic'),
      c('island', '2027-07-18', 'Island Open'),
      c('coastal', '2027-07-17', 'Coastal Highland Gathering'),
    ]
    expect(ids(orderLinked(list, (id) => links[id]))).toEqual(['coastal+island', 'prairie+chinook'])
  })

  it('groups only the ones given: one left alone is just a row', () => {
    const links: Record<string, string> = { sat: 'e', sun: 'e' }
    const blocks = orderLinked([c('sun', '2027-07-04', 'Sunday'), c('x', '2027-07-01', 'X')], (id) => links[id])
    expect(blocks).toEqual([
      { linkId: null, items: [c('x', '2027-07-01', 'X')] },
      { linkId: null, items: [c('sun', '2027-07-04', 'Sunday')] },
    ])
  })

  it('turns the whole order over for past ones, newest first', () => {
    const links: Record<string, string> = { sat: 'f', sun: 'f' }
    const list = [c('sat', '2026-07-03', 'Saturday'), c('sun', '2026-07-04', 'Sunday'), c('old', '2026-06-01', 'Old'), c('new', '2026-08-01', 'New')]
    expect(ids(orderLinked(list, (id) => links[id], { descending: true }))).toEqual(['new', 'sun+sat', 'old'])
  })
})

describe('groupInPlace', () => {
  it('keeps the ranking, pulling a group’s matches together at its best match', () => {
    const links: Record<string, string> = { sat: 'g', sun: 'g' }
    const ranked = [c('sun', '2027-07-04', 'Sunday'), c('x', '2027-01-01', 'X'), c('sat', '2027-07-03', 'Saturday')]
    expect(ids(groupInPlace(ranked, (id) => links[id]))).toEqual(['sat+sun', 'x'])
  })
})

describe('words for a set', () => {
  const week = ['05', '06', '07', '08', '09', '10', '11'].map((d, i) => c(`d${i}`, `2027-07-${d}`, `Day ${i + 1}`))

  it('says how many and when', () => {
    expect(plain(setLabel(week))).toBe('7 competitions, Jul 5–11')
    expect(plain(setLabel([c('a', '2027-06-30', 'A'), c('b', '2027-07-02', 'B')]))).toBe('2 competitions, Jun 30–Jul 2')
  })

  it('names the rest for one shown on its own', () => {
    expect(withOthersLine(c('sat', '2027-07-03', 'Canada Day Classic'), [c('sat', '2027-07-03', 'Canada Day Classic'), c('sun', '2027-07-04', 'Maritime Open')])).toBe('With Maritime Open, Jul 4')
    expect(plain(withOthersLine(week[3], week))).toBe('With 6 others, Jul 5–11')
    expect(withOthersLine(week[0], [week[0]])).toBeNull()
  })

  it('places each row on its group’s rail', () => {
    expect([0, 1, 2].map((i) => railOf(i, 3))).toEqual(['first', 'middle', 'last'])
    expect(railOf(0, 1)).toBeNull()
  })
})

describe('link data', () => {
  it('reads each competition’s set, skipping a link of one', () => {
    const sets = setsByCompetition({ L1: { primary: 'a', competitions: { a: true, b: true } }, L2: { primary: 'c', competitions: { c: true } } })
    expect(sets.get('b')).toEqual({ linkId: 'L1', primary: 'a', ids: ['a', 'b'] })
    expect(sets.has('c')).toBe(false)
  })

  it('offers the same parts, in the same order, as the functions sync', () => {
    expect(LINK_PART_IDS).toEqual([...PARTS])
  })
})
