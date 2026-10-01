// An in-memory stand-in for the Realtime Database, close enough to its rules
// that schedule writes can be checked for the shape older apps read:
// - multi-path updates, with ancestor/descendant paths in one update refused
// - null deletes, and empty objects and arrays aren't kept
// - arrays are stored as objects keyed 0, 1, 2… and read back as arrays when
//   more than half of the keys from 0 up are there (as Firebase does)
// - `undefined` anywhere in a value is refused, as the SDK does
// - children read back in key order (integer keys first, then by bytes)

import { ref } from 'vue'

type Listener = { path: string; cb: (snap: { val: () => unknown }) => void }

// Matches what lib/admin/write.ts prefixes paths with.
export const NS = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

const state = {
  root: {} as Record<string, unknown>,
  listeners: [] as Listener[],
  /** Every update applied, with full paths. */
  writes: [] as Array<Record<string, unknown>>,
  keyCount: 0,
}

const parts = (p: string) => p.split('/').filter(Boolean)
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

function toStored(v: unknown, at: string): unknown {
  if (v === undefined) throw new Error(`update failed: value contains undefined at ${at}`)
  if (v === null) return null
  if (Array.isArray(v)) return toStored(Object.fromEntries(v.map((x, i) => [String(i), x])), at)
  if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`update failed: ${v} at ${at}`)
  if (isObj(v)) {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) {
      if (!k || /[.#$/[\]]/.test(k)) throw new Error(`update failed: bad key "${k}" at ${at}`)
      const s = toStored(x, `${at}/${k}`)
      if (s !== null) out[k] = s
    }
    return Object.keys(out).length ? out : null
  }
  return v
}

const intKey = (k: string) => /^(0|-?[1-9]\d*)$/.test(k) && Math.abs(Number(k)) <= 2 ** 31
function sortKeys(keys: string[]) {
  return [...keys].sort((a, b) => {
    const ia = intKey(a)
    const ib = intKey(b)
    if (ia && ib) return Number(a) - Number(b)
    if (ia !== ib) return ia ? -1 : 1
    return a < b ? -1 : a > b ? 1 : 0
  })
}

function fromStored(v: unknown): unknown {
  if (!isObj(v)) return v
  const keys = sortKeys(Object.keys(v))
  if (keys.length && keys.every((k) => /^(0|[1-9]\d*)$/.test(k))) {
    const max = Math.max(...keys.map(Number))
    if (keys.length * 2 > max + 1) {
      const arr: unknown[] = new Array(max + 1)
      for (const k of keys) arr[Number(k)] = fromStored(v[k])
      return arr
    }
  }
  return Object.fromEntries(keys.map((k) => [k, fromStored(v[k])]))
}

function getStored(path: string): unknown {
  let node: unknown = state.root
  for (const k of parts(path)) node = isObj(node) ? node[k] : undefined
  return node ?? null
}

function notify() {
  for (const l of state.listeners) {
    const value = fromStored(getStored(l.path))
    l.cb({ val: () => (value == null ? null : JSON.parse(JSON.stringify(value))) })
  }
}

export function reset(data: Record<string, unknown> = {}) {
  state.root = (toStored(data, '') as Record<string, unknown>) ?? {}
  state.listeners = []
  state.writes = []
  state.keyCount = 0
}

/** The value at a path, as the SDK's `val()` would give it. */
export function read(path: string): unknown {
  const v = fromStored(getStored(path))
  return v == null ? null : JSON.parse(JSON.stringify(v))
}

export const writes = () => state.writes

export function applyUpdate(base: string, updates: Record<string, unknown>) {
  const paths = Object.keys(updates).map((k) => [...parts(base), ...parts(k)].join('/'))
  for (const a of paths)
    for (const b of paths)
      if (a !== b && b.startsWith(`${a}/`))
        throw new Error(`update failed: path ${a} is an ancestor of ${b}`)
  Object.entries(updates).forEach(([, value], i) => {
    const ps = parts(paths[i])
    const stored = toStored(value, paths[i])
    let node = state.root
    for (const k of ps.slice(0, -1)) {
      if (!isObj(node[k])) node[k] = {}
      node = node[k] as Record<string, unknown>
    }
    if (stored === null) delete node[ps[ps.length - 1]]
    else node[ps[ps.length - 1]] = stored
  })
  state.root = (toStored(state.root, '') as Record<string, unknown>) ?? {}
  state.writes.push(Object.fromEntries(paths.map((p, i) => [p, Object.values(updates)[i]])))
  notify()
}

// What the app imports from 'firebase/database'.
export const firebaseDatabase = {
  ref: (_db: unknown, path = '') => ({ path }),
  child: (r: { path: string }, p: string) => ({ path: `${r.path}/${p}` }),
  push: () => ({ key: `-Fake${String(++state.keyCount).padStart(8, '0')}` }),
  update: (r: { path: string }, updates: Record<string, unknown>) => {
    applyUpdate(r.path, updates)
    return Promise.resolve()
  },
  onValue: (r: { path: string }, cb: Listener['cb']) => {
    const l = { path: r.path, cb }
    state.listeners.push(l)
    const value = read(r.path)
    cb({ val: () => value })
    return () => {
      state.listeners = state.listeners.filter((x) => x !== l)
    }
  },
}

// Stand-ins for '@/firebase' and '@/lib/offline' (always connected).
export const firebaseMock = {
  database: {},
  NAMESPACE: NS,
  dataRef: (path = '') => ({ path: path ? `${NS}/${path}` : NS }),
}
export const offlineMock = {
  connected: ref(true),
  showingSavedFrom: ref(null),
  onReconnect: () => {},
  getSaved: () => Promise.resolve({ val: () => null, exists: () => false }),
  onValueSaved: () => () => {},
}
