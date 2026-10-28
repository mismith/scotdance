import { describe, expect, it } from 'vitest'
import { isChampionshipName } from '@/types/competition'

// Names as organisers have written them (checked against every competition
// on 2026-10-28): the championship is in the category or the age group name.
describe('isChampionshipName', () => {
  it.each([
    ['Championship'],
    ['Premier Championship'],
    ['Pre-Championship'],
    ['Premier Pre-Championship'],
    ['Pre Championship'],
    ['Prechampionship'],
    ['Premiership'],
    ['SDC Open Championship'],
    ['Highland Championships'],
  ])('%s is one', (name) => expect(isChampionshipName(name)).toBe(true))

  it.each([['Premier'], ['Pre-Premier'], ['Novice'], ['Champagne Reel'], ['']])(
    '%s is not',
    (name) => expect(isChampionshipName(name)).toBe(false),
  )

  it('looks at every name it is given', () => {
    expect(isChampionshipName('Premier', '12 & Over Championship')).toBe(true)
    expect(isChampionshipName(undefined, null, 'Premier')).toBe(false)
  })
})
