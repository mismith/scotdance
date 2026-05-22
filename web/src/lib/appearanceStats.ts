import { isBeforeToday, parseDate } from '@/lib/format'
import type { Competition } from '@/types/competition'

interface RawAppearance {
  competitionId?: string
}

interface AppearanceLike {
  raw: RawAppearance
  competition: { date?: number; venue?: string } | null
}

export interface EntityAppearance<Raw extends RawAppearance> {
  key: string
  raw: Raw
  competition: Competition | null
}

/** Build the sorted EntityAppearance[] view over an aggregate's raw appearances map. */
export function buildAppearances<Raw extends RawAppearance>(
  appearancesMap: Record<string, Raw> | undefined,
  compMeta: Record<string, Competition | null>,
): EntityAppearance<Raw>[] {
  if (!appearancesMap) return []
  return Object.entries(appearancesMap)
    .map<EntityAppearance<Raw>>(([key, raw]) => ({
      key,
      raw,
      competition: raw.competitionId ? compMeta[raw.competitionId] ?? null : null,
    }))
    .sort((a, b) => {
      const da = a.competition?.date ? parseDate(a.competition.date).getTime() : 0
      const db = b.competition?.date ? parseDate(b.competition.date).getTime() : 0
      return db - da
    })
}

/** Filter to dated appearances at or after today, sorted ascending. */
export function filterUpcoming<A extends AppearanceLike>(list: A[]): A[] {
  return list
    .filter((a) => a.competition?.date && !isBeforeToday(a.competition.date))
    .sort((a, b) => {
      const da = a.competition?.date ? parseDate(a.competition.date).getTime() : 0
      const db = b.competition?.date ? parseDate(b.competition.date).getTime() : 0
      return da - db
    })
}

/** Filter to dated appearances before today. Preserves caller's sort. */
export function filterPast<A extends AppearanceLike>(list: A[]): A[] {
  return list.filter(
    (a) => a.competition?.date && isBeforeToday(a.competition.date),
  )
}

/** First non-null/non-empty value across a list — useful for "latest known X" identity fields. */
export function latestNonNull<A, T>(
  list: A[],
  pick: (a: A) => T | null | undefined,
): T | null {
  for (const a of list) {
    const v = pick(a)
    if (v != null && v !== '') return v as T
  }
  return null
}

export function countTotalComps(list: AppearanceLike[]): number {
  const ids = new Set<string>()
  for (const a of list) {
    if (a.raw.competitionId) ids.add(a.raw.competitionId)
  }
  return ids.size
}

export function countCompsThisYear(list: AppearanceLike[]): number {
  const year = new Date().getFullYear()
  const ids = new Set<string>()
  for (const a of list) {
    const d = a.competition?.date
    if (!d) continue
    if (parseDate(d).getFullYear() === year && a.raw.competitionId) {
      ids.add(a.raw.competitionId)
    }
  }
  return ids.size
}

export function findFirstSeen<A extends AppearanceLike>(list: A[]): A | null {
  let best: A | null = null
  let bestT = Infinity
  for (const a of list) {
    const d = a.competition?.date
    if (!d) continue
    const t = parseDate(d).getTime()
    if (t < bestT) {
      bestT = t
      best = a
    }
  }
  return best
}

export function findLastSeen<A extends AppearanceLike>(list: A[]): A | null {
  let best: A | null = null
  let bestT = -Infinity
  for (const a of list) {
    const d = a.competition?.date
    if (!d) continue
    if (!isBeforeToday(d)) continue
    const t = parseDate(d).getTime()
    if (t > bestT) {
      bestT = t
      best = a
    }
  }
  return best
}

export function appearanceDate(a: AppearanceLike | null): Date | null {
  const d = a?.competition?.date
  return d ? parseDate(d) : null
}

export function countUniqueVenues(list: AppearanceLike[]): number {
  const venues = new Set<string>()
  for (const a of list) {
    const v = a.competition?.venue?.trim()
    if (v) venues.add(v.toLowerCase())
  }
  return venues.size
}

