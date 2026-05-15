import { ref } from 'vue'

// Module-scope so the input element persists across home ↔ /search route
// changes. iOS Safari only opens the soft keyboard when focus originates in a
// live user gesture — if the input unmounts at the route boundary and the new
// page calls .focus() in onMounted, the gesture is gone and the call is
// silently dropped. Keeping the input mounted in GlobalBottomNav (rendered
// on both routes) lets a <label> tap focus it natively.
const q = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

export function useGlobalSearch() {
  return { q, inputEl }
}
