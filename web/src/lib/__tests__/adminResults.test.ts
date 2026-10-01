import { describe, expect, it } from 'vitest'
import {
  danceState,
  isPlaceholderId,
  isTied,
  newPlaceholderId,
  parsePlacings,
  placeAt,
  removeEntry,
  serializePlacings,
  type Entry,
  type Placings,
} from '@/lib/admin/results'
import { getDanceResults } from '@/lib/results'
import type { ResultsTree } from '@/types/competition'

// Results entry must write exactly what the old (v3) admin wrote, since v3
// apps in the field still read it. v3's save (root
// src/views/competition/admin/Results.vue) is ported here as the reference.

/** What v3 stored for a list of placed dancers. RTDB stores [] as nothing. */
function v3Save(dancers: Entry[], reverseFrom: number | null, set?: false | null) {
  let value: string[] | false | null = set !== undefined ? set : dancers.map((d) => `${d.id}${d.tie ? ':tie' : ''}`)
  if (Array.isArray(value) && reverseFrom) value = [`reverse:${reverseFrom}`, ...value]
  return Array.isArray(value) && !value.length ? null : value
}

/** v3's reading of a stored array: the place shown beside entry `index`. */
function v3Shown(raw: string[], index: number) {
  let reverseFrom: number | null = null
  let ids = raw
  if (raw[0]?.startsWith('reverse:')) {
    reverseFrom = Number.parseInt(raw[0].slice(8), 10) || null
    ids = raw.slice(1)
  }
  const ds = ids.map((x) => ({ tie: x.split(':')[1] === 'tie' }))
  if (reverseFrom) {
    const next = ds.slice(index + 1).findIndex((d) => !d.tie)
    const end = next < 0 ? ds.length - 1 : index + next
    return reverseFrom - end > 0 ? reverseFrom - end : null
  }
  return ds.reduce((place, d, i) => (i > index || d.tie ? place : i + 1), 0) || null
}

const e = (id: string, tie = false): Entry => ({ id, tie })
const P = (entries: Entry[], reverseFrom: number | null = null): Placings => ({ reverseFrom, entries })

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32
    return seed / 2 ** 32
  }
}

describe('parsePlacings / serializePlacings', () => {
  it('round-trips every well-formed stored shape unchanged', () => {
    const shapes = [
      ['a'],
      ['a', 'b:tie', 'c'],
      ['a', 'b', 'c:tie', 'd:tie'],
      ['reverse:6', 'f', 'e', 'd:tie', 'c', 'b', 'a'],
      ['reverse:6'],
      ['1546578400210', '-LhvSPjvKW8LgeThAXTn:tie'],
    ]
    for (const raw of shapes) expect(serializePlacings(parsePlacings(raw))).toEqual(raw)
  })

  it('stores nothing (null) for an empty list, and keeps false for "none placed"', () => {
    expect(serializePlacings(P([]))).toBeNull()
    expect(parsePlacings(false)).toEqual(P([]))
    expect(danceState(false)).toBe('none')
  })

  it('keeps Championship on before anyone is placed, as v3 did', () => {
    expect(serializePlacings(P([], 6))).toEqual(['reverse:6'])
    expect(serializePlacings(P([], 6))).toEqual(v3Save([], 6))
    expect(parsePlacings(['reverse:6'])).toEqual(P([], 6))
    expect(danceState(['reverse:6'])).toBe('todo')
  })

  it('never stores a tie on the first entry, and reads a legacy one as untied', () => {
    expect(serializePlacings(P([e('a', true), e('b', true)]))).toEqual(['a', 'b:tie'])
    expect(serializePlacings(P([e('a', true), e('b')], 3))).toEqual(['reverse:3', 'a', 'b'])
    expect(parsePlacings(['a:tie', 'b:tie'])).toEqual(P([e('a'), e('b', true)]))
  })

  it('ignores gaps, stray markers and bad starting places', () => {
    const odd = ['reverse:0', 'a', null, '', 5, 'reverse:2', 'b:tie'] as unknown as string[]
    expect(parsePlacings(odd)).toEqual(P([e('a'), e('b', true)]))
    expect(parsePlacings(['reverse:x', 'a']).reverseFrom).toBeNull()
    expect(parsePlacings({ 0: 'a' } as unknown as string[])).toEqual(P([]))
  })
})

describe('v3 parity: what v4 writes', () => {
  it('writes what v3 wrote for the same screen actions', () => {
    // Callbacks: tap a, b, c; take out b.
    let p = P([])
    for (const id of ['a', 'b', 'c']) p = { ...p, entries: [...p.entries, e(id)] }
    p = removeEntry(p, 1)
    expect(serializePlacings(p)).toEqual(v3Save([e('a'), e('c')], null))

    // A dance: tap four, tie the third with the second, then Championship from 6th.
    p = P([e('a'), e('b'), e('c'), e('d')])
    p.entries[2].tie = true
    expect(serializePlacings(p)).toEqual(v3Save(p.entries, null))
    expect(serializePlacings({ ...p, reverseFrom: 6 })).toEqual(v3Save(p.entries, 6))
    // Championship off again.
    expect(serializePlacings({ ...p, reverseFrom: null })).toEqual(v3Save(p.entries, null))
    // "No dancers placed" on, then off.
    expect(v3Save([], null, false)).toBe(false)
    expect(v3Save([], null, null)).toBeNull()
  })

  it('every list v4 writes reads with the same places in v3', () => {
    const rand = rng(7)
    for (let n = 0; n < 1000; n += 1) {
      let p = P([], rand() < 0.4 ? 2 + Math.floor(rand() * 8) : null)
      // Random taps, removals and tie switches, like an organiser would.
      for (let step = 0; step < 15; step += 1) {
        const r = rand()
        if (r < 0.55 || !p.entries.length) p = { ...p, entries: [...p.entries, e(`-D${n}-${step}`)] }
        else if (r < 0.75) p = removeEntry(p, Math.floor(rand() * p.entries.length))
        else {
          const i = Math.floor(rand() * p.entries.length)
          p = { ...p, entries: p.entries.map((x, j) => (j === i ? { ...x, tie: !x.tie } : x)) }
        }
      }
      const stored = serializePlacings(p)
      if (!stored) continue
      const again = parsePlacings(stored)
      for (let i = 0; i < again.entries.length; i += 1) {
        expect(placeAt(i, again), JSON.stringify(stored)).toEqual(v3Shown(stored, i))
      }
    }
  })
})

describe('placeAt and isTied match the public pages', () => {
  it('for random lists, forward and Championship', () => {
    const rand = rng(99)
    for (let n = 0; n < 500; n += 1) {
      const size = 1 + Math.floor(rand() * 10)
      const raw = Array.from({ length: size }, (_, i) => (i && rand() < 0.35 ? `d${i}:tie` : `d${i}`))
      const stored = rand() < 0.5 ? [`reverse:${1 + Math.floor(rand() * 12)}`, ...raw] : raw
      const p = parsePlacings(stored)
      const tree: ResultsTree = { g: { d: stored } }
      const shown = new Map(getDanceResults('g', 'd', [], tree).rows.map((r) => [r.dancerId, r]))
      p.entries.forEach((entry, i) => {
        expect(placeAt(i, p), JSON.stringify(stored)).toEqual(shown.get(entry.id)!.place)
        expect(isTied(i, p), JSON.stringify(stored)).toEqual(shown.get(entry.id)!.tied)
      })
    }
  })

  it('is null outside the list', () => {
    expect(placeAt(-1, P([e('a')]))).toBeNull()
    expect(placeAt(1, P([e('a')]))).toBeNull()
  })
})

describe('removeEntry', () => {
  it('passes a tie on when the first of it leaves', () => {
    // a, b, c all tied for 1st; a leaves → b and c tied for 1st.
    expect(serializePlacings(removeEntry(P([e('a'), e('b', true), e('c', true)]), 0))).toEqual(['b', 'c:tie'])
    // b and c tied for 2nd; b leaves → c is 2nd on their own (not tied with a).
    expect(serializePlacings(removeEntry(P([e('a'), e('b'), e('c', true), e('d')]), 1))).toEqual(['a', 'c', 'd'])
  })
  it('keeps a tie together when a middle dancer of it leaves', () => {
    expect(serializePlacings(removeEntry(P([e('a'), e('b', true), e('c', true)]), 1))).toEqual(['a', 'c:tie'])
  })
  it('keeps Championship mode when the last dancer leaves', () => {
    expect(serializePlacings(removeEntry(P([e('a')], 6), 0))).toEqual(['reverse:6'])
    expect(serializePlacings(removeEntry(P([e('a')]), 0))).toBeNull()
  })
  it('doesn’t touch the original', () => {
    const p = P([e('a'), e('b', true)])
    removeEntry(p, 0)
    expect(p.entries).toEqual([e('a'), e('b', true)])
  })
})

describe('danceState', () => {
  it.each([
    [['a'], 'done'],
    [['reverse:6', 'a'], 'done'],
    [['reverse:6'], 'todo'],
    [[], 'todo'],
    [undefined, 'todo'],
    [null, 'todo'],
    [false, 'none'],
  ] as const)('%j → %s', (raw, state) => expect(danceState(raw as never)).toBe(state))
})

describe('placeholders', () => {
  it('are timestamps, never push ids', () => {
    expect(isPlaceholderId(newPlaceholderId())).toBe(true)
    expect(isPlaceholderId('1546578400210')).toBe(true)
    expect(isPlaceholderId('-LhvSPjvKW8LgeThAXTn')).toBe(false)
    expect(isPlaceholderId('comp-x-dancer-1-2')).toBe(false)
  })
})
