import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeName } from '../../../../functions/src/utility/normalize'

// Entity pages are found by name through `{namespace}:index`, keyed by the
// functions' normalizeName. The web copy must match it exactly, or links
// to judges, pipers, venues and dancers silently miss.

const store: Record<string, unknown> = {}
const reads: string[] = []
let failNext = false

vi.mock('@/firebase', () => ({ dataRef: (path: string) => ({ path }) }))
vi.mock('firebase/database', () => ({
  child: (parent: { path: string }, key: string) => ({ path: `${parent.path}/${key}` }),
  get: async (ref: { path: string }) => {
    reads.push(ref.path)
    if (failNext) {
      failNext = false
      throw new Error('Client is offline.')
    }
    return { val: () => store[ref.path] ?? null }
  },
}))

const { lookupEntityId, lookupVenueId, normalizeEntityName } = await import('@/lib/entityIndex')

const NAMES = [
  'Isla MacDonald',
  '  Isla   MacDonald  ',
  'ISLA MACDONALD',
  'Mary-Kate O’Neill',
  "Mary-Kate O'Neill",
  'Ó Briain',
  'Zoë Saldaña',
  'Anne-Marie St. John',
  'Lisa (Barker)',
  'Calgary, AB',
  'Telus Convention Centre',
  '32333',
  'Dancer #12',
  '🙂 Emoji Name 🙂',
  '',
  '   ',
  '---',
  'Ελένη Παπαδοπούλου',
  'Nguyễn Thị Minh',
  'tab\tand\nnewline',
  'Geneviève Breau',
  'Zoe\u0308 Saldan\u0303a',
  'İlkay Gündoğan',
  'राम कुमार',
]

describe('normalizeEntityName', () => {
  it.each(NAMES)('matches the functions for %j', (name) => {
    expect(normalizeEntityName(name)).toBe(normalizeName(name))
  })

  it('folds case, punctuation and spacing', () => {
    expect(normalizeEntityName('  Mary-Kate  O’Neill ')).toBe('mary kate o neill')
  })

  it('folds accents, however they were typed, so one person is one profile', () => {
    expect(normalizeEntityName('Geneviève Breau')).toBe('genevieve breau')
    expect(normalizeEntityName('Genevieve Breau')).toBe('genevieve breau')
    // Composed (é) and decomposed (e + ◌́) spellings match too.
    expect(normalizeEntityName('Zo\u00eb')).toBe(normalizeEntityName('Zoe\u0308'))
  })

  it('copes with legacy non-text names', () => {
    expect(normalizeEntityName(32333 as unknown as string)).toBe('32333')
    expect(normalizeEntityName(undefined as unknown as string)).toBe('')
  })
})

describe('lookups', () => {
  beforeEach(() => {
    reads.length = 0
    for (const k of Object.keys(store)) delete store[k]
  })

  it('finds a judge by any spelling of their name', async () => {
    store['judges:index/aileen robertson'] = { id: '-J1', name: 'Aileen Robertson' }
    expect(await lookupEntityId('judges', '  AILEEN   Robertson ')).toBe('-J1')
  })

  it('reads legacy entries that were a bare id', async () => {
    store['pipers:index/glenn eberth'] = '-P1'
    expect(await lookupEntityId('pipers', 'Glenn Eberth')).toBe('-P1')
  })

  it('returns null for someone not in the index', async () => {
    expect(await lookupEntityId('dancers', 'Nobody Here')).toBeNull()
  })

  it('never reads for a name with nothing in it', async () => {
    expect(await lookupEntityId('dancers', ' -- ')).toBeNull()
    expect(reads).toEqual([])
  })

  it('reads each name once', async () => {
    store['dancers:index/isla ross'] = { id: '-D1' }
    await lookupEntityId('dancers', 'Isla Ross')
    await lookupEntityId('dancers', 'isla ross')
    expect(reads.filter((r) => r === 'dancers:index/isla ross')).toHaveLength(1)
  })

  it('tries again after a failed read (e.g. offline)', async () => {
    store['dancers:index/eilidh grant'] = { id: '-D2' }
    failNext = true
    expect(await lookupEntityId('dancers', 'Eilidh Grant')).toBeNull()
    expect(await lookupEntityId('dancers', 'Eilidh Grant')).toBe('-D2')
  })

  it('keys venues on name and town, so same-named venues don’t merge', async () => {
    store['venues:index/telus convention centre|calgary'] = { id: '-V1' }
    store['venues:index/telus convention centre|none'] = { id: '-V2' }
    expect(await lookupVenueId('TELUS Convention Centre', 'Calgary')).toBe('-V1')
    expect(await lookupVenueId('Telus Convention Centre', null)).toBe('-V2')
    expect(await lookupVenueId('Telus Convention Centre', '')).toBe('-V2')
    expect(await lookupVenueId('   ', 'Calgary')).toBeNull()
  })
})
