// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { strayDancers } from '../../../../functions/src/strayDancers'

// Stray dancer entries (functions/src/strayDancers.ts), as System admin ›
// Dancer cleanup lists them. The shapes are ones found in production.

const why = (list: ReturnType<typeof strayDancers>) => Object.fromEntries(list.map((d) => [d.id, d.why]))

describe('strayDancers', () => {
  it('lists entries with no name, or with neither a number nor an age group', () => {
    const list = strayDancers({
      ok: { firstName: 'Ella', lastName: 'Bussiere', number: 307, groupId: 'g1' },
      noName: { number: 173, groupId: 'g1' },
      empty: {},
      leftover: { lastName: 'f' },
      noGroup: { firstName: 'Ivy', lastName: 'Tregarthen', number: 12 },
      noNumber: { firstName: 'Emily', lastName: 'Hval', groupId: 'g1' },
    })
    expect(why(list)).toEqual({ noName: 'No name', empty: 'No name', leftover: 'No number or age group' })
  })

  it('never lists an entry a result or point names', () => {
    const list = strayDancers(
      { placed: { number: 5 }, tied: { number: 6 }, pointed: { number: 7 }, stray: { number: 8 } },
      { g1: { fling: ['placed', 'tied:tie'], overall: false } },
      { g1: { fling: { judge1: ['pointed'] } } },
    )
    expect(list.map((d) => d.id)).toEqual(['stray'])
  })

  it('says which entry a leftover copy copies', () => {
    const list = strayDancers({
      real: { firstName: 'Adalia', lastName: 'Wambolt', number: 149, groupId: 'g1' },
      copy: { firstName: 'Adalia', lastName: 'Wambolt ' },
    })
    expect(list).toEqual([{ id: 'copy', firstName: 'Adalia', lastName: 'Wambolt ', why: 'No number or age group', copyOf: 149 }])
  })
})
