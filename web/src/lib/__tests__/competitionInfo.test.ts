import { describe, expect, it } from 'vitest'
import { directions, staffHeading } from '@/lib/competitionInfo'

describe('staffHeading', () => {
  it('pluralises the types organisers type', () => {
    expect(staffHeading('Judge', 3)).toBe('Judges')
    expect(staffHeading('Piper', 2)).toBe('Pipers')
    expect(staffHeading('Secretary', 2)).toBe('Secretaries')
    expect(staffHeading('Hostess', 2)).toBe('Hostesses')
    expect(staffHeading('Coach', 2)).toBe('Coaches')
  })
  it('leaves one, a plural, and words with no plural as they are', () => {
    expect(staffHeading('Piper', 1)).toBe('Piper')
    expect(staffHeading('Judges', 3)).toBe('Judges')
    expect(staffHeading('Stewards', 4)).toBe('Stewards')
    expect(staffHeading('Staff', 5)).toBe('Staff')
    expect(staffHeading('Day', 2)).toBe('Days')
  })
})

describe('directions', () => {
  it('goes to the venue by its full address', () => {
    const d = directions({ venue: 'Spruce Meadows', address: '18011 Spruce Meadows Way SW', location: 'Calgary, AB' })!
    expect(d.address).toBe('Spruce Meadows, 18011 Spruce Meadows Way SW, Calgary, AB')
    expect(d.google).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Spruce%20Meadows%2C%2018011%20Spruce%20Meadows%20Way%20SW%2C%20Calgary%2C%20AB',
    )
  })
  it('has nowhere to go without a place', () => {
    expect(directions({})).toBeNull()
    expect(directions(null)).toBeNull()
  })
})
