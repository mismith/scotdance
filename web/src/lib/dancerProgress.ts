// A dancer's progress over time, from the competitions they've entered:
// which level they danced at, when, the quiet years in between, and the
// moments worth marking. Levels live in the category's name, typed
// freely by organisers, so they're read on the way to the screen and
// never written back. Nothing here says "first ever": a dancer's history
// usually starts before ScotDance.app tracked it.

import { KIND_PHRASES, kindOf, type DanceKind } from '@/lib/danceKinds'
import { getOrdinalSuffix } from '@/lib/results'

export type Level = 'Primary' | 'Beginner' | 'Novice' | 'Intermediate' | 'Premier'

const LEVELS: Level[] = ['Primary', 'Beginner', 'Novice', 'Intermediate', 'Premier']
const rank = (l: Level) => LEVELS.indexOf(l)

/**
 * The level a category's name holds ("Premier", "Pre-Premier"), or null when
 * it holds none ("Championship") or two ("Beginner/Novice"). Ages and words
 * like "Special" don't matter.
 */
export function levelOf(categoryName: string | null | undefined): Level | null {
  if (!categoryName) return null
  // Pre-Premier is the step below Premier, which the list calls Intermediate.
  const name = categoryName.toLowerCase().replace(/\bpre[-\s]?premier\b/g, 'intermediate')
  const found = LEVELS.filter((l) => new RegExp(`\\b${l.toLowerCase()}\\b`).test(name))
  return found.length === 1 ? found[0] : null
}

export interface CompetitionPoint {
  competitionId: string
  /** Their entry there, for a link to it. */
  entryId?: string
  competitionName: string
  /** ms since epoch. */
  date: number
  level: Level | null
  country?: string | null
  /** The categories they danced in, as typed. */
  categories?: string[]
  /** Each dance with results posted, by its grouped name; null = not placed. */
  dances?: Array<{ name: string; place: number | null }>
  /** Their best overall place, when they had one. */
  overall?: number | null
}

export type LevelStretch =
  | { kind: 'level'; level: Level; from: number; to: number; competitions: number }
  /** Whole calendar years with no competitions at all. */
  | { kind: 'gap'; fromYear: number; toYear: number }

const byDate = (points: CompetitionPoint[]) => [...points].sort((a, b) => a.date - b.date)
const yearOf = (ms: number) => new Date(ms).getFullYear()

/**
 * The season a date falls in, by the year it starts: seasons run September
 * to August, so October 2025 and March 2026 are both the 2025–26 season.
 */
export const seasonOf = (ms: number) => {
  const d = new Date(ms)
  return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1
}
/** "2025–26" for the season starting in 2025. */
export const seasonLabel = (start: number) => `${start}–${String(start + 1).slice(-2)}`

/**
 * Runs of the same level, newest first, with the quiet years between them.
 * A competition with no clear level doesn't end a run, but a gap does.
 */
export function levelStretches(points: CompetitionPoint[]): LevelStretch[] {
  const out: LevelStretch[] = []
  let open: Extract<LevelStretch, { kind: 'level' }> | null = null
  let prev: CompetitionPoint | null = null
  for (const p of byDate(points)) {
    if (prev && yearOf(p.date) - yearOf(prev.date) > 1) {
      out.push({
        kind: 'gap',
        fromYear: yearOf(prev.date) + 1,
        toYear: yearOf(p.date) - 1,
      })
      open = null
    }
    prev = p
    if (!p.level) continue
    if (open && open.level === p.level) {
      open.to = p.date
      open.competitions += 1
    } else {
      open = { kind: 'level', level: p.level, from: p.date, to: p.date, competitions: 1 }
      out.push(open)
    }
  }
  return out.reverse()
}

export type Season =
  /** `year` is the year the season starts. */
  | {
      kind: 'year'
      year: number
      count: number
      placed: number
      level: Level | null
      levels: Array<Level | null>
    }
  /** Whole seasons with no competitions at all, by the years they start. */
  | { kind: 'gap'; fromYear: number; toYear: number }

/** They placed in a dance or overall. */
export const placedAt = (p: CompetitionPoint) =>
  !!p.overall || !!p.dances?.some((d) => d.place != null)

/**
 * The record a season (September to August) at a time, newest first: how
 * many competitions, each one's level (oldest first) and the latest clear
 * level, with quiet seasons run together as one gap. Ends at the latest
 * season with a competition.
 */
export function seasons(points: CompetitionPoint[]): Season[] {
  if (!points.length) return []
  const sorted = byDate(points)
  const first = seasonOf(sorted[0].date)
  const last = seasonOf(sorted[sorted.length - 1].date)
  const out: Season[] = []
  for (let year = last; year >= first; year--) {
    const inYear = sorted.filter((p) => seasonOf(p.date) === year)
    if (inYear.length) {
      const levels = inYear.map((p) => p.level)
      const placed = inYear.filter(placedAt).length
      out.push({
        kind: 'year',
        year,
        count: inYear.length,
        placed,
        level: levels.filter(Boolean).at(-1) ?? null,
        levels,
      })
      continue
    }
    const prev = out.at(-1)
    if (prev?.kind === 'gap') prev.fromYear = year
    else out.push({ kind: 'gap', fromYear: year, toYear: year })
  }
  return out
}

export type MomentKind =
  | 'first'
  | 'count'
  | 'level'
  | 'placing'
  | 'win'
  | 'trophy'
  | 'provincial'
  | 'canadian'
  | 'abroad'
  | 'championship'
  | 'streak'
  | 'best'
  | 'allRounder'
  | 'improved'

/**
 * How much fuss a moment gets. Peaks are rare (about one a season), quiet
 * ones are small stops, and the rest sit in between.
 */
export type MomentWeight = 'peak' | 'notable' | 'quiet'

export interface Moment {
  kind: MomentKind
  weight: MomentWeight
  date: number
  title: string
  detail: string
  /** The kind of dance it's about, for its colour. */
  danceKind?: DanceKind | null
  /** A competition count's number. */
  n?: number
  /** Where it happened, for a link; none for a season's trend. */
  competitionId?: string
  entryId?: string
}

const WEIGHT: Record<MomentKind, MomentWeight> = {
  first: 'peak',
  level: 'peak',
  trophy: 'peak',
  count: 'notable',
  best: 'quiet',
  placing: 'notable',
  win: 'notable',
  provincial: 'notable',
  canadian: 'notable',
  abroad: 'notable',
  championship: 'notable',
  streak: 'notable',
  allRounder: 'notable',
  improved: 'notable',
}

/** Competition counts worth a stop, then every 50th. */
export const COUNTS = [10, 25, 50, 75, 100]
const isCount = (n: number) => COUNTS.includes(n) || (n > 100 && n % 50 === 0)
/** The next count to reach, for "3 more to reach 150". */
export const nextCount = (n: number) =>
  COUNTS.find((c) => c > n) ?? (Math.floor(n / 50) + 1) * 50

const ord = (n: number) => `${n}${getOrdinalSuffix(n)}`
// A dance's placing as a share of the ribbons, 1st = 1, 6th = 1/6, not placed 0.
const score = (place: number | null) =>
  place != null && place <= 6 ? (7 - place) / 6 : 0
const PROVINCIAL = /provincial/i
const CANADIAN = /\bSDCCS\b|ScotDance Canada Championship|Canadian Championship/i
const CHAMPIONSHIP = /championship/i
const NOT_CHAMPIONSHIP = /pre[-\s]?champ|canadian/i

/**
 * The moments worth marking on a dancer's path, newest first: firsts at each
 * level, counts, and the trends a teacher might miss (a dance turned round,
 * a best ever, a kind of dance that improved). Nothing says "first ever":
 * "first" is the first ScotDance.app knows of. Nothing is about a drop.
 */
export function moments(points: CompetitionPoint[]): Moment[] {
  const sorted = byDate(points)
  const out: Moment[] = []
  const seen = new Set<string>()
  const add = (key: string, m: Omit<Moment, 'weight'>) => {
    if (seen.has(key)) return
    seen.add(key)
    out.push({ ...m, weight: WEIGHT[m.kind] })
  }
  const countries = new Map<string, number>()
  for (const p of sorted)
    if (p.country) countries.set(p.country, (countries.get(p.country) ?? 0) + 1)
  const home = [...countries.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

  // Per dance: placed or not, each time, and the best place so far.
  const history = new Map<string, boolean[]>()
  const best = new Map<string, number>()
  const bestYears = new Set<number>()
  // Per season and kind: each time's score, for "improved most".
  const byYear = new Map<number, Map<DanceKind, number[]>>()
  let top = -1

  sorted.forEach((p, i) => {
    const at = { date: p.date, competitionId: p.competitionId, entryId: p.entryId }
    const dances = p.dances ?? []
    const year = seasonOf(p.date)
    if (i === 0)
      add('first', {
        kind: 'first',
        ...at,
        title: 'First competition on ScotDance.app',
        detail: p.competitionName,
      })
    if (isCount(i + 1))
      add(`n${i + 1}`, {
        kind: 'count',
        ...at,
        n: i + 1,
        title: `${ord(i + 1)} competition`,
        detail: p.competitionName,
      })

    if (p.level) {
      // The first level seen is where records start, not a step up.
      if (top >= 0 && rank(p.level) > top)
        add(`level:${p.level}`, {
          kind: 'level',
          ...at,
          title: `Moved up to ${p.level}`,
          detail: p.competitionName,
        })
      top = Math.max(top, rank(p.level))
      const placed = dances
        .filter((d) => d.place != null)
        .sort((a, b) => a.place! - b.place!)
      const win = placed.find((d) => d.place === 1)
      // A first placing that's a 1st is told once, as the win.
      if (win) seen.add(`placing:${p.level}`)
      if (placed[0]) {
        const d = placed[0]
        add(`placing:${p.level}`, {
          kind: 'placing',
          ...at,
          title: `First placing at ${p.level}`,
          detail: `${ord(d.place!)}, ${d.name}`,
          danceKind: kindOf(d.name),
        })
      }
      if (win)
        add(`win:${p.level}`, {
          kind: 'win',
          ...at,
          title: `First win at ${p.level}`,
          detail: win.name,
          danceKind: kindOf(win.name),
        })
      if (p.overall === 1)
        add(`trophy:${p.level}`, {
          kind: 'trophy',
          ...at,
          title: `First trophy at ${p.level}`,
          detail: '1st overall',
        })
    }
    if (PROVINCIAL.test(p.competitionName))
      add('provincial', {
        kind: 'provincial',
        ...at,
        title: 'First provincial championship',
        detail: p.competitionName,
      })
    if (CANADIAN.test([p.competitionName, ...(p.categories ?? [])].join(' ')))
      add('canadian', {
        kind: 'canadian',
        ...at,
        title: 'First ScotDance Canada Championships',
        detail: p.competitionName,
      })
    if (home && p.country && p.country !== home)
      add('abroad', {
        kind: 'abroad',
        ...at,
        title: 'First competition abroad',
        detail: `${p.competitionName} · ${p.country}`,
      })
    if (p.categories?.some((c) => CHAMPIONSHIP.test(c) && !NOT_CHAMPIONSHIP.test(c)))
      add('championship', {
        kind: 'championship',
        ...at,
        title: 'First Championship',
        detail: p.competitionName,
      })

    const kinds = new Map<DanceKind, boolean>()
    for (const d of dances) {
      const k = kindOf(d.name)
      const h = history.get(d.name) ?? []
      // A dance that rarely placed, then placed three times running.
      const before = h.slice(0, -2)
      if (d.place != null && before.length >= 4 && h.slice(-2).every(Boolean)) {
        const hits = before.filter(Boolean).length
        if (hits / before.length < 0.3)
          add(`streak:${d.name}`, {
            kind: 'streak',
            ...at,
            title: `Placed in the ${d.name} 3 times running`,
            detail: `A dance that had placed ${hits} of ${before.length} times before`,
            danceKind: k,
          })
      }
      h.push(d.place != null)
      history.set(d.name, h)
      // A best ever top three in a dance, one a season.
      const was = best.get(d.name)
      if (
        d.place != null &&
        d.place <= 3 &&
        was != null &&
        d.place < was &&
        !bestYears.has(year)
      ) {
        bestYears.add(year)
        add(`best:${year}`, {
          kind: 'best',
          ...at,
          title: `Best ever ${d.name}`,
          detail: `${ord(d.place)}, up from ${ord(was)}`,
          danceKind: k,
        })
      }
      if (d.place != null) best.set(d.name, Math.min(was ?? Infinity, d.place))
      if (k) {
        kinds.set(k, (kinds.get(k) ?? false) || d.place != null)
        const y = byYear.get(year) ?? new Map<DanceKind, number[]>()
        y.set(k, [...(y.get(k) ?? []), score(d.place)])
        byYear.set(year, y)
      }
    }
    if (kinds.size >= 3 && [...kinds.values()].every(Boolean))
      add('allRounder', {
        kind: 'allRounder',
        ...at,
        title: `Placed in ${kinds.size} kinds of dance in one day`,
        detail: p.competitionName,
      })
  })

  // The kind of dance that improved most on the season before, when it clearly did.
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  for (const [year, kinds] of byYear) {
    const before = byYear.get(year - 1)
    if (!before) continue
    let bestKind: DanceKind | null = null
    let gain = 0.1
    for (const [k, xs] of kinds) {
      const was = before.get(k)
      if (xs.length < 4 || !was || was.length < 4) continue
      const g = mean(xs) - mean(was)
      if (g >= gain) [bestKind, gain] = [k, g]
    }
    if (!bestKind) continue
    const last = sorted.filter((p) => seasonOf(p.date) === year).at(-1)!
    add(`improved:${year}`, {
      kind: 'improved',
      date: last.date,
      title: `${KIND_PHRASES[bestKind]} improved most in ${seasonLabel(year)}`,
      detail: `Placed more often than in ${seasonLabel(year - 1)}`,
      danceKind: bestKind,
    })
  }

  // Newest first; on one day, in the order they happened.
  return out
    .map((m, i) => ({ m, i }))
    .sort((a, b) => b.m.date - a.m.date || b.i - a.i)
    .map(({ m }) => m)
}

/** The latest clear level and when its current stretch began. */
export function currentLevel(
  points: CompetitionPoint[],
): { level: Level; since: number } | null {
  // The newest stretch, so "Premier since 2023" matches the timeline: a gap
  // starts a new stretch even at the same level.
  const s = levelStretches(points).find((x) => x.kind === 'level')
  return s?.kind === 'level' ? { level: s.level, since: s.from } : null
}
