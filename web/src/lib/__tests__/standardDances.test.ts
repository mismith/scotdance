import { describe, expect, it } from 'vitest'
import { standardDance } from '../standardDances'
import { tidyDance } from '../admin/danceCleanup'

// Names as organisers typed them (live data, November 2026).
const nameOf = (typed: string) => standardDance(typed)?.dance.name ?? null

describe('standardDance', () => {
  it.each([
    ['FLING', 'Highland Fling'],
    ['HIghland Fling', 'Highland Fling'],
    ['S.T', 'Seann Truibhas'],
    ['SEAN TRIUBHAS', 'Seann Truibhas'],
    ['Seann Tribuhas', 'Seann Truibhas'],
    ["PDB'S & HIGHCUTS", 'Pas de basques & High Cuts'],
    ['Pas de Basque w/ High Cuts', 'Pas de basques & High Cuts'],
    ['PDB & H/C', 'Pas de basques & High Cuts'],
    ['16 Pas de Basques', 'Pas de basques'],
    ["Sailors' Hornpipe", 'Sailors Hornpipe'],
    ["Flora McDonald's Fancy", 'Flora MacDonald’s Fancy'],
    ['Wilt Thou Go to the Barracks, Johnny?', 'Barracks Johnnie'],
    ['Strathspey and Highland Reel', 'Strathspey & Highland Reel'],
    ['Strathspey & 1/2 Tulloch', 'Strathspey & Half Tulloch'],
    ['1/2Hullachan', 'Half Tulloch'],
    ['Half Hullchan', 'Half Tulloch'],
    ['Half Tulloch', 'Half Tulloch'],
  ])('%s is the %s', (typed, standard) => expect(nameOf(typed)).toBe(standard))

  it.each([
    'Trophy Fling',
    'Special Jig',
    'Highland Fling Championship',
    'Solo Choreography',
    'Hullachan',
    'Reel of Tulloch',
    'Full Tulloch',
    'Written Paper',
    'Jingle Bell (Irish) Jig',
    'Overall',
    '',
  ])('leaves %j as typed', (typed) => expect(nameOf(typed)).toBeNull())

  it('reads steps written into the name', () => {
    expect(standardDance('Sword (2&1)')).toMatchObject({
      dance: { name: 'Sword Dance' },
      steps: '2&1',
    })
    expect(standardDance('Half Hullachan (4)')).toMatchObject({
      dance: { name: 'Half Tulloch' },
      steps: '4',
    })
  })
})

describe('tidyDance', () => {
  it('saves the standard name and short name', () => {
    expect(tidyDance({ name: 'FLING', steps: '4', shortName: 'FLING' })).toEqual({
      name: 'Highland Fling',
      steps: '4',
      shortName: 'Fling',
    })
    expect(tidyDance({ name: 'Sword' })).toEqual({
      name: 'Sword Dance',
      steps: '',
      shortName: 'Sword',
    })
  })

  it('keeps a short name of its own', () => {
    expect(tidyDance({ name: 'LILT', shortName: 'Lilt 4' })).toEqual({
      name: 'Scottish Lilt',
      steps: '',
      shortName: 'Lilt 4',
    })
  })

  it('moves steps in the name to Steps', () => {
    expect(tidyDance({ name: 'Fling (4)' })).toEqual({
      name: 'Highland Fling',
      steps: '4',
      shortName: 'Fling',
    })
    expect(tidyDance({ name: 'Village Maid (4)', steps: '4' })).toEqual({
      name: 'Village Maid',
      steps: '4',
      shortName: '',
    })
  })

  it('leaves steps in the name that say something else than Steps', () => {
    expect(tidyDance({ name: 'Fling (4)', steps: '6' })).toBeNull()
  })

  it('leaves a standard name as it is, apostrophes either way', () => {
    expect(tidyDance({ name: 'Highland Fling', shortName: 'Fling', steps: '4' })).toBeNull()
    expect(tidyDance({ name: "Flora MacDonald's Fancy", shortName: 'Flora' })).toBeNull()
    expect(tidyDance({ name: 'Trophy Fling' })).toBeNull()
    expect(tidyDance({ name: 'Seann Truibhas' })).toBeNull()
  })
})
