import { ref } from 'vue'
import { get, onValue, ref as dbRef, type DataSnapshot, type Query } from 'firebase/database'
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
// back; one-off reads are refetched on the next visit (see onReconnect).

const GRACE_MS = 3000
const KEEP_MS = 60 * 24 * 60 * 60 * 1000 // saved copies older than 60 days are dropped

interface Saved {
  value: unknown
  at: number
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

function request<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openStore().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction('reads', mode).objectStore('reads'))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

const readSaved = (key: string) => request<Saved | undefined>('readonly', (s) => s.get(key)).catch(() => undefined)
const writeSaved = (key: string, value: unknown) =>
  void request('readwrite', (s) => s.put({ value, at: Date.now() } satisfies Saved, key)).catch(() => {})

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
export const clearSaved = () => request('readwrite', (s) => s.clear()).catch(() => undefined)

// --- Connection state

/** Firebase is connected right now. */
export const connected = ref(false)
/** When the oldest saved copy on screen was saved, while offline; else null. */
export const showingSavedFrom = ref<number | null>(null)

let disconnectedAt = Date.now()
const reconnectHooks: Array<() => void> = []

/** Run `fn` when the connection comes back after saved copies were used. */
export function onReconnect(fn: () => void) {
  reconnectHooks.push(fn)
}

onValue(dbRef(database, '.info/connected'), (snap) => {
  const now = snap.val() === true
  if (now === connected.value) return
  connected.value = now
  if (!now) {
    disconnectedAt = Date.now()
    return
  }
  if (showingSavedFrom.value != null) {
    showingSavedFrom.value = null
    for (const fn of reconnectHooks) fn()
  }
})

// Clearly offline (the phone says so, or no connection for a while): don't
// make people wait for the network before showing what's saved.
const clearlyOffline = () =>
  !navigator.onLine || (!connected.value && Date.now() - disconnectedAt > GRACE_MS)

function usingSaved(saved: Saved) {
  const from = showingSavedFrom.value
  showingSavedFrom.value = from == null ? saved.at : Math.min(from, saved.at)
}

const keyFor = (q: Query) => q.toString()

type Snapshot = Pick<DataSnapshot, 'val' | 'exists'>
const snapshot = (value: unknown): Snapshot => ({ val: () => value, exists: () => value != null })

/**
 * `get()`, but falls back to the copy saved on the device when offline.
 * Pass `key` when the query's own location isn't a stable name for it.
 */
export function getSaved(q: Query, key = keyFor(q)): Promise<Snapshot> {
  let answered = false
  const network = get(q).then((snap) => {
    answered = true
    writeSaved(key, snap.val())
    return snapshot(snap.val())
  })
  const fallback = new Promise<Snapshot>((resolve) => {
    const tryDisk = async () => {
      if (answered || connected.value) return
      const saved = await readSaved(key)
      if (!saved || answered || connected.value) return // nothing saved: wait for the network
      usingSaved(saved)
      resolve(snapshot(saved.value))
    }
    if (clearlyOffline()) void tryDisk()
    else setTimeout(() => void tryDisk(), GRACE_MS)
  })
  return Promise.race([network, fallback])
}

/**
 * `onValue()`, but starts with the copy saved on the device when offline,
 * then carries on with live values once connected.
 */
export function onValueSaved(q: Query, cb: (snap: Snapshot) => void, onError?: (e: Error) => void): () => void {
  const key = keyFor(q)
  let live = false
  let stopped = false
  const off = onValue(
    q,
    (snap) => {
      live = true
      writeSaved(key, snap.val())
      cb(snapshot(snap.val()))
    },
    onError,
  )
  const tryDisk = async () => {
    if (live || stopped || connected.value) return
    const saved = await readSaved(key)
    if (!saved || live || stopped || connected.value) return
    usingSaved(saved)
    cb(snapshot(saved.value))
  }
  if (clearlyOffline()) void tryDisk()
  else setTimeout(() => void tryDisk(), GRACE_MS)
  return () => {
    stopped = true
    off()
  }
}
