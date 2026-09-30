import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'

// In-app result alerts: while ScotDance is open on competition day, a banner
// drops in the moment a followed dancer's placing is posted (useLiveAlerts).
// No push, no permissions, nothing leaves the device; push notifications come
// in a follow-up. On by default; switch off in More.

const enabledHere = useLocalStorage('alerts:inApp', true)

export function useAlerts() {
  return {
    enabled: computed({
      get: () => enabledHere.value,
      set: (v: boolean) => (enabledHere.value = v),
    }),
  }
}
