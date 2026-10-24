import { describe, expect, it, vi } from 'vitest'

vi.mock('@/firebase', () => ({ dataRef: (path: string) => ({ path }) }))

const {
  canonicalFields,
  defaultKeeper,
  duplicateGroups,
  googleFits,
  keepApart,
  leaveSeparate,
  mergeVenues,
  namesAlike,
  separated,
  tierOf,
  venuesFrom,
  wordDiff,
} = await import('../venueMerge')
type Comps = Parameters<typeof venuesFrom>[0]

// Shapes from the live list (October 2026): one place, typed several ways.
const BEAUMONT = { lat: 53.3566, lng: -113.4147, country: 'CA', region: 'AB', locality: 'Beaumont', location: 'Beaumont, AB' }
const comps: Comps = {
  c1: { venue: 'Beaumont Community Centre', address: '5204-50 Avenue', date: Date.parse('2024-05-01'), listed: true, venueId: 'V1', ...BEAUMONT },
  c2: { venue: 'Beaumont Community Centre', address: '5204 - 50 Ave', date: Date.parse('2019-05-01'), published: true, venueId: 'V1', ...BEAUMONT },
  c3: { venue: 'Beaumont Community Center', address: '5204 – 50 Avenue', date: Date.parse('2023-05-01'), listed: true, venueId: 'V2', ...BEAUMONT },
  // A town left out: same name, the pin a little off.
  c4: { venue: 'Beaumont Community Centre', address: '5204 50 Ave', date: Date.parse('2018-05-01'), listed: true, venueId: 'V3', lat: 53.36, lng: -113.41, country: 'CA' },
  // Private, so not on a venue, but spelled like a merged one.
  c5: { venue: 'Beaumont  community center', locality: 'Beaumont', date: Date.parse('2026-05-01') },
  // Same name, other side of the world.
  c6: { venue: 'Telus Convention Centre', locality: 'Calgary', lat: 51.045, lng: -114.06, country: 'CA', listed: true, venueId: 'V4' },
  c7: { venue: 'Telus Convention Centre', locality: 'Brisbane', lat: -27.47, lng: 153.02, country: 'AU', listed: true, venueId: 'V5' },
  // Next door but another building.
  c8: { venue: 'Beaumont Arena', locality: 'Beaumont', lat: 53.3589, lng: -113.4147, country: 'CA', listed: true, venueId: 'V6' },
}
const venues = venuesFrom(comps)
const byId = (id: string) => venues.find((v) => v.id === id)!
// What Google has for the place.
const GOOGLE = { venue: 'Beaumont Community Center', address: '5204 50 Ave', location: 'Beaumont, AB', ...BEAUMONT, lat: 53.3567, lng: -113.4148 }

describe('venuesFrom', () => {
  it('makes each venue from its listed competitions, latest first', () => {
    expect(byId('V1').competitionIds).toEqual(['c1', 'c2'])
    expect(byId('V1').fields.address).toBe('5204-50 Avenue')
    expect(byId('V1').key).toBe('beaumont community centre|beaumont')
  })

  it('leaves out competitions on no venue', () => {
    expect(venues.flatMap((v) => v.competitionIds)).not.toContain('c5')
  })
})

describe('duplicateGroups', () => {
  it('groups one place typed several ways, the most used first', () => {
    expect(duplicateGroups(venues).map((g) => g.map((v) => v.id))).toEqual([['V1', 'V2', 'V3']])
  })

  it('keeps apart same names far away, and a building next door', () => {
    const ids = duplicateGroups(venues).flat().map((v) => v.id)
    expect(ids).not.toContain('V4')
    expect(ids).not.toContain('V6')
  })

  it('leaves out pairs marked as different places', () => {
    const apart = keepApart('V3', [byId('V1'), byId('V2'), byId('V3')])
    expect(apart).toEqual({ 'venues:distinct/V1/V3': true, 'venues:distinct/V2/V3': true })
    const distinct = { V1: { V3: true }, V2: { V3: true } }
    expect(duplicateGroups(venues, distinct).map((g) => g.map((v) => v.id))).toEqual([['V1', 'V2']])
  })
})

describe('namesAlike and tierOf', () => {
  it('reads one name written differently as alike', () => {
    for (const [a, b] of [
      ['King’s Park', 'Kings Park'],
      ['Jubliee Place', 'Jubilee Place'],
      ['Rock Pointe Church', 'RockPointe Church'],
      ['Prince George Conference and Civic Centre', 'Prince George Civic and Conference Centre'],
      ['Hyatt Regency', 'Hyatt Regency Calgary'],
      ['Leduc Composite High School', 'Leduc Composite Senior High School'],
    ]) expect(namesAlike(a, b), `${a} / ${b}`).toBe(true)
  })

  it('tells different names apart', () => {
    for (const [a, b] of [
      ['Ukrainian Youth Unity Complex', 'W. P. Wagner School'],
      ['Montcalm Secondary School', 'Montcalm Highschool'],
      ['Dekker Centre', 'Nations West Field House'],
      ['Hall', 'Emmaus Hall'],
    ]) expect(namesAlike(a, b), `${a} / ${b}`).toBe(false)
  })

  it('sorts a group by how sure it is', () => {
    expect(tierOf([byId('V1'), byId('V2'), byId('V3')])).toBe('name')
    const at = (id: string, venue: string, lat: number) => ({ id, key: id, competitionIds: [], fields: { ...GOOGLE, venue, lat } })
    expect(tierOf([at('a', 'Ukrainian Youth Unity Complex', 53.5), at('b', 'W. P. Wagner School', 53.5)])).toBe('spot')
    expect(tierOf([at('a', 'Dekker Centre', 53.5), at('b', 'Nations West Field House', 53.5009)])).toBe('near')
  })
})

describe('Google’s version', () => {
  const group = [byId('V1'), byId('V2'), byId('V3')]

  it('counts only when Google’s place is at the group’s pin', () => {
    expect(googleFits(group, GOOGLE)).toBe(true)
    expect(googleFits(group, { ...GOOGLE, lat: 53.4 })).toBe(false)
    expect(googleFits(group, null)).toBe(false)
  })

  it('keeps the one named as Google names it, even when it’s used least', () => {
    expect(defaultKeeper(group, GOOGLE).id).toBe('V2')
    expect(defaultKeeper(group, null).id).toBe('V1')
    expect(defaultKeeper(group, { ...GOOGLE, venue: 'Somewhere Else' }).id).toBe('V1')
  })

  it('gives Google’s address and pin under the kept venue’s name and town', () => {
    expect(canonicalFields(byId('V1'), GOOGLE)).toEqual({
      venue: 'Beaumont Community Centre',
      address: '5204 50 Ave',
      location: 'Beaumont, AB',
      lat: GOOGLE.lat,
      lng: GOOGLE.lng,
      country: 'CA',
      region: 'AB',
      locality: 'Beaumont',
    })
    expect(canonicalFields(byId('V2'), GOOGLE).venue).toBe('Beaumont Community Center')
    expect(canonicalFields(byId('V1'), null)).toEqual(byId('V1').fields)
  })
})

describe('mergeVenues', () => {
  const group = [byId('V1'), byId('V2'), byId('V3')]
  const keep = byId('V1')
  const favorites = {
    a: { venues: { V2: 'Beaumont Community Center' } },
    b: { venues: { V1: 'Beaumont Community Centre', V3: true } },
    c: { venues: { V4: 'Telus Convention Centre' } },
    d: null,
  }
  const fields = canonicalFields(keep, GOOGLE)
  const merge = mergeVenues({ keep, group, fields, comps, synced: new Set(), favorites })

  it('gives every competition in the group the same fields, the kept venue’s own too', () => {
    expect(merge.after['competitions/c3/venue']).toBe('Beaumont Community Centre')
    expect(merge.after['competitions/c3/address']).toBe('5204 50 Ave')
    expect(merge.after['competitions/c1/address']).toBe('5204 50 Ave')
    expect(merge.after['competitions/c4/locality']).toBe('Beaumont')
    expect(merge.before['competitions/c4/locality']).toBeNull()
    expect(merge.before['competitions/c1/address']).toBe('5204-50 Avenue')
  })

  it('takes in a private competition spelled like a merged venue', () => {
    expect(merge.after['competitions/c5/venue']).toBe('Beaumont Community Centre')
    expect(merge.competitions).toBe(5)
  })

  it('leaves other venues alone, and writes only what differs', () => {
    expect(Object.keys(merge.after).filter((p) => /c[678]\//.test(p))).toEqual([])
    expect(merge.after).not.toHaveProperty('competitions/c3/country')
  })

  it('moves followers to the kept venue', () => {
    expect(merge.after).toMatchObject({
      'users:favorites/a/venues/V2': null,
      'users:favorites/a/venues/V1': 'Beaumont Community Centre',
      'users:favorites/b/venues/V3': null,
    })
    expect(merge.after).not.toHaveProperty('users:favorites/b/venues/V1')
    expect(merge.before).toMatchObject({ 'users:favorites/a/venues/V1': null, 'users:favorites/b/venues/V3': true })
    expect(merge.followers).toBe(2)
  })

  it('leaves a competition sharing its venue from a linked one to the link', () => {
    const m = mergeVenues({ keep, group, fields, comps, synced: new Set(['c3']), favorites: {} })
    expect(Object.keys(m.after).some((p) => p.startsWith('competitions/c3/'))).toBe(false)
  })

  it('refuses fields that would make another venue', () => {
    expect(() => mergeVenues({ keep, group, fields: { ...fields, locality: 'Leduc' }, comps, synced: new Set(), favorites: {} })).toThrow()
  })
})

describe('leaving venues separate', () => {
  it('marks every pair, and lists them together to bring back', () => {
    const marks = leaveSeparate([byId('V1'), byId('V2'), byId('V3')])
    expect(Object.keys(marks).sort()).toEqual(['venues:distinct/V1/V2', 'venues:distinct/V1/V3', 'venues:distinct/V2/V3'])
    const distinct = { V1: { V2: true, V3: true }, V2: { V3: true }, V4: { gone: true } }
    const list = separated(venues, distinct)
    expect(list.map((s) => s.venues.map((v) => v.id))).toEqual([['V1', 'V2', 'V3']])
    expect(list[0].paths.sort()).toEqual(Object.keys(marks).sort())
    expect(duplicateGroups(venues, distinct)).toEqual([])
  })
})

describe('wordDiff', () => {
  const marks = (a: string, b: string) => wordDiff(a, b).map((p) => (p.kind === 'same' ? p.text : `${p.kind === 'diff' ? '[' : '<'}${p.text}${p.kind === 'diff' ? ']' : '>'}`)).join(' ')

  it('marks the words that differ, case and punctuation included', () => {
    expect(marks('Regina Performing Arts Center', 'Regina Performing Arts Centre')).toBe('Regina Performing Arts [Center]')
    expect(marks('1077 Angus St.', '1077 Angus St')).toBe('1077 Angus [St.]')
    expect(marks('150 Canada St, Moncton, NB E1C 0V2', '150 Canada St')).toBe('150 Canada [St, Moncton, NB E1C 0V2]')
    expect(marks('1077 Angus St', '1077 Angus St')).toBe('1077 Angus St')
  })

  it('marks where words are missing, unless something stands in their place', () => {
    expect(marks('Seven Oaks Performing Centre', 'Seven Oaks Performing Arts Centre')).toBe('Seven Oaks Performing <Arts> Centre')
    expect(marks('Hyatt Regency', 'Hyatt Regency Calgary')).toBe('Hyatt Regency <Calgary>')
    expect(marks('5204-50 Avenue', '5204 50 Ave')).toBe('[5204-50 Avenue]')
  })
})

