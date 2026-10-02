import { ref } from 'vue'

// The competition you tap travels into its page (M2): the row's date tile and
// name glide into the Overview's header, and back again on the way out. Only
// the tapped row carries the names, so they're never on two elements at once;
// the Overview's header always carries them (CompetitionLayout hands the
// title to the bar once it scrolls away).
const tapped = ref<string | null>(null)

export const COMPETITION_DATE_VT = 'competition-date'
export const COMPETITION_TITLE_VT = 'competition-title'

export function useCompetitionVt() {
  return {
    /** On the row's click, before the page changes. */
    tap: (id: string) => (tapped.value = id),
    /** For the tapped row's date tile and name. */
    row: (id: string | undefined, name: string) => (id && tapped.value === id ? name : undefined),
  }
}
