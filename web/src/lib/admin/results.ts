import { scheduleIndex } from '@/lib/dancerDay'
import { groupHasOverall, type DancePlacing, type Platform, type ResultsTree, type Schedule } from '@/types/competition'

// Reading and writing one dance's placings in the stored format the public
// pages read (lib/results.ts):
//   ["reverse:6"?, "dancerId", "dancerId:tie", …]  or  false (none placed)
// ":tie" means tied with the dancer before. "reverse:N" means places were
// entered from Nth up to 1st (championship announcements).

export const CALLBACKS = 'callbacks'
export const OVERALL = 'overall'

const REVERSE = 'reverse:'
const TIE = ':tie'

export interface Entry {
  id: string
  tie: boolean
}

export interface Placings {
  reverseFrom: number | null
  entries: Entry[]
}

export function parsePlacings(raw: DancePlacing[] | false | null | undefined): Placings {
  if (!Array.isArray(raw)) return { reverseFrom: null, entries: [] }
  let reverseFrom: number | null = null
  let rest = raw
  if (typeof raw[0] === 'string' && raw[0].startsWith(REVERSE)) {
    const n = Number.parseInt(raw[0].slice(REVERSE.length), 10)
    reverseFrom = n > 0 ? n : null
    rest = raw.slice(1)
  }
  // Older data can have the first dancer "tied" with nobody: read it as untied.
  const entries = rest
    .filter((e): e is string => typeof e === 'string' && e.length > 0 && !e.startsWith(REVERSE))
    .map((e, i) => (e.endsWith(TIE) ? { id: e.slice(0, -TIE.length), tie: i > 0 } : { id: e, tie: false }))
  return { reverseFrom, entries }
}

/**
 * Back to the stored form. The edge entry can't be tied to nothing. As in the
 * old admin, Championship mode is kept before anyone is placed ("reverse:6"
 * alone), so it can be switched on first.
 */
export function serializePlacings({ reverseFrom, entries }: Placings): string[] | null {
  const out = entries.map((e, i) => (e.tie && i > 0 ? `${e.id}${TIE}` : e.id))
  if (reverseFrom) return [`${REVERSE}${reverseFrom}`, ...out]
  return out.length ? out : null
}

/** Take out entry `index`. If the first of a tie leaves, the next dancer starts it. */
export function removeEntry(p: Placings, index: number): Placings {
  const entries = p.entries.map((e) => ({ ...e }))
  const [removed] = entries.splice(index, 1)
  if (removed && !removed.tie && entries[index]?.tie) entries[index].tie = false
  return { ...p, entries }
}

/** The place shown for entry `index` (same rules as the public pages). */
export function placeAt(index: number, { reverseFrom, entries }: Placings): number | null {
  if (index < 0 || index >= entries.length) return null
  if (reverseFrom != null) {
    const rest = entries.slice(index + 1)
    const nextNonTie = rest.findIndex((e) => !e.tie)
    const groupEnd = nextNonTie < 0 ? entries.length - 1 : index + nextNonTie
    const place = reverseFrom - groupEnd
    return place > 0 ? place : null
  }
  let place = 0
  for (let i = 0; i <= index; i += 1) if (i === 0 || !entries[i].tie) place = i + 1
  return place
}

/** Tied with a neighbour (for the rosette's tie band). */
export const isTied = (index: number, { entries }: Placings) => !!(entries[index]?.tie || entries[index + 1]?.tie)

/** "?" dancers are stand-ins: a timestamp instead of a dancer id. */
export const isPlaceholderId = (id: string) => /^\d+$/.test(id)
export const newPlaceholderId = () => String(Date.now())

/** A "?" in a dance's placings or championship points still needs fixing. */
export const needsFixing = (raw: DancePlacing[] | false | null | undefined, pointed: string[] = []) =>
  parsePlacings(raw).entries.some((e) => isPlaceholderId(e.id)) || pointed.some(isPlaceholderId)

export type DanceState = 'done' | 'none' | 'todo'

/** The state in words, for screen readers. */
export const stateLabel = (state: DanceState, fix = false) =>
  fix ? 'has a ? to fix' : state === 'done' ? 'entered' : state === 'none' ? 'none placed' : 'not entered yet'

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

/** One age group dancing one dance on one platform. */
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
export function dancingNow(turns: Turn[], results: ResultsTree): Set<string> {
  const byPlatform = new Map<string, Turn[]>()
  for (const t of turns) byPlatform.set(t.platformId, [...(byPlatform.get(t.platformId) ?? []), t])
  const now = new Set<string>()
  for (const list of byPlatform.values()) {
    let lastIn = -1
    list.forEach((t, i) => {
      if (danceState(results[t.groupId]?.[t.danceId]) !== 'todo') lastIn = i
    })
    const turn = list[lastIn + 1]
    if (turn) now.add(turn.groupId)
  }
  return now
}
