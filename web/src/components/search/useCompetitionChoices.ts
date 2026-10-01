import { computed, type Ref } from 'vue'
import type { CompetitionListItem } from '@/composables/useCompetitions'
import { useCompetitionSpans } from '@/composables/useCompetitionSpans'
import { useFollowedCompetitions } from '@/composables/useFollowedCompetitions'
import { useLocationFilter } from '@/composables/useLocationFilter'
import { useFavoritesStore } from '@/stores/favorites'
import { useMeStore } from '@/stores/me'
import { compareChoices, type CompetitionChoice } from './choices'

/** Number search looks in competitions this many days either side of today. */
export const WINDOW_DAYS = 30

/**
 * The competitions within a month of today, likeliest first (see
 * compareChoices). `active`: number search is showing, so it's worth reading
 * the schedules that say whether a recent competition is still on.
 */
export function useCompetitionChoices(competitions: Ref<CompetitionListItem[]>, active: Ref<boolean>) {
  const favorites = useFavoritesStore()
  const me = useMeStore()
  const { byCompetition } = useFollowedCompetitions()
  const { filterFor } = useLocationFilter()

  // A competition that started in the last fortnight may still be on.
  const { span: spanOf } = useCompetitionSpans(competitions, active)

  return computed<CompetitionChoice[]>(() => {
    const area = filterFor(competitions.value)
    return competitions.value
      .flatMap((c) => {
        // Numbers live with the dancers: a listed competition has none to
        // look in until it's published (unless it's yours).
        if (c.published !== true && !me.hasCompetitionPerm(c.id)) return []
        const span = spanOf(c)
        if (!span || Math.abs(span.first) > WINDOW_DAYS) return []
        return [
          {
            id: c.id,
            competition: c,
            days: span.first,
            today: span.first <= 0 && span.last >= 0,
            followed: favorites.isFavorite('competitions', c.id),
            dancers: byCompetition.value[c.id] ?? [],
            near: area.isActive && area.predicate(c),
          },
        ]
      })
      .sort(compareChoices)
  })
}
