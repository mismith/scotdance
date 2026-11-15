import { expect, type Page } from '@playwright/test'
import { dbGet, dbRemove, dbSet, dbUpdate, uid } from './emulator'
import type { SeededCompetition } from './seed'

// Helpers for the parent/dancer specs: a dancer you can follow (linked to a
// person record, as the aggregator would), and the sign-in sheet.

/** Mirror of normalizeName (functions/src/utility/normalize.ts). */
export const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')

export interface Person {
  id: string
  name: string
  firstName: string
  lastName: string
  /** Per-competition entry ids. */
  entries: string[]
  remove: () => Promise<void>
}

/**
 * Turn seeded entries into one followable person with a unique name: the
 * person record (/dancers/{id}), its index entry and each entry's
 * back-pointer, as the aggregator writes them.
 */
export async function makePerson(
  comp: SeededCompetition,
  entryIds: string[],
  firstName = 'Wren',
): Promise<Person> {
  // Let the aggregator finish with the seeded name first, or its late
  // back-pointer would land on top of ours.
  for (const eid of entryIds) {
    for (let i = 0; i < 40; i++) {
      if (await dbGet(`competitions:data/${comp.id}/dancers/${eid}/dancerId`)) break
      await new Promise((r) => setTimeout(r, 250))
    }
  }
  const lastName = `Testcase${Math.random().toString(36).slice(2, 7)}`
  const name = `${firstName} ${lastName}`
  const id = uid('person')
  const key = normalizeName(name)
  const entries = entryIds.map((eid) => comp.dancers.find((d) => d.id === eid)!)
  await dbSet(`dancers:index/${key}`, { id, name, appearanceCount: entries.length })
  await dbSet(`dancers/${id}`, {
    name,
    _identity: key,
    appearanceCount: entries.length,
    appearances: Object.fromEntries(
      entries.map((e) => [
        `${comp.id}:${e.id}`,
        { competitionId: comp.id, dancerId: e.id, firstName, lastName, number: Number(e.number) },
      ]),
    ),
  })
  for (const e of entries) {
    await dbUpdate(`competitions:data/${comp.id}/dancers/${e.id}`, { firstName, lastName, dancerId: id })
  }
  // The aggregator may still be finishing the seed's writes, and puts right a
  // back-pointer they leave stale a moment later: wait until ours has stuck,
  // or a Follow tapped meanwhile goes to the seeded name's person.
  for (const e of entries) {
    let steady = 0
    for (let i = 0; i < 100 && steady < 10; i++) {
      steady = (await dbGet(`competitions:data/${comp.id}/dancers/${e.id}/dancerId`)) === id ? steady + 1 : 0
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  return {
    id,
    name,
    firstName,
    lastName,
    entries: entryIds,
    remove: async () => {
      await dbRemove(`dancers/${id}`)
      await dbRemove(`dancers:index/${key}`)
    },
  }
}

/** Pretend to be the iOS app (lib/native reads window.Capacitor at import). */
export async function fakeNative(page: Page, platform: 'ios' | 'android' = 'ios') {
  await page.addInitScript((p) => {
    ;(window as unknown as { Capacitor: unknown }).Capacitor = { getPlatform: () => p, Plugins: {} }
  }, platform)
}

export const sheet = (page: Page) => page.locator('dialog[open]')

/**
 * Fill in the open sign-in sheet and submit. (In the open one: a sheet just
 * closed is still on the page, inert, while it slides away.)
 */
export async function submitPassword(page: Page, email: string, password = 'password') {
  await sheet(page).getByRole('textbox', { name: 'Email address' }).fill(email)
  const field = sheet(page).locator('input[name=password]')
  await field.fill(password)
  await field.press('Enter')
}

/** Sign in from an already-open sheet. */
export async function signInFromSheet(page: Page, email: string, password = 'password') {
  await submitPassword(page, email, password)
  await expect(sheet(page)).toHaveCount(0)
}

/** Open the Account page (straight after signing in, a reload can bounce to Home: retry). */
export async function openAccount(page: Page) {
  await expect(async () => {
    await page.goto('/profile')
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible({ timeout: 3000 })
  }).toPass({ timeout: 20_000 })
}

/** Exercise the extracted form against emulators without navigating to live Connect. */
export async function openAccountForm(page: Page) {
  await openAccount(page)
  await expect(page.getByRole('link', { name: 'Edit your ScotDance account →' })).toHaveAttribute(
    'href', 'https://connect.scotdance.app/?section=account',
  )
  await expect(page.getByRole('button', { name: 'Delete account', exact: true })).toHaveCount(0)
  await page.goto('/account.html')
  // Inject the parent message only in the test browser. Production origin/window
  // validation is unchanged and has separate protocol and live iframe coverage.
  await page.evaluate(async () => {
    const { auth } = await import(/* @vite-ignore */ '/src/firebase.ts')
    await auth.authStateReady()
    if (!auth.currentUser) throw new Error('Test account is not signed in')
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://connect.scotdance.app', source: window.parent,
      data: { channel: 'scotdance:account', type: 'init', uid: auth.currentUser.uid },
    }))
  })
  await expect(page.getByRole('textbox', { name: 'Your name', exact: true })).toBeVisible()
}

/** Sign out from the Account page. */
export async function signOut(page: Page) {
  await openAccount(page)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)
}
