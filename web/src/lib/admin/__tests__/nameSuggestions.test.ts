import { describe, expect, it } from 'vitest'
import { namesDancingHere, suggestNames } from '../nameSuggestions'

const premier = { label: 'Premier 12 & under' }
const here = namesDancingHere([
  { id: 'a', num: '101', firstName: 'Ava', lastName: 'Reid', group: premier },
  { id: 'b', num: '245', firstName: 'Ava', lastName: 'Reid', group: { label: 'Fling special' } },
  { id: 'c', num: '102', firstName: 'Avery', lastName: 'Shields', group: premier },
  { id: 'd', num: '103', firstName: 'Seán', lastName: 'Ó Briain', group: premier },
  // An old row with a whole group typed in: not a name to offer.
  { id: 'e', num: '234', firstName: 'Dynamic Jigs', lastName: 'Ava Lamb, Mia Lane, (ALT Avery Hope)', group: premier },
  {
    id: 't',
    num: '301',
    team: true,
    group: { label: 'Duets' },
    members: { x: { firstName: 'Mia', lastName: 'Lee', _order: 0 }, y: { firstName: 'Ava', lastName: 'Reid', _order: 1 } },
  },
])
const names = (typed: { firstName: string; lastName: string }, taken?: string[]) => suggestNames(typed, here, taken).map((s) => `${s.firstName} ${s.lastName} · ${s.line}`)

describe('names dancing here', () => {
  it('offers each name once, with its numbers, from what the first name starts', () => {
    expect(names({ firstName: 'av', lastName: '' })).toEqual(['Ava Reid · 101, 245', 'Avery Shields · 102 · Premier 12 & under'])
  })
  it('narrows by the last name too, accents aside', () => {
    expect(names({ firstName: 'av', lastName: 'sh' })).toEqual(['Avery Shields · 102 · Premier 12 & under'])
    expect(names({ firstName: 'sean', lastName: 'o b' })).toEqual(['Seán Ó Briain · 103 · Premier 12 & under'])
  })
  it('a full name typed in the first box still finds them', () => {
    expect(names({ firstName: 'ava r', lastName: '' })).toEqual(['Ava Reid · 101, 245'])
  })
  it('never offers a list of names typed as one', () => {
    expect(names({ firstName: 'dyn', lastName: '' })).toEqual([])
  })
  it('says which duet someone dancing only in one is in', () => {
    expect(names({ firstName: 'mi', lastName: '' })).toEqual(['Mia Lee · in 301'])
  })
  it('waits for two letters, and leaves out the name already there and the entry’s other dancers', () => {
    expect(names({ firstName: 'a', lastName: '' })).toEqual([])
    expect(names({ firstName: 'Ava', lastName: 'Reid' })).toEqual([])
    expect(names({ firstName: 'av', lastName: '' }, ['Ava Reid'])).toEqual(['Avery Shields · 102 · Premier 12 & under'])
  })
})
