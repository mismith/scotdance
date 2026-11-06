import { describe, it, expect } from 'vitest'
import { acronym, organisationSuggestions } from '../organisationSuggestions'

describe('organisation suggestions from submissions', () => {
  it('finds the full Red Deer organisation without the event suffix', () => {
    expect(organisationSuggestions('Red Deer Region Highland Dance Association Open Competition', []).fresh)
      .toEqual([{ name: 'Red Deer Region Highland Dance Association', shortName: '' }])
  })
  it('finds BCHDA for each event in the winter series without expanding it', () => {
    for (const n of [1, 2, 3]) expect(organisationSuggestions(`BCHDA Winter Competition Series #${n}`, []).fresh)
      .toEqual([{ name: 'BCHDA', shortName: 'BCHDA' }])
  })
  it('reuses an existing BCHDA and suppresses a draft already accepted', () => {
    const org = { id: 'bc', name: 'BC Highland Dancing Association', shortName: 'BCHDA' }
    expect(organisationSuggestions('BCHDA Winter Competition Series #2', [org])).toEqual({ existing: [org], fresh: [], term: 'BCHDA' })
    expect(organisationSuggestions('BCHDA Winter Competition Series #2', [org], ['bc'])).toEqual({ existing: [], fresh: [], term: '' })
    expect(organisationSuggestions('BCHDA Winter Competition Series #2', [], [], [{ name: 'BCHDA', shortName: 'BCHDA' }]).fresh).toEqual([])
  })
  it('searches first for the name as the competition writes it', () => {
    const org = { id: 'm', name: 'Manitoba Highland Dancers’ Association', shortName: 'MHDA' }
    expect(organisationSuggestions('MHDA Winter Competition', [org]).term).toBe('MHDA')
    expect(organisationSuggestions('Manitoba Highland Dancers’ Association Open', [org]).term).toBe('Manitoba Highland Dancers’ Association')
    expect(organisationSuggestions('BCHDA Winter Competition', []).term).toBe('BCHDA')
    expect(organisationSuggestions('Winter Competition', [org]).term).toBe('')
  })
  it('does not confuse CHDA with BCHDA or invent an organisation for generic titles', () => {
    expect(organisationSuggestions('BCHDA Winter Competition', [{ id: 'c', shortName: 'CHDA' }]).existing).toEqual([])
    for (const name of ['Winter Competition Series #1', 'Highland Games 2027', 'RSOBHD Open', 'BANFF HIGHLAND GAMES']) {
      expect(organisationSuggestions(name, []).fresh).toEqual([])
    }
  })
  it('matches complete names with punctuation and possessives', () => {
    const org = { id: 'r', name: 'Red Deer Region Highland Dance Association' }
    expect(organisationSuggestions('Red Deer Region Highland Dance Association’s Open Competition', [org]).existing).toEqual([org])
    expect(organisationSuggestions('2027 Red Deer Region Highland Dance Association Open', [org]).fresh).toEqual([])
  })
  it('guesses a short name from the full name', () => {
    expect(acronym('Montreal Highland Dance Association')).toBe('MHDA')
    expect(acronym('Manitoba Highland Dancers’ Association of Canada')).toBe('MHDAC')
    expect(acronym('BC Highland Dancing Association')).toBe('BCHDA')
    expect(acronym('Fédération de danse écossaise')).toBe('FDÉ')
    expect(acronym('BCHDA')).toBe('')
    expect(acronym('')).toBe('')
  })
})
