import { get, ref as dbRef } from 'firebase/database'
import { database } from '@/firebase'
import { TROPHY_EVENT_RESULT, trophyEventsFor, enrichTrophyEvents } from '@/lib/trophyEvents'
import { getDancerPlace, isPosted } from '@/lib/results'
import { OVERALL_ID, groupFullName, type TrophyEvent, type Category, type Dance, type Dancer, type Group } from '@/types/competition'
import { entryName, isTeam } from '@/lib/entries'

// One competition entry's placings, read narrowly (the entry, its group, the
// group's results, the dance list) rather than a whole competition, so a
// dancer's profile can show placings for many competitions cheaply.

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'
const val = async <T>(path: string): Promise<T | null> => {
  const snap = await get(dbRef(database, `${NAMESPACE}/competitions:data/${path}`))
  const v = snap.val()
  return v && typeof v === 'object' ? (v as T) : null
}

export interface EntrySummary {
  groupName: string | null
  /** A team's entry (ADR 0012): its name. Its placings are the team's, not the dancer's own. */
  team: string | null
  placings: Array<{ danceId: string; name: string; place: number; tied: boolean }>
  /** Dances with results posted where this entry wasn't placed: danced, no place. */
  danced: Array<{ danceId: string; name: string }>
  overall: { place: number; tied: boolean } | null
  /** Overall results are posted and this entry wasn't placed in them. */
  overallMissed: boolean
  /** Trophy events (trophies across age groups) they placed in, in the organiser's order. */
  trophyEvents: Array<{ id: string; name: string; place: number; tied: boolean }>
}

const cache = new Map<string, Promise<EntrySummary | null>>()

export function fetchEntrySummary(competitionId: string, entryId: string): Promise<EntrySummary | null> {
  const key = `${competitionId}:${entryId}`
  let p = cache.get(key)
  if (!p) {
    p = (async () => {
      try {
        const entry = await val<Omit<Dancer, 'id'>>(`${competitionId}/dancers/${entryId}`)
        const groupId = entry?.groupId
        if (!groupId) return { groupName: null, team: null, placings: [], danced: [], overall: null, overallMissed: false, trophyEvents: [] }
        const [group, results, dances, allTrophyEvents] = await Promise.all([
          val<Group>(`${competitionId}/groups/${groupId}`),
          val<Record<string, unknown>>(`${competitionId}/results/${groupId}`),
          val<Record<string, Dance>>(`${competitionId}/dances`),
          // An extra: without it (rules not out yet, say) the rest still shows.
          val<Record<string, TrophyEvent>>(`${competitionId}/trophyEvents`).catch(() => null),
        ])
        const category = group?.categoryId
          ? await val<Category>(`${competitionId}/categories/${group.categoryId}`)
          : null
        const tree = { [groupId]: (results ?? {}) as never }
        const placings: EntrySummary['placings'] = []
        const danced: EntrySummary['danced'] = []
        for (const [danceId, dance] of Object.entries(dances ?? {})) {
          if (!dance?.groupIds?.[groupId] || danceId === OVERALL_ID) continue
          const r = getDancerPlace(entryId, groupId, danceId, tree, {})
          if (r.place != null) placings.push({ danceId, name: dance.name ?? 'Dance', place: r.place, tied: r.tied })
          // Unposted results say nothing about who danced, so they stay out.
          else if (isPosted(results?.[danceId] as never)) danced.push({ danceId, name: dance.name ?? 'Dance' })
        }
        placings.sort((a, b) => a.place - b.place)
        const o = getDancerPlace(entryId, groupId, OVERALL_ID, tree, {})
        // Only the trophy events this age group can win have their placings read,
        // in the organiser's order (no order last), as everywhere else.
        const listed = Object.entries(allTrophyEvents ?? {})
          .filter(([, a]) => a && typeof a === 'object')
          .map(([id, a]) => ({ ...a, id }))
          .sort((a, b) => (a._order ?? Infinity) - (b._order ?? Infinity) || (a.id < b.id ? -1 : 1))
        const open = enrichTrophyEvents(trophyEventsFor(listed, groupId), [], [])
        const trophyEvents: EntrySummary['trophyEvents'] = []
        const lists = await Promise.all(open.map((a) => val<string[]>(`${competitionId}/results/${a.id}/${TROPHY_EVENT_RESULT}`).catch(() => null)))
        open.forEach((a, i) => {
          const r = getDancerPlace(entryId, a.id, TROPHY_EVENT_RESULT, { [a.id]: { [TROPHY_EVENT_RESULT]: lists[i] ?? [] } } as never, {})
          if (r.place != null) trophyEvents.push({ id: a.id, name: a.fullName, place: r.place, tied: r.tied })
        })
        const groupName = group ? groupFullName({ ...group, id: groupId }, category ?? undefined) : null
        return {
          // A team's entry by the team ("Silver Sails (Duet Group B)").
          groupName: isTeam(entry) ? `${entryName(entry)}${groupName ? ` (${groupName})` : ''}` : groupName,
          team: isTeam(entry) ? entryName(entry) : null,
          placings,
          danced,
          overall: o.place != null ? { place: o.place, tied: o.tied } : null,
          overallMissed: o.place == null && isPosted(results?.[OVERALL_ID] as never),
          trophyEvents,
        }
      } catch {
        // Offline or a hiccup: try again next time rather than keep nothing.
        cache.delete(key)
        return null
      }
    })()
    cache.set(key, p)
  }
  return p
}
