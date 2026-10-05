import { describe, expect, it, vi } from 'vitest'

// A competition's date goes through search (the Typesense index the
// competition triggers keep, then searchAll) as the date the competition has,
// so a search hit's date tile agrees with the Competitions list. The index
// used to hold ms of UTC midnight, which the app reads as an instant: in the
// Americas, Saturday 12 December showed as Friday the 11th.

const indexed: Array<Record<string, unknown>> = []
let respond: () => unknown = () => ({})

// The index and the callable are fakes; CI's unit tests don't install the
// functions' own dependencies.
vi.mock('../../../../functions/src/utility/typesense', () => ({
  getTypesense: () => ({
    collections: () => ({
      documents: () => ({
        upsert: async (doc: Record<string, unknown>) => {
          indexed.push(doc)
        },
      }),
    }),
  }),
  indexBestEffort: (_what: string, work: () => Promise<unknown>) => work(),
  sameExcept: () => false,
}))
vi.mock('../../../../functions/src/utility/competition', () => ({ ensureAdmin: async () => {} }))
vi.mock('@/firebase', () => ({ functions: {} }))
vi.mock('firebase/functions', () => ({ httpsCallable: () => async () => ({ data: respond() }) }))

const Competitions = await import('../../../../functions/src/competitions')
const { searchAll } = await import('@/lib/searchAll')
const { parseDate } = await import('@/lib/format')

async function index(competition: Record<string, unknown>, competitionId = 'c1') {
  await Competitions.onCreate({ val: () => competition }, { params: { competitionId } })
  return indexed.at(-1)!
}

describe('a competition’s date in search', () => {
  it('stays the day it’s on, wherever you are', async () => {
    const doc = await index({ name: 'Cowal Highland Gathering', date: '2026-12-12' })
    expect(doc.date).toBe('2026-12-12')

    respond = () => ({ competitions: { hits: [{ document: doc }], found: 1 } })
    const { competitions } = await searchAll({ q: 'cowal' })
    const hit = competitions.hits[0]
    expect(hit.date).toBe('2026-12-12')
    // What the date tile shows: Saturday the 12th, local midnight.
    expect(parseDate(hit.date!)).toEqual(new Date(2026, 11, 12))
  })

  it('reads an old admin’s dates the way the Competitions list does', async () => {
    for (const date of ['2018-07-02T06:00:00.000Z', '2018-12-12T09:00', 1530511200000]) {
      const doc = await index({ name: 'Old', date })
      expect(doc.date).toBe(String(date))
      expect(parseDate(doc.date as string)).toEqual(parseDate(date))
    }
  })

  it('leaves out a date that isn’t set', async () => {
    for (const date of [undefined, null, '']) {
      expect((await index({ name: 'TBA', date })).date).toBeUndefined()
    }
  })
})
