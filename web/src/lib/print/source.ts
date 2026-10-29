import { toDancersBundle, toResultsBundle, toScheduleBundle, toStaff } from '@/lib/competitionData'
import type {
  Category,
  Competition,
  DrawsTree,
  EnrichedDance,
  EnrichedDancer,
  EnrichedGroup,
  Platform,
  PointsTree,
  ResultsTree,
  Schedule,
  StaffMember,
} from '@/types/competition'

// Everything Manage › Print lays out, read the way the public pages read it
// (numbers parsed, names joined, everything in the organiser's order), so
// paper says what families see in the app.

export interface PrintSource {
  competitionId: string
  competition: Competition | null
  staff: StaffMember[]
  categories: Category[]
  groups: EnrichedGroup[]
  dancers: EnrichedDancer[]
  dances: EnrichedDance[]
  results: ResultsTree
  points: PointsTree
  schedule: Schedule | null
  platforms: Platform[]
  draws: DrawsTree
}

/** The raw sections under competitions:data/{id}, as Manage holds them. */
export interface RawSections {
  categories?: unknown
  groups?: unknown
  dances?: unknown
  dancers?: unknown
  staff?: unknown
  platforms?: unknown
  schedule?: unknown
  results?: unknown
  points?: unknown
  draws?: unknown
}

/** A competitor number as the dancers' numbers read (parsed: "012" is 12). */
export const numberKey = (n: unknown) => {
  const s = String(n ?? '').trim()
  return /^\d+$/.test(s) ? String(Number(s)) : s
}

/**
 * Draws as plain lists of numbers. The old admin saved them cell by cell, so
 * one can have gaps, or come back as an object when sparse (see Draws.vue).
 */
function normaliseDraws(draws: DrawsTree): DrawsTree {
  return Object.fromEntries(
    Object.entries(draws ?? {})
      .filter(([, byDance]) => byDance && typeof byDance === 'object')
      .map(([groupId, byDance]) => [
        groupId,
        Object.fromEntries(
          Object.entries(byDance).map(([danceId, v]) => {
            const list: unknown[] = Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []
            return [danceId, list.filter((n) => n != null && n !== '').map(numberKey)]
          }),
        ),
      ]),
  )
}

export function printSource(competitionId: string, competition: Competition | null, raw: RawSections): PrintSource {
  const people = toDancersBundle(raw.dancers, raw.groups, raw.categories)
  const results = toResultsBundle(raw.dances, raw.results, raw.points)
  const schedule = toScheduleBundle(raw.schedule, raw.platforms, raw.draws)
  return {
    competitionId,
    competition,
    staff: toStaff(raw.staff),
    categories: people.categories,
    groups: people.groups,
    dancers: people.dancers,
    dances: results.dances,
    results: results.results,
    points: results.points,
    schedule: schedule.schedule,
    platforms: schedule.platforms,
    draws: normaliseDraws(schedule.draws),
  }
}
