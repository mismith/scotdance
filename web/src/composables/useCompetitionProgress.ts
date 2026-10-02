import { computed, ref } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import { useCompetition } from '@/composables/useCompetition'
import { scheduleProgress } from '@/lib/scheduleProgress'
import { now, today } from '@/lib/now'

// The competition's schedule, aware of the time: what's done and what's on
// now (lib/scheduleProgress), kept current minute by minute.
export function useCompetitionProgress() {
  const { schedule, results, groups, competition } = useCompetition()
  const minute = ref(0)
  useIntervalFn(() => minute.value++, 60_000)
  return computed(() => {
    void minute.value
    void today.value
    const t = now()
    return scheduleProgress({
      schedule: schedule.value,
      results: results.value,
      groupIds: new Set(groups.value.map((g) => g.id)),
      date: competition.value?.date,
      minutes: t.getHours() * 60 + t.getMinutes(),
    })
  })
}
