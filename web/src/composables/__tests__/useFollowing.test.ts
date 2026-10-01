import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

// Following people, and the colour each one wears in your app.

const auth = reactive({
  uid: null as string | null,
  isSignedIn: false,
  requireSignIn: vi.fn(),
})
const favorites = reactive({
  dancers: {} as Record<string, string>,
  isFavorite: (_t: string, id: string) => !!favorites.dancers[id],
  setFavorite: vi.fn(async () => {}),
})
const writes: Array<{ path: string; value: unknown }> = []
let emit: ((v: unknown) => void) | null = null

vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('@/stores/favorites', () => ({ useFavoritesStore: () => favorites }))
vi.mock('@/firebase', () => ({ dataRef: (path: string) => ({ path }) }))
vi.mock('firebase/database', () => ({
  set: async (r: { path: string }, value: unknown) => void writes.push({ path: r.path, value }),
}))
vi.mock('@/lib/offline', () => ({
  onValueSaved: (_r: unknown, cb: (snap: { val: () => unknown }) => void) => {
    emit = (v) => cb({ val: () => v })
    return () => (emit = null)
  },
}))

const { oncePerPerson, useFollowing } = await import('@/composables/useFollowing')
const { useDancerColorsStore } = await import('@/stores/dancerColors')

beforeEach(() => {
  setActivePinia(createPinia())
  auth.uid = null
  auth.isSignedIn = false
  auth.requireSignIn.mockReset()
  favorites.setFavorite.mockClear()
  favorites.dancers = {}
  writes.length = 0
})

async function signIn(uid = 'u1') {
  auth.uid = uid
  auth.isSignedIn = true
  await nextTick()
}

describe('colours', () => {
  it('hands out colours in the order you followed, so the first dancer is red', async () => {
    const f = useFollowing()
    favorites.dancers = { a: 'A', b: 'B', c: 'C' }
    expect(['a', 'b', 'c'].map(f.colorIdFor)).toEqual(['dancer-1', 'dancer-2', 'dancer-3'])
    expect(f.colorFor('a')).toBe('var(--dancer-1)')
    expect(f.colorFor('nobody')).toBeNull()
    expect(f.paint(undefined)).toEqual({ '--dc': 'var(--primary)' })
  })

  it('keeps a chosen colour, and skips it for everyone else', async () => {
    useDancerColorsStore()
    await signIn()
    favorites.dancers = { a: 'A', b: 'B', c: 'C' }
    emit!({ b: 'dancer-1', c: 'not-a-colour' })
    const f = useFollowing()
    expect(['a', 'b', 'c'].map(f.colorIdFor)).toEqual(['dancer-2', 'dancer-1', 'dancer-3'])
  })

  it('wraps round when you follow more dancers than there are colours', () => {
    favorites.dancers = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`p${i}`, `P${i}`]))
    const f = useFollowing()
    expect(f.colorIdFor('p8')).toBe('dancer-1')
    expect(f.colorIdFor('p9')).toBe('dancer-2')
  })
})

describe('dancer colours store', () => {
  it('saves your choice, and forgets it for the next account', async () => {
    const colors = useDancerColorsStore()
    await colors.choose('a', 'dancer-6')
    expect(writes).toEqual([]) // signed out: nothing to save to
    await signIn('u1')
    emit!({ a: 'dancer-6' })
    expect(colors.chosen).toEqual({ a: 'dancer-6' })
    await colors.choose('a', 'dancer-3')
    await colors.choose('a', null)
    expect(writes.map((w) => [w.path, w.value])).toEqual([
      ['users:dancerColors/u1/a', 'dancer-3'],
      ['users:dancerColors/u1/a', null],
    ])
    await signIn('u2')
    expect(colors.chosen).toEqual({})
  })
})

describe('following', () => {
  it('asks you to sign in first, naming the dancer', async () => {
    const f = useFollowing()
    await f.setFollowing({ dancerId: 'p1', firstName: 'Isla', lastName: 'Ross' }, true)
    expect(auth.requireSignIn).toHaveBeenCalledWith(expect.any(Function), { reason: 'follow', name: 'Isla Ross' })
    expect(favorites.setFavorite).not.toHaveBeenCalled()
    // Once signed in, the queued follow is the person, with their name.
    await auth.requireSignIn.mock.calls[0][0]()
    expect(favorites.setFavorite).toHaveBeenCalledWith('dancers', 'p1', true, 'Isla Ross')
  })

  it('follows the person, not the entry, and ignores entries with no person yet', async () => {
    await signIn()
    const f = useFollowing()
    await f.toggle({ dancerId: 'p1', fullName: 'Isla Ross' })
    expect(favorites.setFavorite).toHaveBeenCalledWith('dancers', 'p1', true, 'Isla Ross')
    await f.toggle({ fullName: 'Unlinked' })
    expect(favorites.setFavorite).toHaveBeenCalledTimes(1)
    favorites.dancers = { p1: 'Isla Ross' }
    expect(f.isFollowing({ dancerId: 'p1' })).toBe(true)
    expect(f.isFollowing('p1')).toBe(true)
    expect(f.isFollowing({})).toBe(false)
  })

  it('lists each person once however many entries they have', () => {
    const list = [
      { id: 'e1', dancerId: 'p1' },
      { id: 'e2', dancerId: 'p1' },
      { id: 'e3' },
      { id: 'e4', dancerId: 'p2' },
    ]
    expect(oncePerPerson(list).map((d) => d.id)).toEqual(['e1', 'e3', 'e4'])
  })
})
