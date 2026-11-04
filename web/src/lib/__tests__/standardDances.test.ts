import { describe, expect, it } from 'vitest'
import { standardDance, tidySteps } from '../standardDances'
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
      steps: '2+1',
    })
    expect(standardDance('Half Hullachan (4)')).toMatchObject({
      dance: { name: 'Half Tulloch' },
      steps: '4',
    })
  })
})

describe('tidySteps', () => {
  // Steps as organisers typed them (live data, November 2026).
  it.each([
    ['4', '4'],
    [4, '4'],
    ['3+1', '3+1'],
    ['3 & 1', '3+1'],
    ['3&1', '3+1'],
    ['2 &1', '2+1'],
    ['3 + 1', '3+1'],
    [' 4&2 ', '4+2'],
    ['4 steps', '4'],
    ['4 Steps', '4'],
    ['6 step', '6'],
    ['(4)', '4'],
    ['(2+1)', '2+1'],
    ['8 parts', '8'],
    ['4 Part', '4'],
    ['2+4 parts', '2+4'],
  ])('%j is %s', (typed, tidy) => expect(tidySteps(typed)).toBe(tidy))

  it.each(['4X', 'x4', '6x4x4', 'Intro & 8 Bars', '4 and 5', 'all', 'Scottish Lilt 4 step', '3&1 Seann Truibhas', 'NOVICE', ''])(
    'leaves %j as typed',
    (typed) => expect(tidySteps(typed)).toBe(typed),
  )

  it('trims anything else', () => expect(tidySteps(' 4X ')).toBe('4X'))
  it('reads nothing as no steps', () => expect(tidySteps(null)).toBe(''))
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

  it('tidies steps, in the name and in Steps', () => {
    expect(tidyDance({ name: 'S.T (3&1)' })).toEqual({
      name: 'Seann Truibhas',
      steps: '3+1',
      shortName: 'ST',
    })
    expect(tidyDance({ name: 'S.T (3&1)', steps: '3 & 1' })).toMatchObject({ steps: '3+1' })
    expect(tidyDance({ name: 'FLING', steps: '4 steps' })).toMatchObject({ name: 'Highland Fling', steps: '4' })
  })

  it('tidies the steps of a standard name, leaving its name and short name', () => {
    expect(tidyDance({ name: 'Seann Truibhas', steps: '3 & 1' })).toEqual({
      name: 'Seann Truibhas',
      steps: '3+1',
      shortName: '',
    })
    expect(tidyDance({ name: "Flora MacDonald's Fancy", steps: '(4)', shortName: 'FLORA' })).toEqual({
      name: "Flora MacDonald's Fancy",
      steps: '4',
      shortName: 'FLORA',
    })
  })

  it('tidies the steps of any dance', () => {
    expect(tidyDance({ name: 'Trophy Fling', steps: '4 steps' })).toEqual({
      name: 'Trophy Fling',
      steps: '4',
      shortName: '',
    })
    expect(tidyDance({ name: 'Novice', steps: 'Scottish Lilt 4 step' })).toBeNull()
    expect(tidyDance({ name: 'Highland Fling', steps: 4 })).toBeNull()
  })

  it('leaves a standard name as it is, apostrophes either way', () => {
    expect(tidyDance({ name: 'Highland Fling', shortName: 'Fling', steps: '4' })).toBeNull()
    expect(tidyDance({ name: "Flora MacDonald's Fancy", shortName: 'Flora' })).toBeNull()
    expect(tidyDance({ name: 'Trophy Fling' })).toBeNull()
    expect(tidyDance({ name: 'Seann Truibhas' })).toBeNull()
  })
})
