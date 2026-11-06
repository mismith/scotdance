import { OVERALL_ID, type TrophyEvent, type Category, type EnrichedTrophyEvent, type ResultsTree } from '@/types/competition'
import { CALLBACKS_ID, isPosted } from '@/lib/results'

// Trophy events (Dancer of the Day and other trophies across age groups). Their
// placings sit at results[trophyEventId][TROPHY_EVENT_RESULT]: trophy event ids are
// push keys, so they never clash with an age group's.
//
// Most are decided from the age groups' results. A danced one (a Trophy Fling,
// a dance-off) has a dance, sits on the schedule like an age group (its id in a
// platform's orderedGroupIds) and has callbacks, as an age group does: until
// they're in (or with none), everyone it's open to dances it.

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

/** It's danced on its own, rather than decided from the age groups' results. */
export const isDanced = (a: Pick<TrophyEvent, 'danceId'>) => !!a.danceId

/**
 * The result a schedule turn fills: an age group's dance, or a trophy event's
 * one list (whatever dance its cell is under).
 */
export const turnResultId = (id: string, danceId: string, trophyEventIds: ReadonlySet<string>) =>
  trophyEventIds.has(id) ? TROPHY_EVENT_RESULT : danceId

/**
 * Who was called back for a danced one, by entry id: null when it isn't
 * danced or has no callbacks (yet, or marked "No callbacks"), so everyone
 * it's open to dances it, as in an age group.
 */
export function calledBackIds(a: Pick<TrophyEvent, 'id' | 'danceId'>, results: ResultsTree | null | undefined): Set<string> | null {
  if (!isDanced(a)) return null
  const raw = results?.[a.id]?.[CALLBACKS_ID]
  const ids = (Array.isArray(raw) ? raw : [])
    .filter((x): x is string => typeof x === 'string' && !!x && !x.startsWith('reverse:'))
    .map((x) => x.replace(/:tie$/, ''))
  return ids.length ? new Set(ids) : null
}

/**
 * Its dancers: everyone in the age groups it's open to or, when a danced one
 * has callbacks, those called back. Entries are the competition's dancers,
 * by their age group.
 */
export function trophyEventEntrants<D extends { id: string; groupId?: string; group?: { id: string } | null }>(
  a: Pick<TrophyEvent, 'id' | 'groupIds' | 'danceId'>,
  dancers: D[],
  results: ResultsTree | null | undefined,
): D[] {
  const eligible = dancers.filter((d) => {
    const gid = d.group?.id ?? d.groupId
    return !!gid && !!a.groupIds?.[gid]
  })
  const called = calledBackIds(a, results)
  return called ? eligible.filter((d) => called.has(d.id)) : eligible
}
