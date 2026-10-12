import { ref } from 'vue'
import type { Router } from 'vue-router'

// Back on a competition's tabs leaves the competition in one tap, however
// many pages you opened inside it. On entering, remember the history
// position of the first competition page and where you came from; Back on a
// tab then jumps to the page before it.

interface Entry {
  competitionId: string
  /** vue-router's history.state.position of the first page in the competition. */
  position: number
  /** The page before it, or null for a deep link. */
  back: string | null
  /** Swapped in for a linked one by the switcher, in the same history entry. */
  switched?: boolean
}

const KEY = 'competition-entry'
const read = (): Entry | null => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}
export const competitionEntry = ref<Entry | null>(read())

const state = () => (window.history.state ?? {}) as { position?: number; back?: string | null }
export const historyPosition = () => state().position ?? 0

let switching = false
/**
 * The next navigation swaps this competition for one linked with it (the
 * switcher): it keeps this one's way out, so Back still leaves the set.
 */
export const keepCompetitionEntry = () => {
  switching = true
}

export function trackCompetitionEntry(router: Router) {
  router.afterEach((to, from, failure) => {
    const kept = switching ? competitionEntry.value : null
    switching = false
    if (failure) return
    const id = to.params.competitionId ? String(to.params.competitionId) : null
    if (!id || from.params.competitionId === to.params.competitionId) return
    competitionEntry.value = kept ? { ...kept, competitionId: id, switched: true } : { competitionId: id, position: historyPosition(), back: state().back ?? null }
    try {
      sessionStorage.setItem(KEY, JSON.stringify(competitionEntry.value))
    } catch {
      /* private mode: Back still works, just step by step */
    }
  })
}
