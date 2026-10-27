import { ref, watch } from 'vue'
import {
  get,
  onValue,
  ref as dbRef,
  type DataSnapshot,
  type Query,
} from 'firebase/database'
import { database } from '@/firebase'

// Keeps a copy of what's been read on the device, so the app still opens
// with the last-known competitions, schedules, dancers and results when
// there's no signal (competition halls often have none). Firebase's web SDK
// only keeps data in memory, and a read with no connection simply waits, so
// without this the app would sit on loading placeholders.
//
// Reads go to the network first. If the phone is offline, or Firebase still
// isn't connected after a few seconds, the saved copy is used instead (a
// connection that's up but slow just gets waited for). Every fresh
// answer replaces the saved copy. Live listeners carry on when signal comes
// back; mounted pages can refetch one-off reads through onReconnect.

const GRACE_MS = 3000
const KEEP_MS = 60 * 24 * 60 * 60 * 1000 // saved copies older than 60 days are dropped

interface Saved {
  value: unknown
  at: number
  /** The server's last-changed stamp it was read at, when there is one (see getSavedAt). */
  version?: number
}

// --- IndexedDB, as a tiny key/value store. Every failure (private mode,
// quota, blocked storage) just means "nothing saved".

let dbPromise: Promise<IDBDatabase> | null = null
function openStore(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('scotdance-offline', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('reads')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function request<T>(
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openStore().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction('reads', mode).objectStore('reads'))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

const readSaved = (key: string) =>
  request<Saved | undefined>('readonly', (s) => s.get(key)).catch(() => undefined)
const writeSaved = (key: string, value: unknown, version?: number) =>
  void request('readwrite', (s) =>
    s.put({ value, at: Date.now(), version } satisfies Saved, key),
  ).catch(() => {})

// Tidy up old copies once per launch.
void openStore()
  .then((db) => {
    const req = db.transaction('reads', 'readwrite').objectStore('reads').openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      if (Date.now() - ((cursor.value as Saved).at ?? 0) > KEEP_MS) cursor.delete()
      cursor.continue()
    }
  })
  .catch(() => {})

/** Forget every saved copy (Settings › Clear history). */
export const clearSaved = () =>
  request('readwrite', (s) => s.clear()).catch(() => undefined)

// --- Connection state

/** Firebase is connected right now. */
export const connected = ref(false)
/** Disconnected beyond the brief startup/reconnect grace period. */
export const offline = ref(false)
/** When the oldest saved copy on screen was saved, while offline; else null. */
export const showingSavedFrom = ref<number | null>(null)

export class OfflineUnavailableError extends Error {
  constructor() {
    super(
      'This page isn’t available offline yet. It will try again when you’re connected.',
    )
    this.name = 'OfflineUnavailableError'
  }
}

let hadConnection = false
let offlineTimer = setTimeout(() => (offline.value = !connected.value), GRACE_MS)
const reconnectHooks = new Set<() => void>()

/** Run after a connection returns, including a first connection after an offline start. */
export function onReconnect(fn: () => void): () => void {
  reconnectHooks.add(fn)
  return () => {
    reconnectHooks.delete(fn)
  }
}

onValue(dbRef(database, '.info/connected'), (snap) => {
  const now = snap.val() === true
  if (now === connected.value) return
  const recovering = hadConnection || offline.value
  connected.value = now
  clearTimeout(offlineTimer)
  if (!now) {
    offlineTimer = setTimeout(() => (offline.value = true), GRACE_MS)
    return
  }
  hadConnection = true
  offline.value = false
  showingSavedFrom.value = null
  if (recovering) for (const fn of reconnectHooks) fn()
})

// Watch for later connection loss too: a read can begin online and still
// be waiting when the signal goes. Callers stop watching once settled.
function whenOffline(fn: () => void) {
  return watch(
    offline,
    (value) => {
      if (value) fn()
    },
    { immediate: true, flush: 'sync' },
  )
}

function usingSaved(saved: Saved) {
  const from = showingSavedFrom.value
  showingSavedFrom.value = from == null ? saved.at : Math.min(from, saved.at)
}

const keyFor = (q: Query) => q.toString()

type Snapshot = Pick<DataSnapshot, 'val' | 'exists'>
const snapshot = (value: unknown): Snapshot => ({
  val: () => value,
  exists: () => value != null,
})

/**
 * `get()`, but falls back to the copy saved on the device when offline.
 * Pass `key` when the query's own location isn't a stable name for it.
 */
export function getSaved(q: Query, key = keyFor(q), version?: number): Promise<Snapshot> {
  let answered = false
  const network = get(q).then((snap) => {
    answered = true
    writeSaved(key, snap.val(), version)
    return snapshot(snap.val())
  })
  let stop = () => {}
  const fallback = new Promise<Snapshot>((resolve, reject) => {
    stop = whenOffline(() => {
      void readSaved(key).then((saved) => {
        if (answered || connected.value) return
        if (!saved) return reject(new OfflineUnavailableError())
        usingSaved(saved)
        resolve(snapshot(saved.value))
      })
    })
  })
  return Promise.race([network, fallback]).finally(() => stop())
}

/**
 * `getSaved()` for something the server stamps with when it last changed:
 * a copy saved on the device at this same `version` is still current, so
 * it's used without downloading anything.
 */
export async function getSavedAt(
  q: Query,
  version: number | null,
  key = keyFor(q),
): Promise<Snapshot> {
  if (version != null) {
    const saved = await readSaved(key)
    if (saved?.version === version) return snapshot(saved.value)
  }
  return getSaved(q, key, version ?? undefined)
}

/**
 * A last-changed stamp (or a set of them), from the network. Null when it
 * can't be read right now (offline, or nothing stamped yet), so the caller
 * reads as usual.
 */
export function getStamp<T>(q: Query): Promise<T | null> {
  const network = get(q).then(
    (snap) => (snap.val() as T | null) ?? null,
    () => null,
  )
  let stop = () => {}
  const fallback = new Promise<null>((resolve) => {
    stop = whenOffline(() => resolve(null))
  })
  return Promise.race([network, fallback]).finally(() => stop())
}

/**
 * `onValue()`, but starts with the copy saved on the device when offline,
 * then carries on with live values once connected.
 */
/** What's saved on the device for `q`, without waiting for the network (null if nothing). */
export const peekSaved = async (q: Query): Promise<unknown> =>
  (await readSaved(keyFor(q)))?.value ?? null

export function onValueSaved(
  q: Query,
  cb: (snap: Snapshot) => void,
  onError?: (e: Error) => void,
  key = keyFor(q),
): () => void {
  let live = false
  let stopped = false
  const off = onValue(
    q,
    (snap) => {
      live = true
      writeSaved(key, snap.val())
      cb(snapshot(snap.val()))
    },
    (error) => {
      stopped = true
      onError?.(error)
    },
  )
  const stopOffline = whenOffline(() => {
    if (live || stopped) return
    void readSaved(key).then((saved) => {
      if (live || stopped || connected.value) return
      if (!saved) return onError?.(new OfflineUnavailableError())
      usingSaved(saved)
      cb(snapshot(saved.value))
    })
  })
  return () => {
    stopped = true
    stopOffline()
    off()
  }
}
