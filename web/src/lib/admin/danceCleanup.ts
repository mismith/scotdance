import { standardDance } from '@/lib/standardDances'

// Standard dances typed another way ("FLING", "S.T (3&1)", "Half Hullachan"),
// for System admin › Cleanup › Dances to save as setup offers them: the
// standard name, steps written into the name moved to Steps, and the
// standard short name when it had none or another way of saying the same.
// A dance whose name is already standard is left as it is.
// Anything else stays as typed (lib/standardDances says what matches).

export interface DanceFields {
  name?: unknown
  steps?: unknown
  shortName?: unknown
}

export interface Tidied {
  name: string
  steps: string
  shortName: string
}

const text = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '')
// Apostrophes either way are the same name ("Flora MacDonald's Fancy").
const plain = (s: string) => s.replace(/[’‘`]/g, "'")
const sameSteps = (a: string, b: string) => a.replace(/\s/g, '') === b.replace(/\s/g, '')

/** A dance as it is now, in the fields Standardise changes. */
export const fieldsOf = (d: DanceFields): Tidied => ({
  name: text(d.name),
  steps: text(d.steps),
  shortName: text(d.shortName),
})

/** What Standardise saves for a dance, or null when it's left as is. */
export function tidyDance(d: DanceFields): Tidied | null {
  const now = fieldsOf(d)
  const match = standardDance(now.name)
  if (!match) return null
  const { dance } = match
  // Steps in the name that say something else than Steps: leave it to a person.
  if (match.steps && now.steps && !sameSteps(match.steps, now.steps)) return null
  const shortName = dance.shortName && (!now.shortName || standardDance(now.shortName)?.dance === dance) ? dance.shortName : now.shortName
  const to: Tidied = {
    name: plain(now.name) === plain(dance.name) && !match.steps ? now.name : dance.name,
    steps: now.steps || match.steps || '',
    shortName,
  }
  // A standard name is left as it is, short name and all.
  return to.name === now.name && to.steps === now.steps ? null : to
}
