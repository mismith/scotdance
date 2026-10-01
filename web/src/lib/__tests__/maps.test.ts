import { describe, expect, it, vi } from 'vitest'

// A stand-in for Google's Places library: one place per id.
const PLACES: Record<string, { displayName: string; types: string[]; components: Array<[string, string, string]>; lat: number; lng: number }> = {
  hall: {
    displayName: 'Spruce Meadows',
    types: ['establishment', 'point_of_interest'],
    components: [
      ['street_number', '18011', '18011'],
      ['route', 'Spruce Meadows Way SW', 'Spruce Meadows Way Southwest'],
      ['locality', 'Calgary', 'Calgary'],
      ['administrative_area_level_1', 'AB', 'Alberta'],
      ['country', 'CA', 'Canada'],
    ],
    lat: 50.9,
    lng: -114.1,
  },
  street: {
    displayName: '120 9 Ave SE',
    types: ['street_address'],
    components: [
      ['street_number', '120', '120'],
      ['route', '9 Ave SE', '9 Avenue Southeast'],
      ['locality', 'Calgary', 'Calgary'],
      ['administrative_area_level_1', 'AB', 'Alberta'],
      ['country', 'CA', 'Canada'],
    ],
    lat: 51.04,
    lng: -114.06,
  },
  glasgow: {
    displayName: 'Kelvin Hall',
    types: ['establishment'],
    components: [
      ['route', 'Argyle St', 'Argyle Street'],
      ['postal_town', 'Glasgow', 'Glasgow'],
      ['administrative_area_level_1', 'Scotland', 'Scotland'],
      ['country', 'GB', 'United Kingdom'],
    ],
    lat: 55.868,
    lng: -4.29,
  },
}

vi.mock('@googlemaps/js-api-loader', () => ({
  setOptions: () => {},
  importLibrary: async () => ({
    Place: class {
      displayName = ''
      types: string[] = []
      addressComponents: Array<{ types: string[]; shortText: string; longText: string }> = []
      location: { lat: () => number; lng: () => number } | null = null
      constructor(private opts: { id: string }) {}
      async fetchFields() {
        const p = PLACES[this.opts.id]
        this.displayName = p.displayName
        this.types = p.types
        this.addressComponents = p.components.map(([type, shortText, longText]) => ({ types: [type], shortText, longText }))
        this.location = { lat: () => p.lat, lng: () => p.lng }
      }
    },
  }),
}))

const { resolveVenue } = await import('@/lib/maps')

describe('resolveVenue', () => {
  it('fills the venue, address and a short "Town, Province" location, as v3 wrote it', async () => {
    expect(await resolveVenue('hall')).toEqual({
      venue: 'Spruce Meadows',
      address: '18011 Spruce Meadows Way SW',
      location: 'Calgary, AB',
      lat: 50.9,
      lng: -114.1,
      country: 'CA',
      region: 'AB',
      locality: 'Calgary',
    })
  })

  it('leaves the venue empty when an address was picked', async () => {
    expect(await resolveVenue('street')).toMatchObject({ venue: null, address: '120 9 Ave SE', location: 'Calgary, AB' })
  })

  it('uses the postal town where there’s no locality (UK)', async () => {
    expect(await resolveVenue('glasgow')).toMatchObject({ venue: 'Kelvin Hall', address: 'Argyle St', location: 'Glasgow, Scotland', locality: 'Glasgow', country: 'GB' })
  })
})
