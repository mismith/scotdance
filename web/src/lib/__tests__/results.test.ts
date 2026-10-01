import { describe, expect, it } from 'vitest'
import {
  findPointedDancers,
  getCallbackResults,
  getDanceResults,
  getDancerPlace,
  getOrdinalSuffix,
  danceHasPlaceholder,
  groupHasPlaceholderDancers,
  hasGroupAnyResults,
  isDancerPointed,
  isGroupInProgress,
  isPosted,
} from '@/lib/results'
import type { EnrichedDance, EnrichedDancer, EnrichedGroup, PointsTree, ResultsTree } from '@/types/competition'

// The public pages read results exactly as the old (v3) app stored them:
//   results[groupId][danceId] = ["reverse:N"?, "id", "id:tie", …] | false
//   points[groupId][danceId][judgeId] = ["id", …]
// v3 is the reference: its place maths (root src/helpers/results.js) is
// ported below and every well-formed shape must read the same.

const v3 = {
  parse(raw: unknown[]) {
    let reverseFrom: number | null = null
    let ids = raw
    if (raw.length && typeof raw[0] === 'string' && raw[0].startsWith('reverse:')) {
      reverseFrom = Number.parseInt(raw[0].slice('reverse:'.length), 10)
      ids = raw.slice(1)
    }
    const dancers = ids.map((x) => {
      const [id, modifier] = `${x}`.split(':')
      return { id, tie: modifier === 'tie' }
    })
    return { reverseFrom: reverseFrom || null, dancers }
  },
  place(index: number, dancers: Array<{ tie: boolean }>) {
    return dancers.reduce((place, d, i) => (i > index || d.tie ? place : i + 1), 0)
  },
  reversePlace(index: number, dancers: Array<{ tie: boolean }>, total: number) {
    const rest = dancers.slice(index + 1)
    const next = rest.findIndex((d) => !d.tie)
    const end = next < 0 ? dancers.length - 1 : index + next
    const place = total - end
    return place > 0 ? place : undefined
  },
  /** What v3 showed beside a placed dancer (undefined: nothing). */
  shown(raw: unknown[], index: number) {
    const { reverseFrom, dancers } = v3.parse(raw)
    const p = reverseFrom ? v3.reversePlace(index, dancers, reverseFrom) : v3.place(index, dancers)
    return p || null
  },
}

const G = 'grp'
const D = 'dance'
const dancer = (id: string, number?: number, groupId = G): EnrichedDancer => ({
  id,
  number,
  groupId,
  fullName: `Dancer ${id}`,
  group: { id: groupId, fullName: 'Group' },
})
const tree = (value: unknown): ResultsTree => ({ [G]: { [D]: value as string[] | false } })
const rows = (value: unknown, dancers: EnrichedDancer[] = []) => getDanceResults(G, D, dancers, tree(value)).rows
const places = (value: unknown) => rows(value).map((r) => [r.dancerId, r.place, r.tied])

// Small seeded PRNG so failures reproduce.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32
    return seed / 2 ** 32
  }
}

describe('getDanceResults: forward placings', () => {
  it('numbers dancers in the order entered', () => {
    expect(places(['a', 'b', 'c'])).toEqual([
      ['a', 1, false],
      ['b', 2, false],
      ['c', 3, false],
    ])
  })

  it('gives tied dancers the same place and skips the next', () => {
    expect(places(['a', 'b:tie', 'c'])).toEqual([
      ['a', 1, true],
      ['b', 1, true],
      ['c', 3, false],
    ])
    expect(places(['a', 'b', 'c:tie', 'd:tie', 'e'])).toEqual([
      ['a', 1, false],
      ['b', 2, true],
      ['c', 2, true],
      ['d', 2, true],
      ['e', 5, false],
    ])
    expect(places(['a', 'b', 'c:tie'])).toEqual([
      ['a', 1, false],
      ['b', 2, true],
      ['c', 2, true],
    ])
  })

  it('reads a legacy tie on the first dancer as untied (nobody to tie with)', () => {
    // Seen in real data, e.g. ["-LFz…:tie", "-LFz…:tie", …]
    expect(places(['a:tie', 'b', 'c'])).toEqual([
      ['a', 1, false],
      ['b', 2, false],
      ['c', 3, false],
    ])
    expect(places(['a:tie', 'b:tie', 'c:tie'])).toEqual([
      ['a', 1, true],
      ['b', 1, true],
      ['c', 1, true],
    ])
    expect(places(['1546578400210:tie'])).toEqual([['1546578400210', 1, false]])
  })

  it('looks dancers up, keeping placings whose dancer was deleted', () => {
    const list = rows(['a', 'gone', '1546578400210'], [dancer('a', 101)])
    expect(list.map((r) => [r.dancerId, r.dancer?.id ?? null, r.place])).toEqual([
      ['a', 'a', 1],
      ['gone', null, 2],
      ['1546578400210', null, 3],
    ])
  })
})

describe('getDanceResults: championship (reverse) placings', () => {
  it('reads entries from Nth up and shows 1st first', () => {
    expect(places(['reverse:4', 'd', 'c', 'b', 'a'])).toEqual([
      ['a', 1, false],
      ['b', 2, false],
      ['c', 3, false],
      ['d', 4, false],
    ])
  })

  it('handles ties in reverse order', () => {
    // b and c share 2nd (entered 4th, then 2nd, 2nd, then 1st).
    expect(places(['reverse:4', 'd', 'c', 'b:tie', 'a'])).toEqual([
      ['a', 1, false],
      ['b', 2, true],
      ['c', 2, true],
      ['d', 4, false],
    ])
    // Tied for 1st.
    expect(places(['reverse:3', 'c', 'b', 'a:tie'])).toEqual([
      ['a', 1, true],
      ['b', 1, true],
      ['c', 3, false],
    ])
  })

  it('places only the top ones when entry stops part way', () => {
    expect(places(['reverse:6', 'f', 'e', 'd'])).toEqual([
      ['d', 4, false],
      ['e', 5, false],
      ['f', 6, false],
    ])
  })

  it('gives no place to dancers entered after 1st, and lists them last', () => {
    expect(places(['reverse:2', 'b', 'a', 'x', 'y'])).toEqual([
      ['a', 1, false],
      ['b', 2, false],
      ['y', null, false],
      ['x', null, false],
    ])
  })

  it('treats a championship start with nobody placed as no results', () => {
    const r = getDanceResults(G, D, [], tree(['reverse:6']))
    expect(r).toMatchObject({ rows: [], reverseFrom: 6, hasResults: false, explicitlyEmpty: false })
  })

  it('reads "reverse:0" or garbage as normal order (as v3 did)', () => {
    expect(places(['reverse:0', 'a', 'b'])).toEqual([
      ['a', 1, false],
      ['b', 2, false],
    ])
    expect(places(['reverse:x', 'a', 'b'])).toEqual([
      ['a', 1, false],
      ['b', 2, false],
    ])
  })
})

describe('getDanceResults: empty and malformed', () => {
  it('distinguishes "none placed" (false) from not entered', () => {
    expect(getDanceResults(G, D, [], tree(false))).toMatchObject({ explicitlyEmpty: true, hasResults: false, rows: [] })
    for (const v of [undefined, null, [], {}, 'x']) {
      expect(getDanceResults(G, D, [], tree(v))).toMatchObject({ explicitlyEmpty: false, hasResults: false, rows: [] })
    }
  })

  it('skips gaps and stray markers instead of crashing', () => {
    expect(places(['a', null, '', 7, 'b:tie', 'reverse:3'])).toEqual([
      ['a', 1, true],
      ['b', 1, true],
    ])
  })

  it('copes with a missing group or dance', () => {
    expect(getDanceResults('nope', D, [], tree(['a'])).rows).toEqual([])
    expect(getDanceResults(G, 'nope', [], tree(['a'])).rows).toEqual([])
    expect(getDanceResults(G, D, [], undefined as unknown as ResultsTree).rows).toEqual([])
  })
})

describe('getDancerPlace', () => {
  it('agrees with getDanceResults for every dancer', () => {
    const shapes: unknown[] = [
      ['a', 'b', 'c'],
      ['a', 'b:tie', 'c', 'd:tie', 'e:tie'],
      ['a:tie', 'b', 'c:tie'],
      ['reverse:5', 'e', 'd:tie', 'c', 'b', 'a:tie'],
      ['reverse:2', 'c', 'b', 'a'],
      ['reverse:6'],
      false,
    ]
    for (const shape of shapes) {
      for (const r of rows(shape)) {
        const one = getDancerPlace(r.dancerId, G, D, tree(shape), {})
        expect([one.place, one.tied], JSON.stringify([shape, r.dancerId])).toEqual([r.place, r.tied])
      }
    }
  })

  it('says not placed for a dancer who isn’t in the list', () => {
    expect(getDancerPlace('z', G, D, tree(['a', 'b']), {})).toEqual({ place: null, tied: false, pointed: false })
    expect(getDancerPlace('a', undefined, D, tree(['a']), {})).toEqual({ place: null, tied: false, pointed: false })
  })

  it('reports a championship point', () => {
    const points: PointsTree = { [G]: { [D]: { combined: ['z'] } } }
    expect(getDancerPlace('z', G, D, tree(['a']), points)).toEqual({ place: null, tied: false, pointed: true })
  })
})

describe('v3 parity: places', () => {
  it('matches v3 for random well-formed placings, forward and reverse', () => {
    const rand = rng(42)
    for (let n = 0; n < 2000; n += 1) {
      const size = 1 + Math.floor(rand() * 12)
      const ids = Array.from({ length: size }, (_, i) => `-D${i}`)
      // v3 never stored a tie on the first entry from its own screens.
      const stored = ids.map((id, i) => (i > 0 && rand() < 0.3 ? `${id}:tie` : id))
      const reverse = rand() < 0.5 ? Math.floor(rand() * (size + 3)) : 0
      const raw = reverse ? [`reverse:${reverse}`, ...stored] : stored
      for (const [i, id] of ids.entries()) {
        const v4 = getDancerPlace(id, G, D, tree(raw), {}).place
        expect(v4, JSON.stringify(raw)).toEqual(v3.shown(raw, i))
      }
    }
  })
})

describe('isPosted', () => {
  it('counts placings and "none placed", not a championship start alone', () => {
    expect(isPosted(['a'])).toBe(true)
    expect(isPosted(['reverse:6', 'a'])).toBe(true)
    expect(isPosted(false)).toBe(true)
    expect(isPosted(['reverse:6'])).toBe(false)
    expect(isPosted([])).toBe(false)
    expect(isPosted(null)).toBe(false)
    expect(isPosted(undefined)).toBe(false)
  })
})

describe('getCallbackResults', () => {
  const ds = [dancer('a', 103), dancer('b', 101), dancer('c', 102), dancer('n')]
  it('lists dancers called back by number, unknowns last', () => {
    const r = getCallbackResults(G, ds, { [G]: { callbacks: ['a', 'gone', 'b', 'n', 'c'] } })
    expect(r.dancers.map((x) => x.dancerId)).toEqual(['b', 'c', 'a', 'gone', 'n'])
    expect(r.hasResults).toBe(true)
  })
  it('knows "no callbacks" from not entered', () => {
    expect(getCallbackResults(G, ds, { [G]: { callbacks: false } })).toMatchObject({ explicitlyEmpty: true, hasResults: false })
    expect(getCallbackResults(G, ds, {})).toMatchObject({ explicitlyEmpty: false, hasResults: false })
  })
  it('ignores gaps', () => {
    const r = getCallbackResults(G, ds, { [G]: { callbacks: ['a', null, ''] as unknown as string[] } })
    expect(r.dancers.map((x) => x.dancerId)).toEqual(['a'])
  })
})

describe('points', () => {
  const ds = [dancer('a', 3), dancer('b', 1), dancer('c', 2)]
  it('merges judges, drops duplicates and unknown dancers, sorts by number', () => {
    const points = { [G]: { [D]: { combined: ['a', 'b', '1546578400210'], j2: ['a', 'c'] } } } as PointsTree
    expect(findPointedDancers(points, G, D, ds).map((d) => d.id)).toEqual(['b', 'c', 'a'])
    expect(isDancerPointed(points, G, D, 'c')).toBe(true)
    expect(isDancerPointed(points, G, D, 'z')).toBe(false)
  })
  it('tolerates missing or odd shapes', () => {
    expect(findPointedDancers({}, G, D, ds)).toEqual([])
    const odd = { [G]: { [D]: { combined: 'a' } } } as unknown as PointsTree
    expect(findPointedDancers(odd, G, D, ds)).toEqual([])
  })
})

describe('placeholders and group status', () => {
  const group: EnrichedGroup = { id: G, fullName: 'Novice 9 & 10', category: { id: 'c', name: 'Novice' } }
  const dances: EnrichedDance[] = [{ id: D, fullName: 'Fling', groupIds: { [G]: true } }]

  it('spots "?" stand-ins in placings and points, even under odd dance ids', () => {
    expect(groupHasPlaceholderDancers(group, { [G]: { ' 10 Years': ['a', '1546578400210:tie'] } }, {})).toBe(true)
    expect(groupHasPlaceholderDancers(group, { [G]: { [D]: ['reverse:6', 'a'] } }, {})).toBe(false)
    expect(groupHasPlaceholderDancers(group, {}, { [G]: { [D]: { combined: ['1546578400210'] } } })).toBe(true)
  })

  it('spots a "?" in one dance, placings and points alike', () => {
    const results = { [G]: { [D]: ['a', '1546578400210'], d2: ['reverse:3', 'b'], d3: ['1546578400211:tie'] }, g2: { [D]: false } } as unknown as ResultsTree
    const points = { [G]: { d4: { combined: ['1546578400213'] } }, g2: { [D]: { combined: ['c'] } } }
    expect(['d', 'd2', 'd3', 'd4'].map((id) => danceHasPlaceholder(results, points, G, id === 'd' ? D : id))).toEqual([true, false, true, true])
    expect(danceHasPlaceholder(results, points, 'g2', D)).toBe(false)
    expect(danceHasPlaceholder({}, {}, G, D)).toBe(false)
  })

  it('doesn’t count a championship start alone as results', () => {
    expect(hasGroupAnyResults(group, dances, { [G]: { [D]: ['reverse:6'] } })).toBe(false)
    expect(hasGroupAnyResults(group, dances, { [G]: { [D]: ['a'] } })).toBe(true)
    expect(isGroupInProgress(group, dances, { [G]: { [D]: ['a'], callbacks: ['a'], overall: ['reverse:3'] } })).toBe(true)
    expect(isGroupInProgress(group, dances, { [G]: { [D]: ['a'], callbacks: ['a'], overall: false } })).toBe(false)
  })
})

describe('getOrdinalSuffix', () => {
  it.each([
    [1, 'st'],
    [2, 'nd'],
    [3, 'rd'],
    [4, 'th'],
    [10, 'th'],
    [11, 'th'],
    [12, 'th'],
    [13, 'th'],
    [21, 'st'],
    [22, 'nd'],
    [23, 'rd'],
    [101, 'st'],
    [111, 'th'],
    [112, 'th'],
  ])('%i → %s', (n, s) => expect(getOrdinalSuffix(n)).toBe(s))
})
