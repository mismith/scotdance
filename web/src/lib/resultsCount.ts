import { aggregatePosted, isWinnable } from '@/lib/aggregates'
import { findGroupDances, isPosted } from '@/lib/results'
import { OVERALL_ID, groupHasOverall, type EnrichedDance, type EnrichedGroup, type ResultsTree } from '@/types/competition'

/**
 * Results posted out of expected: every age group's dances, its Overall if
 * it has one, and each aggregate's one list of placings (one nobody can win
 * yet, with no age groups on, isn't waited on).
 */
export function resultsCount(
  groups: EnrichedGroup[],
  dances: EnrichedDance[],
  results: ResultsTree,
  aggregates: Array<{ id: string; groupIds?: Record<string, boolean>; groups?: unknown[] }> = [],
) {
  let total = 0
  let posted = 0
  for (const g of groups) {
    const ids = findGroupDances(g, dances).map((d) => d.id)
    if (groupHasOverall(g)) ids.push(OVERALL_ID)
    total += ids.length
    posted += ids.filter((id) => isPosted(results?.[g.id]?.[id])).length
  }
  const winnable = aggregates.filter(isWinnable)
  total += winnable.length
  posted += winnable.filter((a) => aggregatePosted(results, a.id)).length
  return { posted, total }
}
