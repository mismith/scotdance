import { computed, reactive } from 'vue'
import { push, ref as dbRef, update } from 'firebase/database'
import { database } from '@/firebase'
import { connected } from '@/lib/offline'

// Every admin change goes through `write`. Changes need a connection: there
// is deliberately no offline queue for admin edits (reconciling edits made
// offline causes worse problems than it solves). While offline, editing
// controls are disabled and `write` refuses with a clear message.

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

export class OfflineError extends Error {
  constructor() {
    super('You’re offline. Changes can’t be saved until you’re back online.')
  }
}

export const saveState = reactive({
  pending: 0,
  lastSavedAt: null as number | null,
  error: null as string | null,
})

/** Editing is possible right now (connected to the database). */
export const canEdit = computed(() => connected.value)

export function friendlyError(e: unknown): string {
  if (e instanceof OfflineError) return e.message
  const raw = e instanceof Error ? e.message : String(e)
  if (/permission.denied/i.test(raw)) return 'You don’t have permission to change this.'
  return 'That change didn’t save. Check your connection and try again.'
}

/** A new database key, made on the device (no network needed). */
export function newKey(): string {
  return push(dbRef(database, NAMESPACE)).key as string
}

// RTDB rejects `undefined`; an empty string means "clear this field".
const clean = (value: unknown) => (value === undefined || value === '' ? null : value)

/**
 * Apply a multi-path update, with paths relative to the data namespace
 * (e.g. `competitions:data/{id}/dancers/{dancerId}/firstName`). All paths in
 * one call save together or not at all.
 */
export async function write(updates: Record<string, unknown>): Promise<void> {
  if (!connected.value) {
    const err = new OfflineError()
    saveState.error = err.message
    throw err
  }
  const prefixed: Record<string, unknown> = {}
  for (const [path, value] of Object.entries(updates)) prefixed[`${NAMESPACE}/${path}`] = clean(value)
  if (!Object.keys(prefixed).length) return
  saveState.pending += 1
  saveState.error = null
  try {
    await update(dbRef(database), prefixed)
    saveState.lastSavedAt = Date.now()
  } catch (e) {
    console.warn('[admin] save failed', e, Object.keys(updates))
    saveState.error = friendlyError(e)
    throw e
  } finally {
    saveState.pending -= 1
  }
}
