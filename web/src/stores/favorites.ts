import { defineStore } from 'pinia'
import { computed, ref, watch, type Ref } from 'vue'
import { get, ref as dbRef, set, update } from 'firebase/database'
import { database } from '@/firebase'
import { lookupEntityId } from '@/lib/entityIndex'
import { onValueSaved } from '@/lib/offline'
import { useAuthStore } from './auth'

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

export type FavoriteValue = string | boolean
export type FavoriteType =
  | 'competitions'
  | 'dancers'
  | 'judges'
  | 'pipers'
  | 'venues'
  | 'organisations'

// Stored at /users:favorites/{uid}/{type}/{id} → value is either `true` or a
// denormed display name (kept so the favourites section on each list page can
// render before the slim index for that entity loads).
//
// All types now key by AGGREGATE id (one entity = one favourite). The old app
// (v3, still on many phones) keyed dancer favourites by per-competition entry
// and still reads them, so those are never deleted: each one with a name is
// copied once to the person it belongs to (see copyOldDancerFavourites), and
// v4 skips the old keys.

type StoredFavorites = Partial<Record<FavoriteType, Record<string, FavoriteValue>>> & {
  /** Old per-competition dancer key → the person it was copied to. */
  oldDancers?: Record<string, string>
}

export const useFavoritesStore = defineStore('favorites', () => {
  const auth = useAuthStore()

  const competitions = ref<Record<string, FavoriteValue>>({})
  const allDancers = ref<Record<string, FavoriteValue>>({})
  const judges = ref<Record<string, FavoriteValue>>({})
  const pipers = ref<Record<string, FavoriteValue>>({})
  const venues = ref<Record<string, FavoriteValue>>({})
  const organisations = ref<Record<string, FavoriteValue>>({})
  const copiedOld = ref<Record<string, string>>({})

  // The people you follow. Old per-competition keys are left out: a `true`
  // one has no name to find its person by (v4 never stores `true` for a
  // dancer), and a named one is followed under the person's id once copied.
  const dancers = computed<Record<string, FavoriteValue>>(() =>
    Object.fromEntries(
      Object.entries(allDancers.value).filter(([id, v]) => typeof v === 'string' && !copiedOld.value[id]),
    ),
  )

  const refs: Record<FavoriteType, Readonly<Ref<Record<string, FavoriteValue>>>> = {
    competitions,
    dancers,
    judges,
    pipers,
    venues,
    organisations,
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

  function load(val: StoredFavorites) {
    competitions.value = val.competitions ?? {}
    allDancers.value = val.dancers ?? {}
    judges.value = val.judges ?? {}
    pipers.value = val.pipers ?? {}
    venues.value = val.venues ?? {}
    organisations.value = val.organisations ?? {}
    copiedOld.value = val.oldDancers ?? {}
  }

  watch(
    () => auth.uid,
    (uid) => {
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      // Nothing of the last account carries over, even for a moment.
      load({})
      if (!uid) return
      const r = dbRef(database, `${NAMESPACE}/users:favorites/${uid}`)
      let copied = false
      unsubscribe = onValueSaved(r, (snap) => {
        const val = (snap.val() as StoredFavorites | null) ?? {}
        load(val)
        if (!copied) {
          copied = true
          void copyOldDancerFavourites(uid, val).catch(() => {})
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
    organisations,
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

/**
 * Follow the people behind old per-competition dancer favourites. The old
 * app keyed them by the competition entry, with the dancer's name as the
 * value; the name finds the person (/dancers:index). Each is copied once and
 * noted under `oldDancers`, so unfollowing in v4 sticks, and nothing is
 * deleted: the old app still reads its keys. A key that's already a person
 * matches its own name and is left alone.
 */
export async function copyOldDancerFavourites(uid: string, stored: StoredFavorites): Promise<void> {
  const dancers = stored.dancers ?? {}
  const done = stored.oldDancers ?? {}
  const updates: Record<string, string> = {}
  for (const [key, value] of Object.entries(dancers)) {
    if (typeof value !== 'string' || done[key]) continue
    // Already a person (a v4 follow, even of a profile that shares its name
    // with another): never an old key. Old keys are competition entries.
    // (If that can't be checked right now, leave it for next time.)
    const isPerson = await get(dbRef(database, `${NAMESPACE}/dancers/${key}/name`)).then((snap) => snap.exists(), () => true)
    if (isPerson) continue
    const personId = await lookupEntityId('dancers', value)
    if (!personId || personId === key) continue
    if (!dancers[personId]) updates[`dancers/${personId}`] = value
    updates[`oldDancers/${key}`] = personId
  }
  if (!Object.keys(updates).length) return
  await update(dbRef(database, `${NAMESPACE}/users:favorites/${uid}`), updates)
}
