import { scheduleIndex } from '@/lib/dancerDay'
import { CALLBACKS, OVERALL, parsePlacings, serializePlacings, removeEntry, placeAt, isTied, isPlaceholderId, type Entry, type Placings } from '@shared/placings'
import { isDanced, turnResultId } from '@/lib/trophyEvents'
import { groupHasOverall, type DancePlacing, type Platform, type ResultsTree, type Schedule, type TrophyEvent } from '@/types/competition'

// Reading and writing one dance's placings in the stored format the public
// pages read (lib/results.ts): see shared/placings.ts.

export { CALLBACKS, OVERALL, parsePlacings, serializePlacings, removeEntry, placeAt, isTied, isPlaceholderId, type Entry, type Placings }

/**
 * Lets a tap through unless it's on the same thing as the last one, within
 * `ms` of it. In a loud hall a tap can miss its haptic and get tapped again,
 * which would place a dancer and then take them straight back out. A tap on
 * anything else always goes through.
 */
export function tapGuard(ms = 500, now: () => number = () => performance.now()) {
  let last: { key: string; at: number } | null = null
  return (key: string) => {
    const at = now()
    if (last && last.key === key && at - last.at < ms) return false
    last = { key, at }
    return true
  }
}

/** "?" dancers are stand-ins: a timestamp instead of a dancer id. */
export const newPlaceholderId = () => String(Date.now())

/** A "?" in a dance's placings or championship points still needs fixing. */
export const needsFixing = (raw: DancePlacing[] | false | null | undefined, pointed: string[] = []) =>
  parsePlacings(raw).entries.some((e) => isPlaceholderId(e.id)) || pointed.some(isPlaceholderId)

export type DanceState = 'done' | 'none' | 'todo'

/** The state in words, for screen readers. */
export const stateLabel = (state: DanceState, fix = false) =>
  fix ? 'has a ? to fix' : state === 'done' ? 'entered' : state === 'none' ? 'no results' : 'not entered yet'

/** done: placings entered; none: marked "none placed"; todo: nothing yet. */
export function danceState(raw: DancePlacing[] | false | null | undefined): DanceState {
  if (raw === false) return 'none'
  return parsePlacings(raw).entries.length ? 'done' : 'todo'
}

/** What an age group enters, in order: callbacks, its dances, then Overall (not Primary). */
export function resultRows(group: { category?: { name?: string } | null }, dances: { id: string; label: string }[]) {
  return [
    { id: CALLBACKS, label: 'Callbacks' },
    ...dances.map((d) => ({ id: d.id, label: d.label })),
    ...(groupHasOverall(group) ? [{ id: OVERALL, label: 'Overall' }] : []),
  ]
}

/**
 * What a trophy event enters, in order: a danced one's callbacks and its
 * dance (`danceLabel`), as an age group's; otherwise its one list of placings.
 * Its placings are stored as its Overall either way.
 */
export function trophyEventRows(a: Pick<TrophyEvent, 'danceId'>, danceLabel?: string) {
  return isDanced(a) ? [{ id: CALLBACKS, label: 'Callbacks' }, { id: OVERALL, label: danceLabel || 'Placings' }] : [{ id: OVERALL, label: 'Placings' }]
}

/** One age group (or danced trophy event) dancing one dance on one platform. */
export interface Turn {
  groupId: string
  danceId: string
  platformId: string
}

/** Every turn on the schedule, in running order. */
export const scheduleTurns = (schedule: Schedule | null, platforms: Platform[]): Turn[] =>
  scheduleIndex(schedule, platforms).slots.flatMap((s) => s.groupIds.map((groupId) => ({ groupId, danceId: s.danceId, platformId: s.platformId })))

/**
 * Age groups in the order their results come in: by their last turn on the
 * schedule (results follow it), then any not on it, in list order.
 */
export function resultsOrder(groupIds: string[], turns: Turn[]): string[] {
  const last = new Map(turns.map((t, i) => [t.groupId, i]))
  const rank = (id: string, i: number) => last.get(id) ?? turns.length + i
  return groupIds
    .map((id, i) => ({ id, rank: rank(id, i) }))
    .sort((a, b) => a.rank - b.rank)
    .map((g) => g.id)
}

/**
 * Age groups dancing now, as far as the results entered can tell: on each
 * platform, the turn after the last one with results in.
 */
export function dancingNow(turns: Turn[], results: ResultsTree, trophyEventIds: ReadonlySet<string> = new Set()): Set<string> {
  const byPlatform = new Map<string, Turn[]>()
  for (const t of turns) byPlatform.set(t.platformId, [...(byPlatform.get(t.platformId) ?? []), t])
  const now = new Set<string>()
  for (const list of byPlatform.values()) {
    let lastIn = -1
    list.forEach((t, i) => {
      // (A trophy event's turn is entered as its one list, whatever dance it's under.)
      if (danceState(results[t.groupId]?.[turnResultId(t.groupId, t.danceId, trophyEventIds)]) !== 'todo') lastIn = i
    })
    const turn = list[lastIn + 1]
    if (turn) now.add(turn.groupId)
  }
  return now
}
