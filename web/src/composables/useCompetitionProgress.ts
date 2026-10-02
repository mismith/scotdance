import { computed } from 'vue'
import { useCompetition } from '@/composables/useCompetition'
import { scheduleProgress } from '@/lib/scheduleProgress'
import { today } from '@/lib/now'

// The competition's schedule with its results so far (lib/scheduleProgress),
// and which days are today and tomorrow.
export function useCompetitionProgress() {
  const { schedule, results, groups, competition } = useCompetition()
  return computed(() => {
    void today.value
    return scheduleProgress({
      schedule: schedule.value,
      results: results.value,
      groupIds: new Set(groups.value.map((g) => g.id)),
      date: competition.value?.date,
    })
  })
}
