import { describe, expect, it } from 'vitest'
import { danceWheel } from '@/lib/danceWheel'
import { kindOf } from '@/lib/danceKinds'
import type { CompetitionPoint, Level } from '@/lib/dancerProgress'

let n = 0
const pt = (date: string, level: Level | null, dances: Array<[string, number | null]>): CompetitionPoint => ({
  competitionId: `c${(n += 1)}`,
  competitionName: `Games ${n}`,
  date: new Date(`${date}T12:00:00`).getTime(),
  level,
  dances: dances.map(([name, place]) => ({ name, place })),
})

describe('kindOf', () => {
  it('knows the four kinds by their grouped names', () => {
    expect(kindOf('Highland Fling')).toBe('highland')
    expect(kindOf('Flora MacDonald’s Fancy')).toBe('national')
    expect(kindOf('Sailors Hornpipe')).toBe('character')
    expect(kindOf('Choreography')).toBe('choreography')
    expect(kindOf('Solo Choreography')).toBe('choreography')
    expect(kindOf('Hullachan')).toBeNull()
  })
})

describe('danceWheel', () => {
  it('scores each dance by its share of the ribbons, most danced first, and skips dances done under three times', () => {
    const w = danceWheel([
      pt('2024-01-01', null, [['Highland Fling', 1], ['Sword Dance', null], ['Irish Jig', 6]]),
      pt('2024-02-01', null, [['Highland Fling', 4], ['Sword Dance', 2], ['Irish Jig', 7]]),
      pt('2024-03-01', null, [['Highland Fling', null], ['Sword Dance', 3]]),
      pt('2024-04-01', null, [['Highland Fling', 2]]),
    ])
    expect(w.since).toBeNull()
    expect(w.kinds.map((k) => k.kind)).toEqual(['highland'])
    const [fling, sword] = w.kinds[0].dances
    expect(fling).toEqual({ name: 'Highland Fling', times: 4, placed: 3, score: (1 + 0.5 + 0 + 5 / 6) / 4 })
    expect(sword).toMatchObject({ name: 'Sword Dance', times: 3, placed: 2 })
    expect(w.kinds[0].times).toBe(7)
  })

  it('counts from the current level when there is enough there, and from everything when not', () => {
    const early = Array.from({ length: 5 }, (_, i) => pt(`2019-0${i + 1}-01`, 'Novice', [['Highland Fling', 1]]))
    const later = Array.from({ length: 7 }, (_, i) => pt(`2023-0${i + 1}-01`, 'Premier', [['Highland Fling', null], ['Sword Dance', null], ['Irish Jig', null]]))
    const w = danceWheel([...early, ...later])
    expect(w.since).toEqual({ level: 'Premier', date: later[0].date })
    expect(w.kinds[0].dances[0]).toMatchObject({ name: 'Highland Fling', times: 7, score: 0 })
    expect(danceWheel([...early, ...later.slice(0, 2)]).since).toBeNull()
  })

  it('is empty with nothing', () => {
    expect(danceWheel([])).toEqual({ kinds: [], since: null })
  })
})
