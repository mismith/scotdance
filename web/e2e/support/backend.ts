import { NS } from './emulator'

// For the backend specs: database requests as a real signed-in user (so the
// rules apply), and callable functions. The emulator treats any
// `Authorization: Bearer` as an admin, so a user's ID token goes in `?auth=`.

const OFFSET = Number(process.env.E2E_EMULATOR_PORT_OFFSET ?? 0)
const DB = `http://127.0.0.1:${9009 + OFFSET}`
const AUTH = `http://127.0.0.1:${9099 + OFFSET}`
const FUNCTIONS = `http://127.0.0.1:${5001 + OFFSET}/firebase-scotdance/us-central1`

export interface Account {
  uid: string
  token: string
}

/** Sign in (making the account first if need be). */
export async function account(email: string, password = 'password'): Promise<Account> {
  const call = (op: string) =>
    fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:${op}?key=fake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }).then((r) => r.json())
  let r = await call('signInWithPassword')
  if (!r.localId) r = await call('signUp')
  if (!r.localId) throw new Error(`Couldn't sign in ${email}: ${JSON.stringify(r)}`)
  return { uid: r.localId, token: r.idToken }
}

export interface Answer {
  ok: boolean
  status: number
  data: unknown
}

/** A database request as `who` (null: signed out). Paths are relative to the data namespace; '' is its root. */
export async function as(who: Account | null, method: 'GET' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<Answer> {
  const auth = who ? `&auth=${who.token}` : ''
  const res = await fetch(`${DB}/${NS}${path ? `/${path}` : ''}.json?ns=scotdance${auth}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null }
}

/** Call a callable function as `who` (null: signed out). */
export async function callFunction<T = unknown>(
  name: string,
  data: unknown,
  who: Account | null,
): Promise<{ status: number; result?: T; error?: { status?: string; message?: string } }> {
  const res = await fetch(`${FUNCTIONS}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${who.token}` } : {}) },
    body: JSON.stringify({ data: data ?? null }),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, ...json }
}

/** Same as `normalizeName` in functions/src/utility/normalize.ts: how aggregates are indexed. */
export const indexKey = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
