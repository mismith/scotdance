import { describe, expect, it } from 'vitest'
import { competitionTitle } from '../competitionTitle'

const orgs = new Map([
  ['chda', { name: 'Calgary Highland Dancing Association', shortName: 'CHDA' }],
  ['pcs', { name: 'Prairie Championship Series', shortName: 'PCS' }],
  ['plain', { name: 'No Short Name Society', shortName: null }],
])
const title = (name: string, ...ids: string[]) => competitionTitle({ name, organisations: Object.fromEntries(ids.map((id) => [id, true])) }, orgs)

describe('competition titles', () => {
  it('lead with the organisation, without saying it twice', () => {
    expect(title('CHDA Winter Wonderland', 'chda')).toEqual({ prefix: 'CHDA', organisationId: 'chda', name: 'Winter Wonderland' })
    expect(title('Calgary Highland Dancing Association Winter Wonderland', 'chda')).toEqual({ prefix: 'CHDA', organisationId: 'chda', name: 'Winter Wonderland' })
    expect(title('CHDA – Winter Wonderland', 'chda')).toEqual({ prefix: 'CHDA', organisationId: 'chda', name: 'Winter Wonderland' })
    expect(title('CHDA’s Winter Wonderland', 'chda')).toEqual({ prefix: 'CHDA', organisationId: 'chda', name: 'Winter Wonderland' })
    expect(title('Winter Wonderland', 'chda')).toEqual({ prefix: 'CHDA', organisationId: 'chda', name: 'Winter Wonderland' })
  })

  it('only takes whole words, and keeps a name that’s nothing but the organisation', () => {
    expect(title('CHDAs Winter Party', 'chda')).toEqual({ prefix: 'CHDA', organisationId: 'chda', name: 'CHDAs Winter Party' })
    expect(title('CHDA', 'chda')).toEqual({ prefix: null, organisationId: null, name: 'CHDA' })
  })

  it('picks the organisation its name starts with, else the first by short name', () => {
    expect(title('PCS Final 2026', 'chda', 'pcs')).toEqual({ prefix: 'PCS', organisationId: 'pcs', name: 'Final 2026' })
    expect(title('Spring Fling', 'pcs', 'chda')).toEqual({ prefix: 'CHDA', organisationId: 'chda', name: 'Spring Fling' })
  })

  it('on an organisation’s own page, says neither', () => {
    const within = (name: string) => competitionTitle({ name, organisations: { chda: true } }, orgs, { within: 'chda' })
    expect(within('CHDA June Classic')).toEqual({ prefix: null, organisationId: null, name: 'June Classic' })
    expect(within('Calgary Highland Dancing Association Spring Fling')).toEqual({ prefix: null, organisationId: null, name: 'Spring Fling' })
    expect(within('Fall Classic')).toEqual({ prefix: null, organisationId: null, name: 'Fall Classic' })
    expect(within('CHDA')).toEqual({ prefix: null, organisationId: null, name: 'CHDA' })
  })

  it('leaves it alone without an organisation that has a short name', () => {
    expect(title('Spring Fling')).toEqual({ prefix: null, organisationId: null, name: 'Spring Fling' })
    expect(title('Spring Fling', 'plain')).toEqual({ prefix: null, organisationId: null, name: 'Spring Fling' })
    expect(competitionTitle({ name: '  ' }, orgs)).toEqual({ prefix: null, organisationId: null, name: 'Competition' })
  })
})
