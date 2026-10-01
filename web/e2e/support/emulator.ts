import type { Page } from '@playwright/test'

// Talks to the local Firebase emulators only. E2E_EMULATOR_PORT_OFFSET matches
// VITE_EMULATOR_PORT_OFFSET when a second emulator stack runs on shifted ports.
const OFFSET = Number(process.env.E2E_EMULATOR_PORT_OFFSET ?? 0)
const DB = `http://127.0.0.1:${9009 + OFFSET}`
const AUTH = `http://127.0.0.1:${9099 + OFFSET}`
export const NS = 'development'

async function db(method: string, path: string, body?: unknown) {
  const res = await fetch(`${DB}/${NS}/${path}.json?ns=scotdance`, {
    method,
    // The emulator treats "owner" as an admin that bypasses the rules.
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

export const dbGet = <T = unknown>(path: string): Promise<T> => db('GET', path)
export const dbSet = (path: string, value: unknown) => db('PUT', path, value)
export const dbUpdate = (path: string, value: Record<string, unknown>) => db('PATCH', path, value)
export const dbRemove = (path: string) => db('DELETE', path)

/** Create an email/password account (or reuse it) and return its uid. */
export async function ensureUser(email: string, password = 'password'): Promise<string> {
  const call = (op: string) =>
    fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:${op}?key=fake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }).then((r) => r.json())
  const created = await call('signUp')
  if (created.localId) return created.localId
  const signedIn = await call('signInWithPassword')
  if (!signedIn.localId) throw new Error(`Couldn't create or sign in ${email}: ${JSON.stringify(signedIn)}`)
  return signedIn.localId
}

/** Give a user organiser rights on a competition (as the invite flow would). */
export async function grantCompetition(uid: string, competitionId: string) {
  await dbSet(`users:permissions/${uid}/competitions/${competitionId}`, true)
  await dbSet(`competitions:permissions/${competitionId}/users/${uid}`, true)
}

export async function grantSystemAdmin(uid: string) {
  await dbSet(`users:permissions/${uid}/admin`, true)
}

/** Sign in through the app's own sheet (email + password). */
export async function signIn(page: Page, email: string, password = 'password') {
  await page.goto('/profile')
  // /profile needs an account: the app bounces to Home and opens the sheet.
  // (If the sheet didn't open, use Home's own Sign in button: this helper is
  // for signing in, not for testing that redirect.)
  const field = page.locator('dialog[open] input[name=password]')
  const opened = await field.waitFor({ timeout: 5000 }).then(() => true, () => false)
  if (!opened) await page.getByRole('button', { name: 'Sign in', exact: true }).first().click()
  await page.locator('dialog[open]').getByRole('textbox', { name: 'Email address' }).fill(email)
  await field.fill(password)
  await field.press('Enter')
  // Closed sheets stay in the DOM (inert, transparent), so wait on [open].
  await page.locator('dialog[open]').waitFor({ state: 'detached' })
}

/** A unique id per test run, so parallel tests never share data. */
export const uid = (prefix = 'e2e') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
