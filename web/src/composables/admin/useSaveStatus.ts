import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { saveState } from '@/lib/admin/write'
import { connected } from '@/lib/offline'

export type SaveState = 'offline' | 'saving' | 'error' | 'saved'
const LABEL: Record<SaveState, string> = { offline: 'Offline', saving: 'Saving…', error: 'Not saved', saved: 'Saved' }

/**
 * "Are my changes safe?", in words: Saved for a moment after each save
 * (changes save themselves, so seeing it is how you know), Saving… when a
 * save is slow, Offline or Not saved when it can't. `shown` is when there's
 * something to say; otherwise it keeps out of the way.
 */
export function useSaveStatus() {
  // A save that's over in a blink doesn't flash Saving… (only one that's slow).
  const slow = ref(false)
  let slowTimer: ReturnType<typeof setTimeout> | undefined
  watch(
    () => saveState.pending > 0,
    (busy) => {
      clearTimeout(slowTimer)
      if (busy) slowTimer = setTimeout(() => (slow.value = true), 400)
      else slow.value = false
    },
    { immediate: true },
  )
  const justSaved = ref(false)
  let savedTimer: ReturnType<typeof setTimeout> | undefined
  watch(
    () => saveState.lastSavedAt,
    (at) => {
      if (!at) return
      justSaved.value = true
      clearTimeout(savedTimer)
      savedTimer = setTimeout(() => (justSaved.value = false), 2400)
    },
  )
  onBeforeUnmount(() => {
    clearTimeout(slowTimer)
    clearTimeout(savedTimer)
  })
  const state = computed<SaveState>(() => {
    if (!connected.value) return 'offline'
    if (saveState.pending > 0 && slow.value) return 'saving'
    if (saveState.error) return 'error'
    return 'saved'
  })
  return {
    state,
    label: computed(() => LABEL[state.value]),
    shown: computed(() => state.value !== 'saved' || justSaved.value),
    error: computed(() => saveState.error),
  }
}
