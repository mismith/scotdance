import { computed } from 'vue'
import { useCompetition } from '@/composables/useCompetition'
import { useFollowing } from '@/composables/useFollowing'
import { compareDays, competitionPhase, dancerDay, type DancerDay } from '@/lib/dancerDay'
import type { EnrichedDancer } from '@/types/competition'

// Inside a competition: the followed people entered here, each with their
// day (one DancerDay per entry: their own in each age group, and any team
// they're in), in follow order.

export interface FollowedHere {
  personId: string
  color: string | null
  name: string
  days: DancerDay[]
}

export function useCompetitionDays() {
  const c = useCompetition()
  const following = useFollowing()

  // Every day of a competition over several is "today" (from the schedule's days).
  const phase = computed(() => competitionPhase(c.competition.value?.date, c.schedule.value))

  const bundle = computed(() => ({
    dances: c.dances.value,
    results: c.results.value,
    points: c.points.value,
    schedule: c.schedule.value,
    platforms: c.platforms.value,
    draws: c.draws.value,
    // So "group 2 of 3" skips age groups since deleted.
    groups: c.groups.value,
    trophyEvents: c.trophyEvents.value,
  }))

  function dayFor(d: EnrichedDancer): DancerDay {
    return dancerDay(d, bundle.value, phase.value)
  }

  /** Each person's entries here, by profile id: their own, then their teams'. */
  const entriesByPerson = computed(() => {
    const own = new Map<string, EnrichedDancer[]>()
    const teams = new Map<string, EnrichedDancer[]>()
    const names = new Map<string, string>()
    for (const d of c.dancers.value) {
      if (d.dancerId) {
        own.set(d.dancerId, [...(own.get(d.dancerId) ?? []), d])
        names.set(d.dancerId, d.fullName)
      }
      for (const m of d.teamMembers ?? []) {
        if (!m.dancerId) continue
        teams.set(m.dancerId, [...(teams.get(m.dancerId) ?? []), d])
        if (!names.has(m.dancerId)) names.set(m.dancerId, m.name)
      }
    }
    const out = new Map<string, { name: string; entries: EnrichedDancer[] }>()
    for (const id of new Set([...own.keys(), ...teams.keys()])) {
      out.set(id, { name: names.get(id) ?? '', entries: [...(own.get(id) ?? []), ...(teams.get(id) ?? [])] })
    }
    return out
  })

  /** One person's entries here (their own, then their teams'), by profile id. */
  const entriesFor = (personId: string) => entriesByPerson.value.get(personId)?.entries ?? []

  const followedHere = computed<FollowedHere[]>(() => {
    const byPerson = entriesByPerson.value
    return following.followedIds.value
      .filter((id) => byPerson.has(id))
      .map((id) => {
        const { name, entries } = byPerson.get(id)!
        return {
          personId: id,
          color: following.colorFor(id),
          name,
          days: entries.map(dayFor),
        }
      })
      // Whoever's up soonest first, as on Home; otherwise in follow order.
      .sort((a, b) => compareDays(a.days, b.days))
  })

  /** Followed dancers per group id, for highlighting lists. */
  const followedByGroup = computed(() => {
    const m = new Map<string, EnrichedDancer[]>()
    for (const d of c.dancers.value) {
      if (!d.group || !following.isFollowing(d)) continue
      const list = m.get(d.group.id) ?? []
      if (!list.some((x) => (x.dancerId ?? x.id) === (d.dancerId ?? d.id))) list.push(d)
      m.set(d.group.id, list)
    }
    return m
  })

  return { phase, followedHere, followedByGroup, dayFor, entriesFor }
}
