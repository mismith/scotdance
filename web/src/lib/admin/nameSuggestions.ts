import { normalizeEntityName } from '@/lib/entityIndex'
import { isTeam, memberName, teamMembers, type EntryLike } from '@/lib/entries'

// Names already dancing in this competition, offered while a dancer's name is
// typed (ADR 0012): "Ava" offers "Ava Reid · 101". Only ever this
// competition's, as a suggestion from all of ScotDance.app could merge two
// children. A suggestion fills the row; nothing is checked or changed if it's
// ignored.

export interface NameSuggestion {
  firstName: string
  lastName: string
  /** Where they dance here: "101 · Premier 12 & under", or a duet's "in 234". */
  line: string
}

interface Entry extends EntryLike {
  id: string
  num?: string
  firstName?: string
  lastName?: string
  group?: { label?: string }
}

/**
 * A name as a person's: no lists or notes ("Ava Reid & Mia Lee", "(ALT …)"),
 * as old rows typed a whole group into First and Last name.
 */
const personLike = (first: string, last: string) => !/[,&;/()+]|\band\b/i.test(`${first} ${last}`) && `${first} ${last}`.trim().split(/\s+/).length <= 4

/** Everyone dancing here, once each by name, with where. */
export function namesDancingHere(entries: Entry[]): Map<string, NameSuggestion> {
  const out = new Map<string, NameSuggestion & { own: string[]; teams: string[]; group?: string }>()
  const add = (first: string, last: string, own: string | null, team: string | null, group?: string) => {
    const firstName = first.trim()
    const lastName = last.trim()
    const key = normalizeEntityName(`${firstName} ${lastName}`)
    if (!firstName || !key || !personLike(firstName, lastName)) return
    const seen = out.get(key) ?? { firstName, lastName, line: '', own: [], teams: [], group }
    if (own) seen.own.push(own)
    if (team) seen.teams.push(team)
    seen.group ??= group
    out.set(key, seen)
  }
  for (const e of entries) {
    if (isTeam(e)) for (const [, m] of teamMembers(e)) add(String(m.firstName ?? ''), String(m.lastName ?? ''), null, e.num ?? '', e.group?.label)
    else add(e.firstName ?? '', e.lastName ?? '', e.num ?? '', null, e.group?.label)
  }
  for (const s of out.values()) {
    const own = s.own.filter(Boolean)
    s.line = own.length
      ? [own.join(', '), own.length === 1 ? s.group : null].filter(Boolean).join(' · ')
      : s.teams.filter(Boolean).length
        ? `in ${s.teams.filter(Boolean).join(', ')}`
        : (s.group ?? '')
  }
  return new Map([...out].map(([k, { firstName, lastName, line }]) => [k, { firstName, lastName, line }]))
}

/**
 * The names that fit what's typed: each word typed starts a word of the name,
 * in order of first name then last. Not the name already there in full, nor
 * anyone in `taken` (the entry's other dancers).
 */
export function suggestNames(
  typed: { firstName: string; lastName: string },
  here: Map<string, NameSuggestion>,
  taken: string[] = [],
  limit = 4,
): NameSuggestion[] {
  const words = normalizeEntityName(`${typed.firstName} ${typed.lastName}`).split(' ').filter(Boolean)
  if (!words.length || words.join('').length < 2) return []
  const full = words.join(' ')
  const skip = new Set(taken.map(normalizeEntityName))
  const out: NameSuggestion[] = []
  for (const [key, s] of here) {
    if (key === full || skip.has(key)) continue
    const theirs = key.split(' ')
    let at = 0
    const fits = words.every((w) => {
      while (at < theirs.length && !theirs[at].startsWith(w)) at++
      return at++ < theirs.length
    })
    if (fits) out.push(s)
  }
  return out.sort((a, b) => memberName(a).localeCompare(memberName(b))).slice(0, limit)
}
