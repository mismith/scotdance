import { computed } from 'vue'
import { useCompetition } from '@/composables/useCompetition'
import { useFollowing } from '@/composables/useFollowing'
import { competitionPhase, dancerDay, type DancerDay } from '@/lib/dancerDay'
import type { EnrichedDancer } from '@/types/competition'

// Inside a competition: the followed people entered here, each with their
// day (one DancerDay per age-group entry), in follow order.

export interface FollowedHere {
  personId: string
  color: string | null
  sash: string | null
  name: string
  days: DancerDay[]
}

export function useCompetitionDays() {
  const c = useCompetition()
  const following = useFollowing()

  const phase = computed(() => competitionPhase(c.competition.value?.date))

  const bundle = computed(() => ({
    dances: c.dances.value,
    results: c.results.value,
    points: c.points.value,
    schedule: c.schedule.value,
    platforms: c.platforms.value,
    draws: c.draws.value,
  }))

  function dayFor(d: EnrichedDancer): DancerDay {
    return dancerDay(d, bundle.value, phase.value)
  }

  const followedHere = computed<FollowedHere[]>(() => {
    const byPerson = new Map<string, EnrichedDancer[]>()
    for (const d of c.dancers.value) {
      if (!d.dancerId || !following.isFollowing(d)) continue
      const list = byPerson.get(d.dancerId) ?? []
      list.push(d)
      byPerson.set(d.dancerId, list)
    }
    return following.followedIds.value
      .filter((id) => byPerson.has(id))
      .map((id) => {
        const entries = byPerson.get(id)!
        return {
          personId: id,
          color: following.colorFor(id),
          sash: following.sashFor(id),
          name: entries[0].fullName,
          days: entries.map(dayFor),
        }
      })
  })

  /** Followed dancers per group id, for highlighting lists. */
  const followedByGroup = computed(() => {
    const m = new Map<string, EnrichedDancer[]>()
    for (const d of c.dancers.value) {
      if (!d.group || !following.isFollowing(d)) continue
      const list = m.get(d.group.id) ?? []
      list.push(d)
      m.set(d.group.id, list)
    }
    return m
  })

  return { phase, followedHere, followedByGroup, dayFor }
}
