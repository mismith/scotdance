import { describe, expect, it, vi } from 'vitest'

const store: Record<string, unknown> = {}
vi.mock('@/firebase', () => ({ dataRef: (path: string) => ({ path }) }))
vi.mock('firebase/database', () => ({
  child: (parent: { path: string }, key: string) => ({ path: `${parent.path}/${key}` }),
  get: async (ref: { path: string }) => ({ val: () => store[ref.path] ?? null }),
}))

const { knownVenueFields, looseVenueName, matchKnownVenues } = await import('@/lib/knownVenues')
const { venueKey } = await import('@/lib/entityIndex')

describe('looseVenueName', () => {
  it('reads two spellings of one name the same', () => {
    expect(looseVenueName('Beaumont Community Center')).toBe(looseVenueName('Beaumont Community Centre'))
    expect(looseVenueName('St. Andrew’s Church')).toBe(looseVenueName('Saint Andrews Church'))
    expect(looseVenueName('King’s Park')).toBe(looseVenueName('Kings Park'))
    expect(looseVenueName('The Forks')).toBe('forks')
  })

  it('still tells two names apart', () => {
    expect(looseVenueName('Beaumont Arena')).not.toBe(looseVenueName('Beaumont Community Centre'))
  })
})

describe('matchKnownVenues', () => {
  const row = (id: string, name: string, locality: string | null, country: string, count: number) => ({
    id, name, locality, region: null, country, count,
  })
  const rows = [
    row('V1', 'Telus Convention Centre', 'Calgary', 'CA', 6),
    row('V2', 'Telus Convention Centre', 'Brisbane', 'AU', 2),
    row('V3', 'Seven Oaks Performing Arts Centre', 'Winnipeg', 'MB', 18),
    row('V4', 'St. Andrew’s Church', 'Antigonish', 'CA', 1),
  ]

  it('finds a venue from the start of its words, the most used first', () => {
    expect(matchKnownVenues(rows, 'telus conv').map((r) => r.id)).toEqual(['V1', 'V2'])
    expect(matchKnownVenues(rows, 'oaks arts').map((r) => r.id)).toEqual(['V3'])
    expect(matchKnownVenues(rows, 'telus center').map((r) => r.id)).toEqual(['V1', 'V2'])
    expect(matchKnownVenues(rows, 'saint andrews').map((r) => r.id)).toEqual(['V4'])
  })

  it('takes the town as a word too, and keeps to the country asked', () => {
    expect(matchKnownVenues(rows, 'telus brisbane').map((r) => r.id)).toEqual(['V2'])
    expect(matchKnownVenues(rows, 'telus', ['CA']).map((r) => r.id)).toEqual(['V1'])
  })

  it('waits for more than a letter', () => {
    expect(matchKnownVenues(rows, 't')).toEqual([])
    expect(matchKnownVenues(rows, '  ')).toEqual([])
  })
})

describe('knownVenueFields', () => {
  it('gives the venue’s own name and town (so a competition joins it), and its latest address', async () => {
    store['venues/V1'] = {
      name: 'Telus Convention Centre',
      locality: 'Calgary',
      region: 'AB',
      country: 'CA',
      lat: 51.045,
      lng: -114.06,
      appearances: {
        a: { address: '120 9 Ave SE', date: Date.parse('2019-01-01') },
        b: { address: '136 8 Ave SE', date: Date.parse('2024-01-01') },
        c: { address: null, date: Date.parse('2025-01-01') },
      },
    }
    const f = await knownVenueFields('V1')
    expect(f).toEqual({
      venue: 'Telus Convention Centre',
      address: '136 8 Ave SE',
      location: 'Calgary, AB',
      lat: 51.045,
      lng: -114.06,
      country: 'CA',
      region: 'AB',
      locality: 'Calgary',
    })
    expect(venueKey(f.venue, f.locality)).toBe('telus convention centre|calgary')
  })

  it('says so when the venue’s gone', async () => {
    await expect(knownVenueFields('gone')).rejects.toThrow()
  })
})
