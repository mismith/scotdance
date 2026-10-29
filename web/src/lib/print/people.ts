import { staffMemberName, type StaffMember } from '@/types/competition'
import type { Person } from '@/lib/print/model'

// Staff as paper names them.

export const person = (m: StaffMember): Person => ({ name: staffMemberName(m) || 'Unnamed', from: m.location?.trim() || undefined })

/** "Isla Gilchrist" → "I. Gilchrist", as platform grids name judges. */
export function shortName(m: Pick<StaffMember, 'firstName' | 'lastName'>): string {
  const first = (m.firstName ?? '').trim()
  const last = (m.lastName ?? '').trim()
  if (!last) return first
  return first ? `${first[0]}. ${last}` : last
}

export const isType = (m: StaffMember, type: string) => (m.type ?? '').trim().toLowerCase() === type

/**
 * Who sponsors an age group's trophy: a staff member's id (their name), or
 * on older competitions the name itself.
 */
export function sponsorName(sponsor: string | undefined, staffById: Map<string, StaffMember>): string | undefined {
  const s = sponsor?.trim()
  if (!s) return undefined
  const m = staffById.get(s)
  return m ? staffMemberName(m) || undefined : s
}
