import { computed, ref } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import { useCompetition } from '@/composables/useCompetition'
import { nowMs } from '@/lib/now'

// How live the competition is right now, for its one live mark: minutes
// since a result last arrived while you were watching (null before one
// has), and whether that's recent enough for the dot to pulse.
export function useCompetitionLive() {
  const { isLive, liveResultsAt } = useCompetition()
  const tick = ref(nowMs())
  useIntervalFn(() => (tick.value = nowMs()), 60_000)
  const sinceResult = computed(() => {
    void tick.value
    if (!isLive.value || !liveResultsAt.value) return null
    return Math.max(0, Math.round((nowMs() - liveResultsAt.value) / 60_000))
  })
  return {
    sinceResult,
    pulse: computed(() => sinceResult.value != null && sinceResult.value < 20),
    lastResult: computed(() =>
      sinceResult.value == null ? null : `last result ${sinceResult.value < 1 ? 'just now' : `${sinceResult.value} min ago`}`,
    ),
  }
}
