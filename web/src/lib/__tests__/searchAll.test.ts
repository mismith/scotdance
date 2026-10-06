import { beforeEach, describe, expect, it, vi } from 'vitest'

// searchAll maps the searchAll callable's raw Typesense responses into what
// Search shows. These pin down the mapping, caching and failure handling.

const calls: unknown[] = []
let respond: (params: { q: string; perGroup?: number; types?: string[] }) => unknown = () => ({})

vi.mock('@/firebase', () => ({ functions: {} }))
vi.mock('firebase/functions', () => ({
  httpsCallable: () => async (params: { q: string; perGroup?: number; types?: string[] }) => {
    calls.push(params)
    return { data: await respond(params) }
  },
}))

const { searchAll } = await import('@/lib/searchAll')

const person = (name: string, competitionId: string, extra: Record<string, unknown> = {}) => ({
  document: { $name: name, $competitionId: competitionId, ...extra },
})
const place = (id: string, extra: Record<string, unknown>) => ({ document: { id, ...extra } })

beforeEach(() => {
  calls.length = 0
  respond = () => ({})
})

describe('searchAll', () => {
  it('doesn’t call the server for an empty or blank query', async () => {
    for (const q of ['', '   ', '\n']) {
      const out = await searchAll({ q })
      expect(out.dancers.groups).toEqual([])
      expect(out.competitions.hits).toEqual([])
    }
    expect(calls).toEqual([])
  })

  it('trims the query before searching', async () => {
    await searchAll({ q: '  trimmed query  ' })
    expect(calls).toEqual([{ q: 'trimmed query' }])
  })

  it('groups a person’s entries across competitions, with a location and initials', async () => {
    respond = () => ({
      dancers: {
        found: 12,
        grouped_hits: [
          {
            group_key: ['Isla MacDonald'],
            hits: [person('Isla MacDonald', 'c1'), person('Isla MacDonald', 'c2', { location: 'Calgary, AB' }), person('Isla MacDonald', 'c1')],
          },
        ],
      },
    })
    const out = await searchAll({ q: 'isla mac' })
    expect(out.dancers).toEqual({
      total: 12,
      groups: [{ name: 'Isla MacDonald', initials: 'IM', competitionIds: ['c1', 'c2'], location: 'Calgary, AB', image: undefined }],
    })
  })

  it('shows one row per person however their name was capitalised or accented', async () => {
    respond = () => ({
      dancers: {
        found: 3,
        grouped_hits: [
          { group_key: ['Isla MacDonald'], hits: [person('Isla MacDonald', 'c1')] },
          { group_key: ['ISLA MACDONALD'], hits: [person('ISLA MACDONALD', 'c2', { location: 'Glasgow' })] },
          { group_key: ['Geneviève Blais'], hits: [person('Geneviève Blais', 'c3')] },
        ],
      },
    })
    const out = await searchAll({ q: 'isla or genevieve' })
    expect(out.dancers.total).toBe(2)
    expect(out.dancers.groups.map((g) => [g.name, g.competitionIds, g.location])).toEqual([
      ['Isla MacDonald', ['c1', 'c2'], 'Glasgow'],
      ['Geneviève Blais', ['c3'], undefined],
    ])
  })

  it('lists competitions with a readable place, skipping hits without an id', async () => {
    respond = () => ({
      competitions: {
        found: 2,
        hits: [
          { document: { id: 'c1', name: 'Nationals', locality: 'Calgary', region: 'AB', country: 'CA', date: 1547424000000 } },
          { document: { name: 'No id' } },
          { document: { id: 'c2', $name: 'Legacy', location: 'Ottawa, ON' } },
        ],
      },
    })
    const out = await searchAll({ q: 'nat' })
    expect(out.competitions.hits.map((h) => [h.id, h.name, h.location])).toEqual([
      ['c1', 'Nationals', 'Calgary, AB, CA'],
      ['c2', 'Legacy', 'Ottawa, ON'],
    ])
  })

  it('gives competitions their organisations, and counts each organisation’s listed competitions', async () => {
    respond = () => ({
      competitions: {
        found: 2,
        hits: [
          { document: { id: 'c1', name: 'Games', organisations: ['o1', 'o2'] } },
          { document: { id: 'c2', name: 'Open', organisations: [] } },
        ],
      },
      organisations: { facet_counts: [{ field_name: 'organisations', counts: [{ value: 'o1', count: 3 }, { value: 'o2', count: 1 }] }] },
    })
    const out = await searchAll({ q: 'games' })
    expect(out.competitions.hits.map((h) => h.organisations)).toEqual([{ o1: true, o2: true }, undefined])
    expect(out.organisations.counts).toEqual({ o1: 3, o2: 1 })
  })

  it('merges towns, regions and venues into one list of places, biggest first', async () => {
    respond = () => ({
      places: {
        regions: { grouped_hits: [{ group_key: ['AB'], hits: [place('c1', { region: 'AB', country: 'CA' })] }] },
        localities: {
          grouped_hits: [
            { group_key: ['Calgary'], hits: [place('c1', { locality: 'Calgary', region: 'AB', country: 'CA' }), place('c2', { locality: 'Calgary' }), place('c3', {})] },
            { group_key: ['  '], hits: [place('c9', {})] },
          ],
        },
        venues: { grouped_hits: [{ group_key: ['Telus Convention Centre'], hits: [place('c1', { locality: 'Calgary', region: 'AB' }), place('c2', {})] }] },
      },
    })
    const out = await searchAll({ q: 'cal' })
    expect(out.places.groups.map((g) => [g.kind, g.name, g.count, g.parentLabel])).toEqual([
      ['locality', 'Calgary', 3, 'AB, CA'],
      ['venue', 'Telus Convention Centre', 2, 'Calgary, AB'],
      ['region', 'AB', 1, 'CA'],
    ])
  })

  it('answers repeat searches from memory, and shares one request between callers', async () => {
    let resolve!: (v: unknown) => void
    respond = () => new Promise((r) => (resolve = r))
    const a = searchAll({ q: 'grace' })
    const b = searchAll({ q: ' grace ' })
    resolve({})
    await Promise.all([a, b])
    await searchAll({ q: 'grace' })
    expect(calls).toHaveLength(1)
  })

  it('caches per page size and kinds', async () => {
    await searchAll({ q: 'reid', perGroup: 5 })
    await searchAll({ q: 'reid', perGroup: 50, types: ['dancers'] })
    expect(calls).toHaveLength(2)
  })

  it('doesn’t remember a failure, so Try again really tries again', async () => {
    respond = () => {
      throw new Error('internal')
    }
    await expect(searchAll({ q: 'offline' })).rejects.toThrow()
    respond = () => ({ dancers: { found: 0, grouped_hits: [] } })
    await expect(searchAll({ q: 'offline' })).resolves.toMatchObject({ dancers: { total: 0 } })
    expect(calls).toHaveLength(2)
  })

  it('copes with an empty or partial answer', async () => {
    respond = () => null
    const out = await searchAll({ q: 'nothing at all' })
    expect(out.places).toEqual({ groups: [], total: 0 })
    expect(out.judges).toEqual({ groups: [], total: 0 })
    expect(out.organisations).toEqual({ counts: {} })
    // An index without organisations yet (before its reindex) fails only that search.
    respond = () => ({ organisations: { code: 404, error: 'Could not find a facet field named `organisations` in the schema.' } })
    expect((await searchAll({ q: 'before the reindex' })).organisations).toEqual({ counts: {} })
  })
})
