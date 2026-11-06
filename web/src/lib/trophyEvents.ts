import { OVERALL_ID, type TrophyEvent, type Category, type EnrichedTrophyEvent, type ResultsTree } from '@/types/competition'
import { isPosted } from '@/lib/results'

// Trophy events (Dancer of the Day and other trophies across age groups). Their
// placings sit at results[trophyEventId][TROPHY_EVENT_RESULT]: trophy event ids are
// push keys, so they never clash with an age group's.

export const TROPHY_EVENT_RESULT = OVERALL_ID

interface GroupLike {
  id: string
  name?: string
  categoryId?: string
  /** The full name ("Premier 12 & Under 14"), as each side of the app labels it. */
  fullName?: string
  label?: string
}

const isWhole = (name?: string) => !name?.trim() || /^all ages$/i.test(name.trim())

/**
 * Who can win, said briefly: a category whose every age group is on is named
 * alone ("All Premier"), otherwise its age groups follow it ("Intermediate
 * 12 & Under 14, 14 & Under 16"). Categories are kept apart with " · ".
 */
export function openToText(groupIds: Record<string, boolean> | undefined, groups: GroupLike[], categories: Array<Pick<Category, 'id' | 'name'>>): string {
  const on = groups.filter((g) => groupIds?.[g.id])
  if (!on.length) return ''
  const parts: string[] = []
  const seen = new Set<string>()
  for (const g of on) {
    const cid = g.categoryId ?? ''
    if (seen.has(cid)) continue
    seen.add(cid)
    const category = categories.find((c) => c.id === cid)
    const cname = category?.name?.trim()
    const all = groups.filter((x) => (x.categoryId ?? '') === cid)
    const mine = on.filter((x) => (x.categoryId ?? '') === cid)
    if (!cname) {
      parts.push(...mine.map((x) => (x.fullName ?? x.label ?? x.name ?? '').trim()).filter(Boolean))
    } else if (mine.length === all.length) {
      parts.push(all.length === 1 ? cname : `All ${cname}`)
    } else {
      const names = mine.map((x) => (isWhole(x.name) ? cname : x.name!.trim()))
      parts.push(`${cname} ${names.join(', ')}`)
    }
  }
  return parts.join(' · ')
}

/** Trophy events with their age groups and "Open to" line, in the organiser's order. */
export function enrichTrophyEvents<G extends GroupLike>(
  raw: TrophyEvent[],
  groups: G[],
  categories: Array<Pick<Category, 'id' | 'name'>>,
): Array<Omit<EnrichedTrophyEvent, 'groups'> & { groups: G[] }> {
  return raw.map((a) => ({
    ...a,
    fullName: a.name?.trim() || 'Untitled trophy event',
    groups: groups.filter((g) => a.groupIds?.[g.id]),
    openTo: openToText(a.groupIds, groups, categories),
  }))
}

/** The trophy events an age group's dancers can win. */
export const trophyEventsFor = <A extends Pick<TrophyEvent, 'groupIds'>>(trophyEvents: A[], groupId: string | undefined | null) =>
  groupId ? trophyEvents.filter((a) => a.groupIds?.[groupId]) : []

/** Its placings are up (or it's marked as having none). */
export const trophyEventPosted = (results: ResultsTree | null | undefined, trophyEventId: string) => isPosted(results?.[trophyEventId]?.[TROPHY_EVENT_RESULT])

/** It can be won: some age group is switched on. One with none isn't waited on (counts, "every result is in"). */
export const isWinnable = (a: { groupIds?: Record<string, boolean> } & ({ groups?: unknown[] })) =>
  a.groups ? a.groups.length > 0 : Object.values(a.groupIds ?? {}).some(Boolean)
