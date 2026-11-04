// @vitest-environment node
import { describe, expect, it } from 'vitest'
import * as server from '../../../../functions/src/capitals'
import * as app from '@/lib/capitals'

// The app's copy of the server's tidying (import) spells everything System
// admin › Cleanup › Capitals does, the same way. Text as it was entered in
// production.

const typed = [
  'MARY',
  'KYLEIGH-ANN',
  'MACKENZIE',
  'MCGILL',
  "O'HARE",
  'MIA',
  'ON',
  'VIC',
  'CALGARY, AB',
  'HIGH RIVER',
  'PREMIER III',
  'PAS DE BAS & HIGHCUTS',
  'STRATHSPEY & REEL OF TULLOCH',
  '16 & UNDER 18 YEARS',
  'E.C.H.D.A 59th OPEN CHAMPIONSHIP',
  'SDTA (ON)',
  'Mary MACKENZIE',
  'McLeod',
]
const elsewhere = ['Mackenzie Reid', 'MacKenzie', 'Mackenzie', 'Mia Lee', 'ECHDA January Competition', 'SDTA Milton', 'Niagara-on-the-Lake']

describe('the app’s capitals mirror the server’s', () => {
  const dicts = [app.known(app.learn(elsewhere))]
  it('learns the same spellings', () => {
    expect(dicts[0]).toEqual(server.known(server.learn(elsewhere)))
  })

  it.each(typed)('%s', (s) => {
    expect(app.allCapitals(s)).toBe(server.allCapitals(s))
    expect(app.isShouting(s)).toBe(server.isShouting(s))
    expect(app.isShouting(s, dicts[0])).toBe(server.isShouting(s, dicts[0]))
    expect(app.tidyCapitals(s)).toBe(server.tidyCapitals(s))
    expect(app.tidyCapitals(s, ...dicts)).toBe(server.tidyCapitals(s, ...dicts))
    expect(app.spelled(s, ...dicts)).toBe(server.spelled(s, ...dicts))
  })
})
