import { ref } from 'vue'

// The number card is the competition's signature: tap a dancer anywhere in
// its lists (Dancers, a dancing order, results, the Overview's search) and
// their small card grows into the big one on their page, and shrinks back
// on the way back. Only the tapped row's card carries the name, so it's
// never on two elements at once; `row` tells apart the same dancer listed
// twice on a page (callbacks and placings).
const NAME = 'comp-dancer-number'
const tapped = ref<{ id: string; row: string } | null>(null)

export function useDancerNumberVt() {
  return {
    /** On the row's click, before the page changes. */
    tap: (id: string, row: string) => (tapped.value = { id, row }),
    /** For the small card in a list row. */
    row: (id: string, row: string) => (tapped.value?.id === id && tapped.value.row === row ? NAME : undefined),
    /** For the dancer page's big card. */
    page: (id: string) => (tapped.value?.id === id ? NAME : undefined),
  }
}
