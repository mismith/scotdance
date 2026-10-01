import { shallowRef, watch, type Ref } from 'vue'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import { fetchSchedule } from '@/lib/competitionData'
import { competitionPhase, competitionSpan } from '@/lib/dancerDay'
import { daysFromToday } from '@/lib/format'
import type { Schedule } from '@/types/competition'

/**
 * Where each competition sits from today, through its last schedule day, so
 * day 2 of a two-day competition is still today. Only one that started in
 * the last fortnight can still be on, so only those schedules are read (once
 * each, and only while `active`).
 */
export function useCompetitionSpans(competitions: Ref<CompetitionListItem[]>, active?: Ref<boolean>) {
  const schedules = shallowRef<Record<string, Schedule | null>>({})
  watch(
    [competitions, () => active?.value ?? true],
    ([list, on]) => {
      if (!on) return
      for (const c of list) {
        const first = daysFromToday(c.date)
        if (first == null || first >= 0 || first < -14 || c.id in schedules.value) continue
        schedules.value = { ...schedules.value, [c.id]: null }
        fetchSchedule(c.id)
          .then((b) => (schedules.value = { ...schedules.value, [c.id]: b.schedule }))
          .catch(() => {})
      }
    },
    { immediate: true },
  )
  return {
    span: (c: CompetitionListItem) => competitionSpan(c.date, schedules.value[c.id]),
    phase: (c: CompetitionListItem) => competitionPhase(c.date, schedules.value[c.id]),
  }
}
