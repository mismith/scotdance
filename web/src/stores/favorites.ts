import { defineStore } from 'pinia'
import { ref, watch, type Ref } from 'vue'
import { ref as dbRef, onValue, set, update } from 'firebase/database'
import { database } from '@/firebase'
import { lookupEntityId } from '@/lib/entityIndex'
import { useAuthStore } from './auth'

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

export type FavoriteValue = string | boolean
export type FavoriteType =
  | 'competitions'
  | 'dancers'
  | 'judges'
  | 'pipers'
  | 'venues'

const ALL_TYPES: FavoriteType[] = [
  'competitions',
  'dancers',
  'judges',
  'pipers',
  'venues',
]

// Stored at /users:favorites/{uid}/{type}/{id} → value is either `true` or a
// denormed display name (kept so the favourites section on each list page can
// render before the slim index for that entity loads).
//
// All types now key by AGGREGATE id (one entity = one favourite). Legacy
// dancer favourites (pre-aggregator) keyed by per-comp dancer id are migrated
// to aggregate id on first load — see migrateDancerFavourites below.

export const useFavoritesStore = defineStore('favorites', () => {
  const auth = useAuthStore()

  const competitions = ref<Record<string, FavoriteValue>>({})
  const dancers = ref<Record<string, FavoriteValue>>({})
  const judges = ref<Record<string, FavoriteValue>>({})
  const pipers = ref<Record<string, FavoriteValue>>({})
  const venues = ref<Record<string, FavoriteValue>>({})

  const refs: Record<FavoriteType, Ref<Record<string, FavoriteValue>>> = {
    competitions,
    dancers,
    judges,
    pipers,
    venues,
  }

  let unsubscribe: (() => void) | null = null

  function byType(type: FavoriteType): Record<string, FavoriteValue> {
    return refs[type].value
  }

  function isFavorite(type: FavoriteType, id: string): boolean {
    return Boolean(refs[type].value[id])
  }

  async function setFavorite(
    type: FavoriteType,
    id: string,
    on: boolean,
    name?: string,
  ): Promise<void> {
    if (!auth.uid) throw new Error('Not signed in')
    const path = `${NAMESPACE}/users:favorites/${auth.uid}/${type}/${id}`
    await set(dbRef(database, path), on ? name || true : null)
  }

  async function toggle(
    type: FavoriteType,
    id: string,
    name?: string,
  ): Promise<void> {
    await setFavorite(type, id, !refs[type].value[id], name)
  }

  // Back-compat aliases — existing callsites use these. Kept as thin wrappers
  // so we don't touch every consumer in this change.
  const isFavoriteDancer = (id: string) => isFavorite('dancers', id)
  const isFavoriteCompetition = (id: string) => isFavorite('competitions', id)
  const setDancer = (id: string, on: boolean, name?: string) =>
    setFavorite('dancers', id, on, name)
  const setCompetition = (id: string, on: boolean) =>
    setFavorite('competitions', id, on)
  const toggleDancer = (id: string, name?: string) =>
    toggle('dancers', id, name)
  const toggleCompetition = (id: string) => toggle('competitions', id)

  watch(
    () => auth.uid,
    (uid) => {
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      if (!uid) {
        for (const t of ALL_TYPES) refs[t].value = {}
        return
      }
      const r = dbRef(database, `${NAMESPACE}/users:favorites/${uid}`)
      let migrated = false
      unsubscribe = onValue(r, (snap) => {
        const val =
          (snap.val() as Partial<
            Record<FavoriteType, Record<string, FavoriteValue>>
          > | null) ?? {}
        for (const t of ALL_TYPES) refs[t].value = val[t] ?? {}
        if (!migrated) {
          migrated = true
          void migrateDancerFavourites(uid, val.dancers ?? {})
        }
      })
    },
    { immediate: true },
  )

  return {
    competitions,
    dancers,
    judges,
    pipers,
    venues,
    byType,
    isFavorite,
    setFavorite,
    toggle,
    // back-compat
    isFavoriteDancer,
    isFavoriteCompetition,
    setDancer,
    setCompetition,
    toggleDancer,
    toggleCompetition,
  }
})

// One-time per-session migration of dancer favourites from per-comp ids to
// aggregate ids. Pre-aggregator, FavoriteDancerButton keyed by the per-comp
// dancer push key; the value was the denormed dancer name. We resolve the
// name → aggregate id via /dancers:index, then rewrite the entry under the
// aggregate id (atomic multi-path update).
//
// Idempotent: entries whose key already matches the resolved aggregate id are
// skipped (no Firebase writes). Entries whose value isn't a string (no name
// to resolve) are left alone — orphan, but rare and harmless.
async function migrateDancerFavourites(
  uid: string,
  dancersMap: Record<string, FavoriteValue>,
): Promise<void> {
  const updates: Record<string, FavoriteValue | null> = {}
  for (const [key, value] of Object.entries(dancersMap)) {
    if (typeof value !== 'string') continue
    const aggId = await lookupEntityId('dancers', value)
    if (!aggId || aggId === key) continue
    updates[`dancers/${aggId}`] = value
    updates[`dancers/${key}`] = null
  }
  if (!Object.keys(updates).length) return
  await update(dbRef(database, `${NAMESPACE}/users:favorites/${uid}`), updates)
}
