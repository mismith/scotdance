import { ref } from 'vue'

// The competition you tap travels into its page (M2): the row's date tile
// glides into the Overview's header, and back again on the way out (its name
// just goes with the page). Only the tapped row carries the name, so it's
// never on two elements at once; the Overview's header carries it until it
// scrolls away.
const tapped = ref<string | null>(null)

export const COMPETITION_DATE_VT = 'competition-date'

export function useCompetitionVt() {
  return {
    /** On the row's click, before the page changes. */
    tap: (id: string) => (tapped.value = id),
    /** For the tapped row's date tile. */
    row: (id: string | undefined, name: string) => (id && tapped.value === id ? name : undefined),
  }
}
