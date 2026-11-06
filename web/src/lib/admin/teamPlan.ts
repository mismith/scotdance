// Converting a competition's old team rows into teams (ADR 0012 decision 8):
// what each row would become, and the one write that does it.
//
// Before teams existed, a team was a dancer's row with its title, dancers
// and studio typed into the name and location cells. The plan reads each
// row in an age group for teams (teamReader), and, elsewhere, a dancer's
// row with a routine typed into it ("Celtic Fairy - " | "Isla Grant").
// The conversion script (scripts/convert-teams.ts) writes only what it's sure of.

import { looksLikeTeamGroup, nameLike, placeLike, readSoloRoutine, readTeam, type MemberName, type ReadHints, type ReadTeam } from '@/lib/admin/teamReader'
import { listToMembers } from '@/lib/admin/teamMembers'
import { normalizeEntityName } from '@/lib/entityIndex'

export interface PlanRow {
  id: string
  num: string
  firstName?: string
  lastName?: string
  location?: string
  groupId?: string
  team?: boolean
  title?: string
  studio?: string
}
export interface PlanGroup {
  id: string
  label: string
  teams?: boolean
}

export interface TeamProposal {
  kind: 'team'
  id: string
  num: string
  before: { firstName: string; lastName: string; location: string }
  title: string
  members: MemberName[]
  studio: string
  location: string
  unsure: string[]
}
export interface RoutineProposal {
  kind: 'routine'
  id: string
  num: string
  groupId: string
  before: { firstName: string; lastName: string; location: string }
  firstName: string
  lastName: string
  title: string
  studio: string
  location: string
  unsure: string[]
}
export type Proposal = TeamProposal | RoutineProposal

export interface ConversionGroup {
  group: PlanGroup
  /** A teams age group by its name or its Teams switch. Rows that only look like teams are shown, switched off. */
  likely: boolean
  /** Rows that look like teams, should the age group be for teams. */
  teams: TeamProposal[]
}

export interface ConversionPlan {
  groups: ConversionGroup[]
  routines: RoutineProposal[]
}

const studioWord = (s: string) => /\b(school|academy|studio|dancers|dance|dancing|highland|troupe|company|club)\b/i.test(s)

const text = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '')

/** What each of a competition's rows would become, by age group. */
export function planConversion(rows: PlanRow[], groups: PlanGroup[], wide: Pick<ReadHints, 'places' | 'people' | 'firstNames' | 'studios'> = {}): ConversionPlan {
  const known = new Set(rows.filter((r) => !r.team).map((r) => normalizeEntityName(`${text(r.firstName)} ${text(r.lastName)}`)))
  // Some competitions type each entry's studio where the town goes, all the
  // way down ("House of Bruce", "Laura Sywyk"): when most Locations that
  // aren't places read as studios, they all are.
  const locations = rows.filter((r) => !r.team).map((r) => text(r.location)).filter(Boolean)
  const studios = locations.filter((l) => !placeLike(l) && studioWord(l)).length
  const locationIsStudio = locations.length >= 4 && studios >= locations.length * 0.5
  const out: ConversionGroup[] = []
  const routines: RoutineProposal[] = []
  // (Other age groups: in this one, the first cell may be every row's routine.)
  const firstNamesOutside = (groupId: string) =>
    new Set(rows.filter((r) => !r.team && r.groupId !== groupId).map((r) => normalizeEntityName(text(r.firstName))).filter((n) => n && !n.includes(' ')))
  for (const group of groups) {
    const inGroup = rows.filter((r) => r.groupId === group.id && !r.team)
    if (!inGroup.length) continue
    const byName = group.teams ?? looksLikeTeamGroup(group.label)
    // An age group named for solos never holds teams, however its rows read.
    const solos = group.teams !== true && /\bsolos?\b/i.test(group.label)
    const teams = inGroup.map<TeamProposal>((r) => {
      const before = { firstName: text(r.firstName), lastName: text(r.lastName), location: text(r.location) }
      // Their own name isn't a reason to doubt them.
      const others = new Set(known)
      others.delete(normalizeEntityName(`${before.firstName} ${before.lastName}`))
      const read: ReadTeam = readTeam({ first: before.firstName, last: before.lastName, location: before.location }, { ...wide, group: group.label, knownNames: others, locationIsStudio })
      return { kind: 'team', id: r.id, num: r.num, before, ...read }
    })
    // Rows alone never make an age group one for teams: "Home Again" | "Ella
    // Sul" reads as well as a duet as a solo with its routine. Where they look
    // like teams but the name doesn't say, the age group is shown, switched off.
    const teamish = teams.filter((t) => t.members.length >= 2 || (t.studio && !t.unsure.length)).length
    const likely = !solos && group.teams !== false && byName
    if (likely || (!solos && teamish >= Math.max(2, inGroup.length * 0.3) && group.teams !== false)) out.push({ group, likely, teams })
    // Solo routines everywhere but an age group set for teams: shown for
    // whichever age groups end up switched off.
    if (group.teams !== true) {
      // Most rows a routine then a dancer's full name: the age group's way of typing them.
      // (A team's row isn't one: "Ava Reid &" | "Mia Lee" is a list run across both cells.)
      const listed = (v: string) => /([&,/]|\band)\s*$/i.test(v)
      const titleFirst =
        inGroup.length >= 2 &&
        inGroup.filter((r) => text(r.firstName) && !listed(text(r.firstName)) && text(r.lastName).split(' ').length >= 2 && nameLike(text(r.lastName))).length >= inGroup.length * 0.6
      const outside = firstNamesOutside(group.id)
      for (const r of inGroup) {
        // One with its routine already is tidy.
        if (text(r.title)) continue
        const before = { firstName: text(r.firstName), lastName: text(r.lastName), location: text(r.location) }
        const solo = readSoloRoutine({ first: before.firstName, last: before.lastName, location: before.location }, { titleFirst, locationIsStudio })
        // (Not two dancers: "Lyla Coghlan" | "Charlotte Lugtigheid".)
        if (!solo || wide.people?.has(normalizeEntityName(solo.title))) continue
        // A routine that's a first name dancing elsewhere here may be half a name ("Mary" | "Jane Smith").
        const unsure = outside.has(normalizeEntityName(solo.title)) && !wide.people?.has(normalizeEntityName(`${solo.firstName} ${solo.lastName}`)) ? [`Is “${solo.title}” the routine, or part of ${solo.firstName}’s name?`] : []
        routines.push({ kind: 'routine', id: r.id, num: r.num, groupId: group.id, before, ...solo, unsure })
      }
    }
  }
  return { groups: out, routines }
}

/**
 * The write: each chosen team row made a team (its first and last name kept
 * as v3's copy), and each chosen routine tidied into the dancer's own
 * fields. Paths under competitions:data/{id}.
 */
export function conversionUpdates(chosen: { teams: TeamProposal[]; routines: RoutineProposal[] }, newKey: () => string): Record<string, unknown> {
  const updates: Record<string, unknown> = {}
  const or = (v: string) => (v.trim() ? v.trim() : null)
  for (const t of chosen.teams) {
    const at = `dancers/${t.id}`
    updates[`${at}/team`] = true
    updates[`${at}/title`] = or(t.title)
    updates[`${at}/studio`] = or(t.studio)
    updates[`${at}/location`] = or(t.location)
    updates[`${at}/members`] = listToMembers(t.members, newKey)
    // A team isn't a person: its old profile goes, its members get theirs.
    updates[`${at}/dancerId`] = null
  }
  for (const r of chosen.routines) {
    const at = `dancers/${r.id}`
    updates[`${at}/firstName`] = or(r.firstName)
    updates[`${at}/lastName`] = or(r.lastName)
    updates[`${at}/title`] = or(r.title)
    updates[`${at}/studio`] = or(r.studio)
    updates[`${at}/location`] = or(r.location)
  }
  return updates
}
