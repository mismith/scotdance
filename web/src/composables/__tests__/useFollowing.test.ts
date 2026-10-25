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
  dancerAlertsOff: {} as Record<string, true>,
  isFavorite: (_t: string, id: string) => !!favorites.dancers[id],
  hasAlerts: (_t: string, id: string) => !!favorites.dancers[id] && !favorites.dancerAlertsOff[id],
  setFavorite: vi.fn(async () => {}),
  setDancerAlerts: vi.fn(async () => {}),
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
const { inkOn, inkOnLook, readLook, useDancerColorsStore } = await import('@/stores/dancerColors')

beforeEach(() => {
  setActivePinia(createPinia())
  auth.uid = null
  auth.isSignedIn = false
  auth.requireSignIn.mockReset()
  favorites.setFavorite.mockClear()
  favorites.setDancerAlerts.mockClear()
  favorites.dancers = {}
  favorites.dancerAlertsOff = {}
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

  it('wears your own colour as is, without taking a palette colour', async () => {
    useDancerColorsStore()
    await signIn()
    favorites.dancers = { a: 'A', b: 'B' }
    emit!({ a: '#12ab9f', b: '#nothex' })
    const f = useFollowing()
    expect(f.colorFor('a')).toBe('#12ab9f')
    expect(f.colorIdFor('b')).toBe('dancer-1')
  })

  it('wears a tartan woven in its first colour, which takes that colour’s turn', async () => {
    useDancerColorsStore()
    await signIn()
    favorites.dancers = { a: 'A', b: 'B' }
    const tartan = { color: 'dancer-1', sett: 'P40 K16 A16 K2 W2', colors: { P: '#b0102c', A: '#48a4c0' } }
    emit!({ a: tartan })
    const f = useFollowing()
    expect(f.lookFor('a')).toEqual(tartan)
    expect(f.colorIdFor('a')).toBe('dancer-1')
    expect(f.colorIdFor('b')).toBe('dancer-2')
    // (No canvas here to weave on, so the cloth stands in as its first colour.)
    expect(f.colorFor('a')).toBe('var(--dancer-1)')
  })

  it('ignores looks it can’t show, so those dancers get a handed-out colour', async () => {
    useDancerColorsStore()
    await signIn()
    favorites.dancers = { a: 'A', b: 'B', c: 'C' }
    emit!({ a: { color: 'dancer-3', sett: 'R40' }, b: { color: 'plaid', sett: 'P16' }, c: { color: 'dancer-3', sett: 'P16', colors: { P: 'navy' } } })
    const f = useFollowing()
    expect(['a', 'b', 'c'].map(f.colorIdFor)).toEqual(['dancer-1', 'dancer-2', 'dancer-3'])
  })

  it('wraps round when you follow more dancers than there are colours', () => {
    favorites.dancers = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`p${i}`, `P${i}`]))
    const f = useFollowing()
    expect(f.colorIdFor('p8')).toBe('dancer-9')
    expect(f.colorIdFor('p9')).toBe('dancer-1')
  })
})

describe('dancer colours store', () => {
  it('writes in ink on light colours, white on dark ones', () => {
    expect(inkOn('#ffee00')).toBe('#0c0f13')
    expect(inkOn('#1d6a48')).toBe('#ffffff')
  })

  it('reads a look: a colour, or a tartan the builder could have made', () => {
    expect(readLook('dancer-4')).toBe('dancer-4')
    expect(readLook('#12ab9f')).toBe('#12ab9f')
    expect(readLook('dancer-10')).toBeNull()
    expect(readLook({ color: 'dancer-4', sett: 'B16 K16', colors: { B: '#b5800a' } })).toEqual({ color: 'dancer-4', sett: 'B16 K16', colors: { B: '#b5800a' } })
    expect(readLook({ color: 'dancer-4', sett: 'P17', colors: {} })).toBeNull()
    expect(readLook({ color: 'dancer-4' })).toBeNull()
    expect(readLook({ color: 'dancer-4', sett: 'P16 R2', colors: { P: '#b5800a' } })).toBeNull() // R has no colour
    expect(readLook({ color: 'dancer-4', sett: 'P16', colors: { P: 'red' } })).toBeNull()
    expect(readLook({ color: 'dancer-4', sett: 'P16', colors: { K: '#b5800a', P: '#b5800a' } })).toBeNull()
  })

  it('reads a tartan in black and white alone, which the database keeps without colours', () => {
    expect(readLook({ color: 'dancer-4', sett: 'K16 W2' })).toEqual({ color: 'dancer-4', sett: 'K16 W2', colors: {} })
    expect(readLook({ color: 'dancer-4', sett: 'P16 K16' })).toBeNull()
    expect(readLook({ color: 'dancer-4', sett: 'P16 K16', second: '#14306b', colors: { P: '#b5800a' } })).toBeNull()
  })

  it('inks text for each kind of look: gold takes its own, cloth takes none (white with a halo)', () => {
    expect(inkOnLook('var(--dancer-4)')).toBe('var(--on-dancer-4, var(--on-dancer))')
    expect(inkOnLook('#ffee00')).toBe('#0c0f13')
    expect(inkOnLook('var(--cloth-abc)')).toBeNull()
  })

  it('saves a tartan with only the colours its stripes use, and not one it can’t weave', async () => {
    const colors = useDancerColorsStore()
    await signIn('u1')
    await colors.choose('a', { color: 'dancer-2', sett: 'P16 K16', colors: { P: '#1d6a48', S: '#14306b' } })
    await colors.choose('b', { color: 'dancer-2', sett: 'P16 S16', colors: { P: '#1d6a48' } })
    expect(writes.map((w) => [w.path, w.value])).toEqual([['users:dancerColors/u1/a', { color: 'dancer-2', sett: 'P16 K16', colors: { P: '#1d6a48' } }]])
  })

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

  it('turns a favourite’s alerts off and on, and only a favourite’s', async () => {
    await signIn()
    const f = useFollowing()
    favorites.dancers = { p1: 'Isla Ross' }
    expect(f.alertsOn({ dancerId: 'p1' })).toBe(true)
    expect(f.alertsOn('p2')).toBe(false)
    await f.setAlerts({ dancerId: 'p1' }, false)
    expect(favorites.setDancerAlerts).toHaveBeenCalledWith('p1', false)
    favorites.dancerAlertsOff = { p1: true }
    expect(f.alertsOn('p1')).toBe(false)
    expect(f.isFollowing('p1')).toBe(true)
    await f.setAlerts({ dancerId: 'p2' }, true)
    expect(favorites.setDancerAlerts).toHaveBeenCalledTimes(1)
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
