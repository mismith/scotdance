import { expect, type Page, type TestInfo } from '@playwright/test'
import { dbGet, dbSet, ensureUser, grantCompetition, signIn, uid } from './emulator'
import { isoDay } from './seed'
import { retry } from './retry'

// Helpers for the Manage data-editing specs (manage-data-*.spec.ts).

/** A competition with details but no data yet (as one looks before its import). Remove with removeCompetition. */
export async function seedEmptyCompetition() {
  const id = uid('comp')
  const name = `E2E Empty Games ${id.slice(-5)}`
  await dbSet(`competitions/${id}`, { name, date: isoDay(14), venue: 'Spruce Meadows', location: 'Calgary, AB', published: true, listed: true })
  await dbSet(`competitions:published/${id}`, true)
  return { id, name }
}

/** Sign in as a new organiser of one competition (not a system admin: the rules guard their writes). */
export async function signInOrganiser(page: Page, competitionId: string) {
  const email = `${uid('org')}@example.test`
  const id = await ensureUser(email)
  await retry(() => grantCompetition(id, competitionId))
  await signIn(page, email)
  return id
}

export const isPhone = (info: TestInfo) => info.project.name === 'phone'

/** Uncaught errors and console errors from the app (ignoring third-party noise). */
export function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/crisp|favicon|Failed to load resource|maps\.googleapis/i.test(m.text())) errors.push(`console: ${m.text()}`)
  })
  return errors
}

/** Wait for a value in the database (autosave is debounced). */
export async function expectDb(path: string, expected: unknown, timeout = 5000) {
  await expect.poll(() => dbGet(path), { timeout, message: `database at ${path}` }).toEqual(expected)
}

/** The open confirmation dialog. */
export const confirmDialog = (page: Page) => page.locator('dialog[open]')

/** An item in the bar's ⋯ menu (Undo, Redo, the public page): opens the menu first. */
export async function barMenuItem(page: Page, name: string | RegExp) {
  await page.getByRole('button', { name: 'Undo, redo and more' }).click()
  return page.getByRole('dialog', { name: 'Undo, redo and more' }).getByRole('button', { name, exact: typeof name === 'string' })
}

/** The Undo button on the latest toast. */
export const toastUndo = (page: Page) => page.getByRole('status').getByRole('button', { name: 'Undo', exact: true }).last()

/** Go somewhere in the app without reloading it (a reload would start a fresh Undo history). */
export async function navigate(page: Page, path: string) {
  await page.evaluate(async (to) => {
    const app = (document.querySelector('#app') as unknown as { __vue_app__: { config: { globalProperties: { $router: { push: (to: string) => Promise<unknown> } } } } }).__vue_app__
    await app.config.globalProperties.$router.push(to)
  }, path)
}
