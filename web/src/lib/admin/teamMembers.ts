// A team's dancers as Manage edits them: a list in order, saved as
// `members/{key}` (ADR 0012). Keys stay with their dancer from save to save,
// so a member's link to their profile (the server's `dancerId`) isn't lost
// when someone else is added or the order changes.

import { memberName, teamMembers } from '@/lib/entries'
import { normalizeEntityName } from '@/lib/entityIndex'
import type { TeamMember } from '@/types/competition'

export interface MemberDraft {
  key?: string
  firstName: string
  lastName: string
  /** Their profile, as the server linked it. */
  dancerId?: string
}

export const draftName = (m: Pick<MemberDraft, 'firstName' | 'lastName'>) => memberName(m)

/**
 * Whether a dancer on a team gets a profile: a first and last name, more than
 * initials (as functions/src/utility/entityConfigs.ts linkableMember). "Clare"
 * alone would join every Clare everywhere.
 */
export function linkable(m: Pick<MemberDraft, 'firstName' | 'lastName'>): boolean {
  const word = (v: unknown) => (typeof v === 'string' ? v.replace(/[^\p{L}]/gu, '') : '')
  return word(m.firstName).length >= 2 && word(m.lastName).length >= 2
}

/** A saved team's members as an ordered list. */
export function membersToList(members: Record<string, TeamMember> | null | undefined): MemberDraft[] {
  return teamMembers({ members }).map(([key, m]) => ({
    key,
    firstName: String(m.firstName ?? '').trim(),
    lastName: String(m.lastName ?? '').trim(),
    ...(m.dancerId && { dancerId: m.dancerId }),
  }))
}

/**
 * A list as saved: each dancer under their key (one they had before, by
 * key or by name, else a new one), in order, keeping their profile link.
 */
export function listToMembers(
  list: MemberDraft[],
  newKey: () => string,
  previous?: Record<string, TeamMember> | null,
): Record<string, TeamMember> | null {
  const before = membersToList(previous)
  const byName = new Map(before.map((m) => [normalizeEntityName(draftName(m)), m]))
  const used = new Set<string>()
  const out: Record<string, TeamMember> = {}
  list
    .filter((m) => draftName(m))
    .forEach((m, i) => {
      const same = (m.key && before.find((b) => b.key === m.key)) || byName.get(normalizeEntityName(draftName(m)))
      const key = same?.key && !used.has(same.key) ? same.key : newKey()
      used.add(key)
      const kept = same && normalizeEntityName(draftName(same)) === normalizeEntityName(draftName(m)) ? same.dancerId : undefined
      out[key] = {
        firstName: m.firstName.trim(),
        ...(m.lastName.trim() && { lastName: m.lastName.trim() }),
        _order: i,
        ...(kept && { dancerId: kept }),
      }
    })
  return Object.keys(out).length ? out : null
}
