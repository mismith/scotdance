import { DANCE_KINDS, kindOf, type DanceKind } from '@/lib/danceKinds'
import { currentLevel, type CompetitionPoint, type Level } from '@/lib/dancerProgress'

// The dance wheel's numbers: how much of each kind of dance a dancer does,
// and how each dance goes against their own best. Never against anyone
// else's. Counted since they moved to their current level, when there's
// enough there to say anything, since placings drop on a step up.

export interface WheelDance {
  name: string
  times: number
  placed: number
  /** 0–1: the average share of the ribbons, 1st = 1, 6th = 1/6, not placed 0. */
  score: number
}
export interface WheelKind {
  kind: DanceKind
  times: number
  /** 0–1: the kind's average, as a dance's score. */
  score: number
  /** Most danced first. */
  dances: WheelDance[]
}
export interface Wheel {
  kinds: WheelKind[]
  /** Counted since this level began, or null for everything on ScotDance.app. */
  since: { level: Level; date: number } | null
}

/** Times a dance needs before it's on the wheel: fewer says nothing. */
export const MIN_TIMES = 3
/** Dances a level needs before the wheel counts from it alone. */
const MIN_AT_LEVEL = 20

const score = (place: number | null) => (place != null && place <= 6 ? (7 - place) / 6 : 0)

export function danceWheel(points: CompetitionPoint[]): Wheel {
  const level = currentLevel(points)
  const atLevel = level ? points.filter((p) => p.date >= level.since) : []
  const danced = (ps: CompetitionPoint[]) => ps.reduce((n, p) => n + (p.dances?.length ?? 0), 0)
  const useLevel = !!level && danced(atLevel) >= MIN_AT_LEVEL && atLevel.length < points.length
  const window = useLevel ? atLevel : points

  const byName = new Map<string, Array<number | null>>()
  for (const p of window) for (const d of p.dances ?? []) byName.set(d.name, [...(byName.get(d.name) ?? []), d.place])

  const kinds: WheelKind[] = []
  for (const kind of DANCE_KINDS) {
    const dances: WheelDance[] = []
    for (const [name, places] of byName) {
      if (kindOf(name) !== kind || places.length < MIN_TIMES) continue
      const total = places.reduce<number>((a, p) => a + score(p), 0)
      dances.push({ name, times: places.length, placed: places.filter((p) => p != null).length, score: total / places.length })
    }
    if (!dances.length) continue
    dances.sort((a, b) => b.times - a.times || a.name.localeCompare(b.name))
    const times = dances.reduce((n, d) => n + d.times, 0)
    kinds.push({ kind, times, score: dances.reduce((a, d) => a + d.score * d.times, 0) / times, dances })
  }
  return { kinds, since: useLevel ? { level: level!.level, date: level!.since } : null }
}
