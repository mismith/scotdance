import { scheduleIndex } from '@/lib/dancerDay'
import { CALLBACKS, OVERALL, danceState } from '@/lib/admin/results'
import { isDanced } from '@/lib/trophyEvents'
import { groupHasOverall, type Platform, type ResultsTree, type Schedule } from '@/types/competition'

// On competition day, where the volunteer entering results carries on: the
// first thing not entered yet, in the order it's danced. That's the
// schedule's order (each age group's callbacks before its first dance), then
// whatever the schedule leaves out in age group order, overalls last, then
// the trophy events (their one list each). A trophy event danced on its own
// is entered where the schedule has it, like an age group's dance: its
// callbacks first, then its placings.

interface Group {
  id: string
  category?: { name?: string } | null
}

export interface ResultsWork {
  groups: Group[]
  /** An age group's dances, in order. */
  dancesOf: (groupId: string) => Array<{ id: string }>
  /** Trophy events, entered after every age group (unless danced and on the schedule). */
  trophyEvents?: Array<{ id: string; danceId?: string }>
  results: ResultsTree
  schedule: Schedule | null
  platforms: Platform[]
}

export interface ResultSlot {
  groupId: string
  /** A dance's id, or CALLBACKS or OVERALL. */
  danceId: string
}

/** Everything to enter, in the order it's danced. */
export function resultsOrder(w: ResultsWork): ResultSlot[] {
  const out: ResultSlot[] = []
  const seen = new Set<string>()
  const add = (groupId: string, danceId: string) => {
    const key = `${groupId}:${danceId}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ groupId, danceId })
  }
  const known = new Map(w.groups.map((g) => [g.id, new Set(w.dancesOf(g.id).map((d) => d.id))]))
  const trophyEvents = new Map((w.trophyEvents ?? []).map((a) => [a.id, a]))
  const addTrophyEvent = (a: { id: string; danceId?: string }) => {
    if (isDanced(a)) add(a.id, CALLBACKS)
    add(a.id, OVERALL)
  }
  for (const slot of scheduleIndex(w.schedule, w.platforms).slots) {
    for (const groupId of slot.groupIds) {
      const a = trophyEvents.get(groupId)
      if (a) {
        // Only under its own dance's row: anywhere else it isn't danced.
        if (a.danceId && a.danceId === slot.danceId) addTrophyEvent(a)
        continue
      }
      // Only what can be entered: a deleted group, or a dance it doesn't do, can't.
      if (!known.get(groupId)?.has(slot.danceId)) continue
      add(groupId, CALLBACKS)
      add(groupId, slot.danceId)
    }
  }
  for (const g of w.groups) {
    add(g.id, CALLBACKS)
    for (const d of w.dancesOf(g.id)) add(g.id, d.id)
  }
  for (const g of w.groups) if (groupHasOverall(g)) add(g.id, OVERALL)
  for (const a of trophyEvents.values()) addTrophyEvent(a)
  return out
}

/**
 * The first thing not entered yet, or null once everything is. Callbacks
 * count as entered once any of the age group's placings are: not every
 * competition calls back, and entry has moved on past them.
 */
export function nextResult(w: ResultsWork): ResultSlot | null {
  const entered = (groupId: string, danceId: string) => danceState(w.results[groupId]?.[danceId]) !== 'todo'
  const started = (groupId: string) => Object.keys(w.results[groupId] ?? {}).some((id) => id !== CALLBACKS && entered(groupId, id))
  return resultsOrder(w).find((s) => !entered(s.groupId, s.danceId) && !(s.danceId === CALLBACKS && started(s.groupId))) ?? null
}
