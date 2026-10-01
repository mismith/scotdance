import type { DancePlacing } from '@/types/competition'

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

export type DanceState = 'done' | 'none' | 'todo'

/** done: placings entered; none: marked "none placed"; todo: nothing yet. */
export function danceState(raw: DancePlacing[] | false | null | undefined): DanceState {
  if (raw === false) return 'none'
  return parsePlacings(raw).entries.length ? 'done' : 'todo'
}
