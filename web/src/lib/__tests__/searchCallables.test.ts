// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The search callables (searchDancers for v3, searchAll for v4) take a name
// to find and nothing else: anyone can sign up, and dancers are mostly
// minors, so no caller may list every dancer or read more of an entry than
// the app shows.

/** Typesense search params: untyped JSON. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

const searched: Json[] = []
vi.mock('../../../../functions/src/utility/typesense', () => ({
  getTypesense: () => ({
    multiSearch: {
      perform: async ({ searches }: { searches: Json[] }) => {
        searched.push(...searches)
        return { results: searches.map(() => ({ found: 0 })) }
      },
    },
  }),
}))

const { getOnSearch } = await import('../../../../functions/src/dancers')
const { getOnSearchAll } = await import('../../../../functions/src/search')

const data: Record<string, unknown> = {
  'competitions:published': { c1: true },
  'competitions:listed': { c2: true },
}
const db = {
  child: (path: string) => ({ get: async () => ({ val: () => data[path] ?? null }) }),
}
const signedIn = { auth: { uid: 'u1' } }
const wildcards = ['*', ' * ', '**', '-isla', '*-isla', '.', '', '   ', 42, undefined]

beforeEach(() => {
  searched.length = 0
})

describe('searchDancers', () => {
  const search = getOnSearch(db)

  it('takes only the q from the caller, as v3 sends it', async () => {
    await search(
      {
        q: ' isla ',
        page: 40,
        per_page: 250,
        group_limit: 1,
        include_fields: 'birthdate',
        facet_by: '$name',
        filter_by: '',
      },
      signedIn,
    )
    expect(searched).toEqual([
      {
        collection: 'dancers',
        q: 'isla',
        query_by: '$name',
        filter_by: '$competitionId:[`c1`]',
        group_by: '$name',
        group_limit: 99,
        per_page: 99,
        include_fields:
          'id,$competitionId,$name,firstName,lastName,number,groupId,location,website',
      },
    ])
  })

  it('turns away a q that would match everyone', async () => {
    for (const q of wildcards) {
      await expect(search({ q }, signedIn), String(q)).rejects.toMatchObject({
        code: 'invalid-argument',
      })
    }
    await expect(search(null, signedIn)).rejects.toMatchObject({
      code: 'invalid-argument',
    })
    expect(searched).toEqual([])
  })

  it('still needs someone signed in', async () => {
    await expect(search({ q: 'isla' }, {})).rejects.toMatchObject({
      code: 'unauthenticated',
    })
  })
})

describe('searchAll', () => {
  const searchAll = getOnSearchAll(db)

  it('finds nothing for a q that would match everything', async () => {
    for (const q of wildcards) {
      const out = await searchAll({ q }, {})
      expect(Object.values(out), String(q)).toEqual([null, null, null, null, null, null])
    }
    expect(searched).toEqual([])
  })

  it('asks for only the fields the app reads, and no dancer’s photo', async () => {
    await searchAll({ q: 'isla' }, {})
    const withHits = searched.filter((s) => s.per_page !== 0)
    expect(withHits.length).toBeGreaterThan(0)
    for (const s of withHits) expect(s.include_fields, s.collection).toBeTruthy()
    expect(searched.find((s) => s.collection === 'dancers').include_fields).toBe(
      '$name,$competitionId,location',
    )
  })
})
