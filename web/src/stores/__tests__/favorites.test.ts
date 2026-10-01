import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

// Favourites, and the old app's per-competition dancer favourites: those are
// copied to the person they belong to, once, and never deleted (the old app
// still reads them).

// Paths only: the Firebase calls below are all stubbed.
const NS = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'
const writes: Array<{ path: string; value: unknown }> = []
const index: Record<string, string> = {}
/** Profiles that exist but aren't what their name looks up to (e.g. a duplicate). */
const extraPeople: string[] = []
const auth = reactive<{ uid: string | null }>({ uid: null })
let emit: ((val: unknown) => void) | null = null
let listening: string | null = null

vi.mock('@/firebase', () => ({ database: {}, dataRef: () => ({}) }))
vi.mock('firebase/database', () => ({
  ref: (_db: unknown, path: string) => ({ path }),
  // People (profiles) exist under /dancers; old per-competition keys don't.
  get: async (r: { path: string }) => ({
    exists: () => [...Object.values(index), ...extraPeople].some((id) => r.path.endsWith(`/dancers/${id}/name`)),
  }),
  set: async (r: { path: string }, value: unknown) => void writes.push({ path: r.path, value }),
  update: async (r: { path: string }, value: unknown) => void writes.push({ path: r.path, value }),
}))
vi.mock('@/lib/offline', () => ({
  onValueSaved: (r: { path: string }, cb: (snap: { val: () => unknown }) => void) => {
    listening = r.path
    emit = (v) => cb({ val: () => v })
    return () => {
      listening = null
      emit = null
    }
  },
}))
vi.mock('@/lib/entityIndex', () => ({
  lookupEntityId: async (_ns: string, name: string) => index[name.toLowerCase()] ?? null,
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))

const { copyOldDancerFavourites, useFavoritesStore } = await import('@/stores/favorites')

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  writes.length = 0
  for (const k of Object.keys(index)) delete index[k]
  index['isla ross'] = 'personIsla'
  index['ava grant'] = 'personAva'
  extraPeople.length = 0
  auth.uid = null
  setActivePinia(createPinia())
})

describe('copyOldDancerFavourites', () => {
  it('follows the person behind a named old favourite and notes it, deleting nothing', async () => {
    await copyOldDancerFavourites('u1', {
      dancers: { oldIsla: 'Isla Ross', oldTrue: true, personAva: 'Ava Grant' },
    })
    expect(writes).toEqual([
      {
        path: `${NS}/users:favorites/u1`,
        value: { 'dancers/personIsla': 'Isla Ross', 'oldDancers/oldIsla': 'personIsla' },
      },
    ])
    expect(Object.values(writes[0].value as object)).not.toContain(null)
  })

  it('leaves a follow of a profile alone, even when its name now finds another profile', async () => {
    // Followed in v4 under a profile that's since lost its name to a duplicate.
    extraPeople.push('personIslaOld')
    await copyOldDancerFavourites('u1', { dancers: { personIslaOld: 'Isla Ross' } })
    expect(writes).toEqual([])
  })

  it('does nothing the second time', async () => {
    await copyOldDancerFavourites('u1', {
      dancers: { oldIsla: 'Isla Ross', personIsla: 'Isla Ross' },
      oldDancers: { oldIsla: 'personIsla' },
    })
    expect(writes).toEqual([])
  })

  it('does not follow again someone you unfollowed', async () => {
    // Copied before, then unfollowed in v4: the person's key is gone.
    await copyOldDancerFavourites('u1', { dancers: { oldIsla: 'Isla Ross' }, oldDancers: { oldIsla: 'personIsla' } })
    expect(writes).toEqual([])
  })

  it('keeps an existing follow as it is, and folds two old entries into one person', async () => {
    await copyOldDancerFavourites('u1', {
      dancers: { personIsla: 'Isla R.', old2018: 'Isla Ross', old2019: 'Isla Ross' },
    })
    expect(writes[0].value).toEqual({ 'oldDancers/old2018': 'personIsla', 'oldDancers/old2019': 'personIsla' })
  })

  it('leaves names it can’t find alone', async () => {
    await copyOldDancerFavourites('u1', { dancers: { oldGone: 'Someone Renamed' } })
    expect(writes).toEqual([])
  })
})

describe('useFavoritesStore', () => {
  it('lists the people you follow, not the old per-competition keys', async () => {
    const fav = useFavoritesStore()
    auth.uid = 'u1'
    await nextTick()
    expect(listening).toBe(`${NS}/users:favorites/u1`)
    emit!({
      dancers: { oldIsla: 'Isla Ross', oldTrue: true, personIsla: 'Isla Ross', personAva: 'Ava Grant' },
      oldDancers: { oldIsla: 'personIsla' },
      competitions: { c1: true },
    })
    expect(Object.keys(fav.dancers)).toEqual(['personIsla', 'personAva'])
    expect(fav.isFavorite('dancers', 'oldTrue')).toBe(false)
    expect(fav.isFavorite('dancers', 'personAva')).toBe(true)
    expect(fav.isFavorite('competitions', 'c1')).toBe(true)
  })

  it('copies old favourites once per session, from the first answer', async () => {
    useFavoritesStore()
    auth.uid = 'u1'
    await nextTick()
    emit!({ dancers: { oldAva: 'Ava Grant' } })
    await flush()
    expect(writes).toHaveLength(1)
    emit!({ dancers: { oldAva: 'Ava Grant', personAva: 'Ava Grant' }, oldDancers: { oldAva: 'personAva' } })
    await flush()
    expect(writes).toHaveLength(1)
  })

  it('forgets the last account the moment it changes', async () => {
    const fav = useFavoritesStore()
    auth.uid = 'u1'
    await nextTick()
    emit!({ dancers: { personIsla: 'Isla Ross' }, competitions: { c1: true } })
    expect(Object.keys(fav.dancers)).toEqual(['personIsla'])

    auth.uid = 'u2'
    await nextTick()
    // u2's favourites haven't arrived yet: nothing of u1's shows meanwhile.
    expect(fav.dancers).toEqual({})
    expect(fav.competitions).toEqual({})
    expect(listening).toBe(`${NS}/users:favorites/u2`)

    auth.uid = null
    await nextTick()
    expect(listening).toBeNull()
    expect(fav.dancers).toEqual({})
  })

  it('writes a follow under the person, with their name', async () => {
    const fav = useFavoritesStore()
    await expect(fav.setFavorite('dancers', 'personIsla', true, 'Isla Ross')).rejects.toThrow('Not signed in')
    auth.uid = 'u1'
    await nextTick()
    await fav.setFavorite('dancers', 'personIsla', true, 'Isla Ross')
    await fav.setFavorite('dancers', 'personAva', false)
    expect(writes).toEqual([
      { path: `${NS}/users:favorites/u1/dancers/personIsla`, value: 'Isla Ross' },
      { path: `${NS}/users:favorites/u1/dancers/personAva`, value: null },
    ])
  })
})
