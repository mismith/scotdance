import { findGroupDances, isPosted } from '@/lib/results'
import { OVERALL_ID, groupHasOverall, type EnrichedDance, type EnrichedGroup, type ResultsTree } from '@/types/competition'

/** Results posted out of expected: every age group's dances, and its Overall if it has one. */
export function resultsCount(groups: EnrichedGroup[], dances: EnrichedDance[], results: ResultsTree) {
  let total = 0
  let posted = 0
  for (const g of groups) {
    const ids = findGroupDances(g, dances).map((d) => d.id)
    if (groupHasOverall(g)) ids.push(OVERALL_ID)
    total += ids.length
    posted += ids.filter((id) => isPosted(results?.[g.id]?.[id])).length
  }
  return { posted, total }
}
