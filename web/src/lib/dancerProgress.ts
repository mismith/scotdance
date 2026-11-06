// A dancer's progress over time, from the competitions they've entered:
// which level they danced at, when, and the quiet years in between. Levels
// live in the category's name, typed freely by organisers, so they're read
// on the way to the screen and never written back. Nothing here says "first ever": a dancer's history
// usually starts before ScotDance.app tracked it.

export type Level = 'Primary' | 'Beginner' | 'Novice' | 'Intermediate' | 'Premier'

const LEVELS: Level[] = ['Primary', 'Beginner', 'Novice', 'Intermediate', 'Premier']

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

/** The latest clear level and when its current stretch began. */
export function currentLevel(
  points: CompetitionPoint[],
): { level: Level; since: number } | null {
  // The newest stretch, so "Premier since 2023" matches the timeline: a gap
  // starts a new stretch even at the same level.
  const s = levelStretches(points).find((x) => x.kind === 'level')
  return s?.kind === 'level' ? { level: s.level, since: s.from } : null
}
