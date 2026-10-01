import { get, ref as dbRef } from 'firebase/database'
import { database } from '@/firebase'
import { getDancerPlace } from '@/lib/results'
import { OVERALL_ID, groupFullName, type Category, type Dance, type Group } from '@/types/competition'

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
  placings: Array<{ danceId: string; name: string; place: number; tied: boolean }>
  overall: { place: number; tied: boolean } | null
}

const cache = new Map<string, Promise<EntrySummary | null>>()

export function fetchEntrySummary(competitionId: string, entryId: string): Promise<EntrySummary | null> {
  const key = `${competitionId}:${entryId}`
  let p = cache.get(key)
  if (!p) {
    p = (async () => {
      try {
        const entry = await val<{ groupId?: string }>(`${competitionId}/dancers/${entryId}`)
        const groupId = entry?.groupId
        if (!groupId) return { groupName: null, placings: [], overall: null }
        const [group, results, dances] = await Promise.all([
          val<Group>(`${competitionId}/groups/${groupId}`),
          val<Record<string, unknown>>(`${competitionId}/results/${groupId}`),
          val<Record<string, Dance>>(`${competitionId}/dances`),
        ])
        const category = group?.categoryId
          ? await val<Category>(`${competitionId}/categories/${group.categoryId}`)
          : null
        const tree = { [groupId]: (results ?? {}) as never }
        const placings: EntrySummary['placings'] = []
        for (const [danceId, dance] of Object.entries(dances ?? {})) {
          if (!dance?.groupIds?.[groupId]) continue
          const r = getDancerPlace(entryId, groupId, danceId, tree, {})
          if (r.place != null) placings.push({ danceId, name: dance.name ?? 'Dance', place: r.place, tied: r.tied })
        }
        placings.sort((a, b) => a.place - b.place)
        const o = getDancerPlace(entryId, groupId, OVERALL_ID, tree, {})
        return {
          groupName: group ? groupFullName({ ...group, id: groupId }, category ?? undefined) : null,
          placings,
          overall: o.place != null ? { place: o.place, tied: o.tied } : null,
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
