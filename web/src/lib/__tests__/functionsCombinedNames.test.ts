// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { combinedNames } from '../../../../functions/src/combinedNames'

// Whole names typed in First name (functions/src/combinedNames.ts), as System
// admin › Dancer cleanup lists them to split.

describe('combinedNames', () => {
  it('lists the whole names in a competition that typed them all in First name', () => {
    const list = combinedNames({
      a: { firstName: 'Adelyn Dalgleish', number: 257 },
      b: { firstName: 'Adeline Riehl', lastName: '', number: 196 },
      c: { firstName: ' Smith, Isla ', number: 12 },
      d: { firstName: 'Cher', number: 300 },
      e: {},
      f: { firstName: 'Lily Siecker & Grace Thompson', number: 450 },
      g: { firstName: 'Ava and Mia Grant', number: 451 },
    })
    expect(list).toEqual([
      { id: 'c', number: 12, firstName: 'Smith, Isla' },
      { id: 'b', number: 196, firstName: 'Adeline Riehl' },
      { id: 'a', number: 257, firstName: 'Adelyn Dalgleish' },
    ])
  })

  it('leaves a competition that uses Last name, however its few double first names look', () => {
    expect(
      combinedNames({
        a: { firstName: 'Mary Jane', number: 1 },
        b: { firstName: 'Anna Rose', number: 2 },
        c: { firstName: 'Ella Grace', number: 3 },
        d: { firstName: 'Isla', lastName: 'Ross', number: 4 },
        e: { firstName: 'Ava', lastName: 'Grant', number: 5 },
        f: { firstName: 'Mia', lastName: 'Bell', number: 6 },
      }),
    ).toEqual([])
  })

  it('needs a few before it calls it a pattern', () => {
    expect(combinedNames({ a: { firstName: 'Adelyn Dalgleish' }, b: { firstName: 'Adeline Riehl' } })).toEqual([])
  })
})
