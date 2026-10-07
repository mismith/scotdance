// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { nameProblem, reviewReasons, sameName, type ReviewContext } from '../../../../functions/src/review'

// Whether a new submission can be approved as it arrives (functions/src/review.ts),
// or why it waits for a person. The names are ones submitted in production.

const CONTEXT: ReviewContext = { today: '2026-10-06', competitions: [], submissions: [], unclaimed: [] }
const COMPETITION = { name: 'Cowal Games Highland Dancing', date: '2027-08-27', venue: 'Dunoon Stadium', location: 'Dunoon' }
const reasons = (competition: Record<string, unknown>, context: Partial<ReviewContext> = {}, extra: Record<string, unknown> = {}) =>
  reviewReasons({ competition: { ...COMPETITION, ...competition }, ...extra }, { ...CONTEXT, ...context })

describe('a competition’s name', () => {
  it('passes when it’s written as a competition’s', () => {
    for (const name of [
      'Cowal Games Highland Dancing',
      'Festival of Dance in Memory of Jean Ross',
      'BC Open',
      'SDCC Championships',
      'Highland Dancing at the Games',
      'St Andrew’s Society Highland Dance Competition',
    ]) {
      expect(nameProblem(name), name).toBeNull()
    }
  })

  it('says what’s wrong with it', () => {
    expect(nameProblem('Test')).toBe('The name is too short')
    expect(nameProblem('Highland')).toBe('The name is one word')
    expect(nameProblem('Test Highland Games')).toBe('The name looks like a test or placeholder')
    expect(nameProblem('[WIP] Spring Fling')).toBe('The name looks like a test or placeholder')
    expect(nameProblem('COWAL HIGHLAND GAMES')).toBe('The name is in capitals')
    expect(nameProblem('cowal highland games')).toBe('The name is in lowercase')
    expect(nameProblem('cowal Highland Games')).toBe('The name starts with a lowercase letter')
    expect(nameProblem('Cowal highland Games')).toBe('“highland” in the name is lowercase')
    expect(nameProblem('Mary Smith Lessons')).toBe('The name doesn’t look like a competition’s')
  })

  it('takes a registration number as saying it’s a competition', () => {
    expect(nameProblem('Mary Smith Lessons', { hasNumber: true })).toBeNull()
  })

  it('checks a year in it against the date', () => {
    expect(nameProblem('Spring Fling 2026', { year: 2026 })).toBeNull()
    expect(nameProblem('Spring Fling 2025', { year: 2026 })).toBe('The name says 2025, but the date is in 2026')
  })
})

describe('the same competition', () => {
  it('is most of the longer name’s words, years aside', () => {
    expect(sameName('Cowal Games Highland Dancing', 'Cowal Highland Dancing Games 2027')).toBe(true)
    expect(sameName('Spring Fling', 'Summer Fling')).toBe(false)
    expect(sameName('Cowal Games', '')).toBe(false)
  })
})

describe('what needs a look', () => {
  it('is nothing for a tidy submission', () => {
    expect(reasons({})).toEqual([])
    expect(reasons({ sobhd: 'C-ON-CO-27-2609' })).toEqual([])
  })

  it('is the date, when there’s none, it’s passed or it’s far off', () => {
    expect(reasons({ date: '' })).toEqual(['There’s no date'])
    expect(reasons({ date: '2026-10-05' })).toEqual([])
    expect(reasons({ date: '2026-10-01' })).toEqual(['The date has passed'])
    expect(reasons({ date: '2028-06-01' })).toEqual(['The date is more than 18 months away'])
  })

  it('is a missing town, or a number it can’t read', () => {
    expect(reasons({ location: ' ' })).toEqual(['There’s no town or city'])
    expect(reasons({ sobhd: 'BSC2109056B' })).toEqual(['The registration number “BSC2109056B” isn’t in a format it knows'])
  })

  it('is any organisation it starts, or claims without being one of its admins', () => {
    expect(reasons({}, {}, { newOrganisations: { a: { name: 'Dunoon Dancers' } } })).toEqual(['It starts a new organisation: Dunoon Dancers'])
    expect(reasons({}, { unclaimed: ['Cowal Highland Gathering'] })).toEqual(['It lists it under Cowal Highland Gathering, though they’re not one of its admins'])
  })

  it('is the same competition already here, or already submitted, that day', () => {
    expect(reasons({}, { competitions: ['Cowal Highland Dancing Games 2027 '] })).toEqual(['“Cowal Highland Dancing Games 2027” is already here on the same day'])
    expect(reasons({}, { submissions: ['Cowal Games Highland Dancing'] })).toEqual(['“Cowal Games Highland Dancing” was already submitted for the same day'])
    expect(reasons({}, { competitions: ['Braemar Gathering'] })).toEqual([])
  })

  it('is everything it finds, at once', () => {
    expect(reasons({ name: 'COWAL GAMES', date: '', location: '' })).toEqual(['The name is in capitals', 'There’s no date', 'There’s no town or city'])
  })
})
