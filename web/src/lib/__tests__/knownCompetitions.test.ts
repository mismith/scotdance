import { describe, expect, it } from 'vitest'
import {
  anySuggestions,
  dayOf,
  inCountry,
  movedOn,
  near,
  sameCompetition,
  sameDayLastYear,
  suggestionsFor,
  townOf,
  type HereCompetition,
  type KnownCompetition,
} from '@/lib/knownCompetitions'
import { countryChoice } from '@/lib/submitCountries'

// "Is it one of these?" on Add a competition (ADR 0009): which known
// competitions, competitions already here and yours from last year it
// offers for a day and country.

const known = (k: Partial<KnownCompetition> & { name: string; date: string }): KnownCompetition => ({
  key: `sdc:${k.date}:${k.name}`,
  source: 'sdc',
  country: 'CA',
  ...k,
})

describe('the day', () => {
  it('is near when any day it runs is within a day of it', () => {
    expect(near('2026-10-24', '2026-10-24')).toBe(true)
    expect(near('2026-10-24', '2026-10-25')).toBe(true)
    expect(near('2026-10-24', '2026-10-23')).toBe(true)
    expect(near('2026-10-24', '2026-10-26')).toBe(false)
    expect(near('2026-10-24', '2026-10-20', '2026-10-23')).toBe(true)
    expect(near('2026-10-24', '2026-10-20', '2026-10-22')).toBe(false)
  })

  it('reads however a date was stored', () => {
    expect(dayOf('2026-10-24')).toBe('2026-10-24')
    expect(dayOf(new Date(2026, 9, 24).getTime())).toBe('2026-10-24')
    expect(dayOf('')).toBeNull()
    expect(dayOf(undefined)).toBeNull()
  })

  it('a year before is the same date, Feb 29 aside', () => {
    expect(sameDayLastYear('2027-10-23')).toBe('2026-10-23')
    expect(sameDayLastYear('2028-02-29')).toBe('2027-02-28')
  })
})

describe('the country', () => {
  it('is the one chosen, or not said', () => {
    expect(inCountry(countryChoice('CA'), { country: 'CA', region: 'AB' })).toBe(true)
    expect(inCountry(countryChoice('CA'), { country: 'US' })).toBe(false)
    expect(inCountry(countryChoice('CA'), {})).toBe(true)
  })

  it('in the UK, the nation chosen, or one that doesn’t say', () => {
    const scotland = countryChoice('GB-SCT')
    expect(inCountry(scotland, { country: 'GB', region: 'Scotland' })).toBe(true)
    expect(inCountry(scotland, { country: 'GB', region: 'England' })).toBe(false)
    expect(inCountry(scotland, { country: 'GB' })).toBe(true)
    expect(inCountry(countryChoice('GB'), { country: 'GB', region: 'England' })).toBe(true)
  })
})

describe('the same competition', () => {
  it('by its name, venue and town, near enough', () => {
    const fall = known({ name: 'CHDA Winter Wonderland Competition', date: '2026-11-21', venue: 'Bearspaw Christian School', locality: 'Calgary', region: 'AB' })
    expect(sameCompetition(fall, { id: 'a', name: 'Winter Wonderland', location: 'Calgary, AB' })).toBe(true)
    expect(sameCompetition(fall, { id: 'b', name: 'Bearspaw Open', venue: 'Bearspaw Christian School', location: 'Calgary, AB' })).toBe(true)
    expect(sameCompetition(fall, { id: 'c', name: 'Calgary Fall Classic', venue: 'Somewhere Else', location: 'Calgary, AB' })).toBe(false)
  })
})

describe('the suggestions', () => {
  const day = '2026-10-24'
  const canada = countryChoice('CA')
  const here: HereCompetition[] = [
    { id: 'here-1', name: 'EHDA National Competition', date: '2026-10-24', venue: 'W.P. Wagner High School', location: 'Edmonton, AB', country: 'CA' },
    { id: 'here-2', name: 'Tucson Celtic Festival', date: '2026-10-24', location: 'Tucson, AZ', country: 'US' },
    { id: 'here-3', name: 'Spooky Competition', date: '2026-10-25', location: 'Victoria, BC' },
    { id: 'here-4', name: 'Too Late Games', date: '2026-10-26', location: 'Regina, SK' },
  ]
  const list = [
    known({ name: 'EHDA National Competition', date: '2026-10-24', venue: 'W.P. Wagner High School', locality: 'Edmonton', region: 'AB' }),
    known({ name: 'BHDA Fall Festival and Workshop', date: '2026-10-24', end: '2026-10-25', locality: 'Battleford', region: 'SK' }),
    known({ name: 'CIHDA Fall Open Competition', date: '2026-10-23', locality: 'Prince George', region: 'BC' }),
    known({ key: 'rsobhd:x', source: 'rsobhd', name: 'Canada’s Capital City Open Championships', date: '2026-10-24', locality: 'Orleans', region: 'ON' }),
    known({ key: 'usa:x', source: 'scotdance-usa', name: 'Tucson Celtic Festival', date: '2026-10-24', country: 'US' }),
    known({ name: 'Last Week Games', date: '2026-10-17', end: '2026-10-18' }),
  ]
  const mine: HereCompetition[] = [
    { id: 'mine-1', name: 'Fall Classic 2025', date: '2025-10-25', location: 'Calgary, AB' },
    { id: 'mine-2', name: 'Spring Fling', date: '2025-05-10' },
    { id: 'mine-3', name: 'Halloween Open', date: '2025-11-08' },
  ]

  it('groups yours from last year, each source’s, and what’s here, in that country, nearest first', () => {
    const s = suggestionsFor(day, canada, { known: list, here, mine })
    expect(s.yours.map((c) => c.id)).toEqual(['mine-1', 'mine-3'])
    expect(s.known.map((g) => [g.source.heading, g.competitions.map((k) => k.name)])).toEqual([
      ['From ScotDance Canada’s event list', ['BHDA Fall Festival and Workshop', 'CIHDA Fall Open Competition']],
      ['From the RSOBHD’s calendar', ['Canada’s Capital City Open Championships']],
    ])
    // Not the US one, nor one two days on.
    expect(s.here.map((c) => c.id)).toEqual(['here-1', 'here-3'])
    expect(anySuggestions(s)).toBe(true)
  })

  it('leaves out a known one that’s already here, and any it’s told to', () => {
    const s = suggestionsFor(day, canada, { known: list, here, mine: [], skip: ['sdc:2026-10-23:CIHDA Fall Open Competition', 'here-3'] })
    expect(s.known.flatMap((g) => g.competitions.map((k) => k.name))).not.toContain('EHDA National Competition')
    expect(s.known.flatMap((g) => g.competitions.map((k) => k.name))).not.toContain('CIHDA Fall Open Competition')
    expect(s.here.map((c) => c.id)).toEqual(['here-1'])
  })

  it('is nothing on a quiet day', () => {
    const s = suggestionsFor('2027-01-02', canada, { known: list, here, mine })
    expect(s).toEqual({ yours: [], known: [], here: [] })
    expect(anySuggestions(s)).toBe(false)
    expect(anySuggestions(null)).toBe(false)
  })
})

describe('filling it in', () => {
  it('moves a name’s years on, a season’s too', () => {
    expect(movedOn('Fall Classic 2026', 1)).toBe('Fall Classic 2027')
    expect(movedOn('2026-27 BCHDA Winter Competition Series', 1)).toBe('2027-28 BCHDA Winter Competition Series')
    expect(movedOn('2099/00 Series', 1)).toBe('2100/01 Series')
    expect(movedOn('W&DHDA 9th Annual Winter', 1)).toBe('W&DHDA 9th Annual Winter')
    expect(movedOn('Fall Classic 2026', 0)).toBe('Fall Classic 2026')
  })

  it('writes the town as the app does', () => {
    expect(townOf({ locality: 'Calgary', region: 'AB' })).toBe('Calgary, AB')
    expect(townOf({ locality: 'Dunoon', region: 'Scotland' })).toBe('Dunoon')
    expect(townOf({ locality: 'Marton' })).toBe('Marton')
    expect(townOf({ region: 'QLD' })).toBe('')
  })
})
