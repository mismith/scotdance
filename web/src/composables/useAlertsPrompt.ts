import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

// The "Know when results are in" sheet. Offered once, right after the first
// follow, never on launch. Answering either way (or closing it) counts as
// asked; people can still turn alerts on later from More or a dancer page.

const open = ref(false)
const forName = ref<string | null>(null)
const asked = useLocalStorage('alerts:asked', false)
const enabledHere = useLocalStorage('alerts:enabled', false)

export function useAlertsPrompt() {
  function offerAfterFollow(name: string) {
    if (asked.value || enabledHere.value) return
    forName.value = name
    // Let the "Following" state land before the sheet rises.
    setTimeout(() => (open.value = true), 600)
  }

  function show(name: string | null = null) {
    forName.value = name
    open.value = true
  }

  function close() {
    open.value = false
    asked.value = true
  }

  return { open, forName, asked, enabledHere, offerAfterFollow, show, close }
}
