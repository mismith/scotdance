import { httpsCallable } from 'firebase/functions'
import { get, limitToLast, orderByChild, query } from 'firebase/database'
import { dataRef, functions, useEmulators } from '@/firebase'
import { formatMonthDay, formatShortDate, isSameDay } from '@/lib/format'

// The AI assistants (Claude, ChatGPT) a person has connected to their account (ADR 0018): the page where they allow
// one, and Account's list of what is connected. `users:connections/{uid}/{id}` holds who, when and last used; the
// functions do the rest.

/**
 * The address people give their assistant. One value: change it to move the door (to https://scotdance.app at
 * launch). Against the emulators it is the dev server, which proxies to the local `mcp` function.
 */
const ORIGIN = 'https://next.scotdance.app'
export const assistantAddress = () => `${useEmulators ? location.origin : ORIGIN}/mcp`

/** An assistant that is connected */
export interface Connection {
  id: string
  client?: { id?: string; name?: string }
  createdAt?: number
  lastUsedAt?: number
}

/** Their connections, newest first, from the `users:connections/{uid}` value. */
export function connectionsFrom(value: unknown): Connection[] {
  const all = (value && typeof value === 'object' ? value : {}) as Record<string, Omit<Connection, 'id'>>
  return Object.entries(all)
    .map(([id, c]) => ({ ...c, id }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

/** "today", "12 Oct", or "12 Oct 2025" in another year. */
export function connectionDate(ms: number | undefined): string {
  if (!ms) return ''
  if (isSameDay(ms)) return 'today'
  return new Date(ms).getFullYear() === new Date().getFullYear() ? formatMonthDay(ms) : formatShortDate(ms)
}

/** What an assistant's request is for (look it up before showing the approval page). */
export interface AssistantRequest {
  /** Who is asking. `host` is where it asks from, so a fake can be spotted. */
  client: { name: string; host: string }
  /** The app knows this assistant by its address (Claude, ChatGPT). If not, its name is only what it calls itself. */
  known: boolean
}

const isNotFound = (e: unknown) => (e as { code?: string })?.code === 'functions/not-found'

/** The request an assistant filed, or null once it has run out (they last 10 minutes). */
export async function lookUpRequest(request: string): Promise<AssistantRequest | null> {
  try {
    const { data } = await httpsCallable<{ request: string }, AssistantRequest>(functions, 'connectionRequest')({ request })
    return data
  } catch (e) {
    // An id that was never a request (a mangled link) is as gone as one that ran out
    if (isNotFound(e) || (e as { code?: string })?.code === 'functions/invalid-argument') return null
    throw e
  }
}

/** Allow it (or say no) and get the address to send the browser back to; null if the request ran out meanwhile. */
export async function answerRequest(request: string, deny?: true): Promise<string | null> {
  try {
    const { data } = await httpsCallable<{ request: string; deny?: true }, { redirect: string }>(functions, 'approveConnection')(
      deny ? { request, deny } : { request },
    )
    return data.redirect
  } catch (e) {
    if (isNotFound(e)) return null
    throw e
  }
}

/** End a connection: the assistant stops working straight away. */
export async function disconnect(connection: string) {
  await httpsCallable<{ connection: string }, unknown>(functions, 'endConnection')({ connection })
}

/** Every connection, when deleting an account: the account goes either way. */
export async function disconnectEveryAssistant() {
  await httpsCallable(functions, 'endConnection')({}).catch(() => {})
}

/**
 * One change an assistant made, from the person's index (`users:changes/{uid}/{connection}/{change}`, written in the same
 * update as the change; functions/src/mcp/changes.ts). `scope` says where the full entry lives, so Undo could be added here.
 */
export interface Change {
  id: string
  at: number
  scope: 'competitions' | 'organisations'
  scopeId: string
  summary: string
  /** It is an undo of another change */
  undoOf?: string
  /** When it was undone */
  undone?: number
}

/** How many changes the sheet shows at first, and more each time */
export const CHANGES_PAGE = 20

/** The index's value as a list, newest first; anything that isn't a change is skipped. */
export function changesFrom(value: unknown): Change[] {
  const all = (value && typeof value === 'object' ? value : {}) as Record<string, Partial<Omit<Change, 'id'>>>
  return Object.entries(all)
    .filter(([, c]) => c && typeof c.at === 'number' && typeof c.summary === 'string' && (c.scope === 'competitions' || c.scope === 'organisations') && typeof c.scopeId === 'string')
    .map(([id, c]) => ({ ...(c as Omit<Change, 'id'>), id }))
    .sort((a, b) => b.at - a.at)
}

/** The latest `limit` changes one connection made. */
export async function loadChanges(uid: string, connection: string, limit: number): Promise<Change[]> {
  const snap = await get(query(dataRef(`users:changes/${uid}/${connection}`), orderByChild('at'), limitToLast(limit)))
  return changesFrom(snap.val())
}

/** What each competition or organisation in the changes is called (by `${scope}/${id}`); gone ones are left out. */
export async function namesOf(changes: Change[]): Promise<Record<string, string>> {
  const keys = [...new Set(changes.map((c) => `${c.scope}/${c.scopeId}`))]
  const found = await Promise.all(
    keys.map(async (key) => {
      try {
        const name = (await get(dataRef(`${key}/name`))).val()
        return [key, typeof name === 'string' ? name : ''] as const
      } catch {
        return [key, ''] as const
      }
    }),
  )
  return Object.fromEntries(found.filter(([, name]) => name))
}
