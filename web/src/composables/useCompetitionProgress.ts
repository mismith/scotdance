import { computed } from 'vue'
import { useCompetition } from '@/composables/useCompetition'
import { scheduleProgress } from '@/lib/scheduleProgress'
import { isDanced } from '@/lib/trophyEvents'
import { today } from '@/lib/now'

// The competition's schedule with its results so far (lib/scheduleProgress),
// and which days are today and tomorrow.
export function useCompetitionProgress() {
  const { schedule, results, groups, trophyEvents, competition } = useCompetition()
  return computed(() => {
    void today.value
    return scheduleProgress({
      schedule: schedule.value,
      results: results.value,
      groupIds: new Set(groups.value.map((g) => g.id)),
      trophyEventIds: new Set(trophyEvents.value.filter(isDanced).map((a) => a.id)),
      date: competition.value?.date,
    })
  })
}
