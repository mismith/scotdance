import { onMounted, onUpdated, reactive } from 'vue'
import { CALLBACKS_ID, getDanceResults } from '@/lib/results'
import type { ResultsTree } from '@/types/competition'

// Placings land with a beat: one that arrives while the competition is open
// in the app (live, on the day) flips in the first time it's on screen, on
// whichever page shows it. What's there when the results first load is a
// baseline, never news.

const fresh = reactive(new Set<string>())
const key = (groupId: string, danceId: string, dancerId: string) => `${groupId}:${danceId}:${dancerId}`

/**
 * Note the placings that changed between two reads of a competition's
 * results (none on the first read). Says whether anything changed at all.
 */
export function notePlacings(before: ResultsTree | null, after: ResultsTree): boolean {
  if (!before) return false
  let changed = false
  for (const groupId of new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])) {
    const was = before?.[groupId] ?? {}
    const now = after?.[groupId] ?? {}
    for (const danceId of new Set([...Object.keys(was), ...Object.keys(now)])) {
      if (JSON.stringify(was[danceId] ?? null) === JSON.stringify(now[danceId] ?? null)) continue
      changed = true
      if (danceId === CALLBACKS_ID) continue
      const old = new Map(getDanceResults(groupId, danceId, [], before).rows.map((r) => [r.dancerId, `${r.place}:${r.tied}`]))
      for (const r of getDanceResults(groupId, danceId, [], after).rows) {
        if (r.place != null && old.get(r.dancerId) !== `${r.place}:${r.tied}`) fresh.add(key(groupId, danceId, r.dancerId))
      }
    }
  }
  return changed
}

/**
 * For a page that shows placings: `isFresh(group, dance, dancer)` while a
 * placing is new to you. Once it has been on screen for its flip, it isn't.
 */
export function useFreshPlacings() {
  const shown = new Set<string>()
  function settle() {
    if (!shown.size) return
    const keys = [...shown]
    shown.clear()
    setTimeout(() => keys.forEach((k) => fresh.delete(k)), 1000)
  }
  onMounted(settle)
  onUpdated(settle)
  return function isFresh(groupId: string | null | undefined, danceId: string, dancerId: string): boolean {
    if (!groupId) return false
    const k = key(groupId, danceId, dancerId)
    if (!fresh.has(k)) return false
    shown.add(k)
    return true
  }
}
