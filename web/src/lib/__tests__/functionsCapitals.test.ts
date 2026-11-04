// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { capitalsIn, dictionaries, isShouting, known, learn, tidyCapitals, undot } from '../../../../functions/src/capitals'

// Text typed all in capitals, written as it's spelled (functions/src/
// capitals.ts), as import tidies it and System admin › Cleanup › Capitals
// lists it. The cases are as they were entered in production.

const spelled = (...values: string[]) => known(learn(values))

describe('isShouting', () => {
  it.each(['MARY', 'PREMIER', '12 & UNDER 14 YEARS', 'E.C.H.D.A 59th OPEN CHAMPIONSHIP', 'SEANN TRIUBHAS'])('%s is in capitals', (s) => {
    expect(isShouting(s)).toBe(true)
  })
  it.each(['Mary', 'PDB', 'SCO', 'AB', 'ECHDA January Competition', 'McLeod', '', '101'])('%s is not', (s) => {
    expect(isShouting(s)).toBe(false)
  })
})

describe('tidyCapitals', () => {
  it.each([
    ['MARY', 'Mary'],
    ['KYLEIGH-ANN', 'Kyleigh-Ann'],
    ['MCGILL', 'McGill'],
    ["O'HARE", "O'Hare"],
    ['16 & UNDER 18 YEARS', '16 & Under 18 Years'],
    ['STRATHSPEY & REEL OF TULLOCH', 'Strathspey & Reel of Tulloch'],
    ['PAS DE BAS & HIGHCUTS', 'Pas de Bas & Highcuts'],
    ['59th OPEN CHAMPIONSHIP', '59th Open Championship'],
    ['CALGARY, AB', 'Calgary, AB'],
    ['A LEFT', 'A Left'],
    ['PREMIER III', 'Premier III'],
    ['PDB/HC FLING', 'PDB/HC Fling'],
  ])('%s is %s', (s, to) => {
    expect(tidyCapitals(s)).toBe(to)
  })

  it('leaves text with small letters alone', () => {
    expect(tidyCapitals('Mary MACKENZIE')).toBe('Mary MACKENZIE')
  })

  it('spells words as they are typed elsewhere, the most typed first', () => {
    const names = spelled('MacKenzie', 'Mackenzie Reid', 'Mackenzie', 'McLeod', 'Kyleigh-Ann')
    expect(tidyCapitals('MACKENZIE MCLEOD', names)).toBe('Mackenzie McLeod')
    expect(tidyCapitals('MACISAAC', spelled('Camryn MacIsaac'))).toBe('MacIsaac')
  })

  it('keeps an abbreviation typed in capitals elsewhere', () => {
    expect(tidyCapitals('ECHDA 57th OPEN CHAMPIONSHIP DANCER OF THE DAY', spelled('ECHDA January Competition', 'Dancer of the Day'))).toBe(
      'ECHDA 57th Open Championship Dancer of the Day',
    )
  })

  it('takes short words only from the same kind of thing', () => {
    expect(tidyCapitals('SDTA (ON)', spelled('SDTA Milton'), spelled('Dancing on the Green'))).toBe('SDTA (ON)')
    expect(tidyCapitals('ED LEE', spelled('Ed Lee'))).toBe('Ed Lee')
  })
})

describe('undot', () => {
  it.each([
    ['E.C.H.D.A. FEBRUARY COMPETITION', 'ECHDA FEBRUARY COMPETITION'],
    ['E.C.H.D.A 59th OPEN CHAMPIONSHIP', 'ECHDA 59th OPEN CHAMPIONSHIP'],
    ['S.O.S. Kildonnan Camp Society Winter Competition', 'SOS Kildonnan Camp Society Winter Competition'],
    ['P. F. Steele Hall', 'P. F. Steele Hall'],
    ['St. Andrew’s Games', 'St. Andrew’s Games'],
    ['ECHDA National Competition', 'ECHDA National Competition'],
  ])('%s is %s', (s, to) => {
    expect(undot(s)).toBe(to)
  })
})

describe('capitalsIn', () => {
  const others = {
    a: {
      dancers: { x: { firstName: 'Kyla', lastName: 'McGill', location: 'Calgary, AB' } },
      categories: { c: { name: 'Premier' } },
      groups: { g: { name: '12 & Under 14 Years' } },
    },
  }
  const dicts = dictionaries(others, ['ECHDA January Competition'])

  it('lists each thing in capitals with what it becomes, dancers by number', () => {
    const { fixes, dotted } = capitalsIn(
      {
        dancers: {
          d2: { number: 202, firstName: 'KYLA', lastName: 'MCGILL', location: 'Calgary, AB' },
          d1: { number: 101, firstName: 'Mia', lastName: 'Lee' },
          d3: { number: 12, firstName: 'NORAH', lastName: 'Ward', location: 'HIGH RIVER' },
        },
        categories: { c1: { name: 'PREMIER' } },
        groups: { g1: { name: '12 & UNDER 14 YEARS', categoryId: 'c1' } },
        staff: { s1: { firstName: 'GILLIAN', lastName: 'DUNN' } },
      },
      'ECHDA JANUARY COMPETITION',
      dicts,
    )
    expect(dotted).toBeNull()
    expect(fixes).toEqual([
      { path: 'name', what: 'Name', fields: { name: ['ECHDA JANUARY COMPETITION', 'ECHDA January Competition'] } },
      { path: 'categories/c1', what: 'Category', fields: { name: ['PREMIER', 'Premier'] } },
      { path: 'groups/g1', what: 'Age group', fields: { name: ['12 & UNDER 14 YEARS', '12 & Under 14 Years'] } },
      { path: 'staff/s1', what: 'Staff', fields: { firstName: ['GILLIAN', 'Gillian'], lastName: ['DUNN', 'Dunn'] } },
      { path: 'dancers/d3', what: '12', fields: { firstName: ['NORAH', 'Norah'], location: ['HIGH RIVER', 'High River'] } },
      { path: 'dancers/d2', what: '202', fields: { firstName: ['KYLA', 'Kyla'], lastName: ['MCGILL', 'McGill'] } },
    ])
  })

  it('keeps what was dotted in capitals, typed that way elsewhere or not', () => {
    expect(capitalsIn({}, 'S.O.S. KILDONNAN WINTER COMPETITION', new Map()).dotted?.fields.name[1]).toBe('SOS Kildonnan Winter Competition')
  })

  it('fixes a dotted name on its own, capitals and all', () => {
    const { fixes, dotted } = capitalsIn({}, 'E.C.H.D.A. FEBRUARY COMPETITION', dicts)
    expect(fixes).toEqual([])
    expect(dotted).toEqual({ path: 'name', what: 'Name', fields: { name: ['E.C.H.D.A. FEBRUARY COMPETITION', 'ECHDA February Competition'] } })
  })

  it('leaves states and provinces in capitals, even in the wrong column', () => {
    const dicts = dictionaries({ a: { dancers: { x: { firstName: 'Mia', lastName: 'Lee', location: 'Melbourne, Vic' }, y: { location: 'Niagara-on-the-Lake' } } } }, [])
    expect(capitalsIn({ dancers: { d: { number: 1, firstName: 'MIA', lastName: 'ON', location: 'VIC' } } }, 'Cowal', dicts).fixes).toEqual([
      { path: 'dancers/d', what: '1', fields: { firstName: ['MIA', 'Mia'] } },
    ])
  })

  it('takes every name in capitals in a list typed that way, short ones too', () => {
    const { fixes } = capitalsIn({ dancers: { a: { number: 1, firstName: 'NOA', lastName: 'MACDOUGALL' }, b: { number: 2, firstName: 'AJ', lastName: 'REX' }, c: { number: 3, firstName: 'Ava', lastName: 'Reid' } } }, '', new Map())
    expect(fixes.map((f) => f.fields)).toEqual([
      { firstName: ['NOA', 'Noa'], lastName: ['MACDOUGALL', 'Macdougall'] },
      { lastName: ['REX', 'Rex'] },
    ])
  })

  it('finds nothing in text typed properly', () => {
    expect(capitalsIn(others.a, 'Cowal Highland Gathering', dicts)).toEqual({ fixes: [], dotted: null })
  })
})
