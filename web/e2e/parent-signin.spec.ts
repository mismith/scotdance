import { expect, test, type Page } from '@playwright/test'
import { ensureUser, uid } from './support/emulator'
import { fakeNative, openAccount, sheet, submitPassword } from './support/parent'

// The sign-in sheet: email and password, the same on the web and in the apps.

const openFromHome = async (page: Page) => {
  await page.goto('/')
  await page.getByRole('main').getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(sheet(page)).toBeVisible()
}

test('opens on email and password, explains a wrong password kindly, and closes with Escape', async ({ page }) => {
  const email = `${uid('parent')}@example.test`
  await ensureUser(email)
  await openFromHome(page)
  const s = sheet(page)
  await expect(s.getByRole('heading', { name: 'Sign in to ScotDance.app' })).toBeVisible()
  await expect(s.getByText('Get an alert when placings are posted')).toBeVisible()
  await expect(s.getByRole('button', { name: /Apple|Google|link/ })).toHaveCount(0)

  await submitPassword(page, email, 'not-the-password')
  await expect(s.getByRole('alert')).toHaveText('That email and password don’t match. Check them, or choose “Forgot your password?”')

  await page.keyboard.press('Escape')
  await expect(sheet(page)).toHaveCount(0)
  // Opening it again starts over.
  await page.getByRole('main').getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(sheet(page).getByRole('heading', { name: 'Sign in to ScotDance.app' })).toBeVisible()
  await expect(sheet(page).getByRole('alert')).toHaveCount(0)

  await submitPassword(page, email)
  await expect(sheet(page)).toHaveCount(0)
  await openAccount(page)
  await expect(page.getByRole('main').getByText(email)).toBeVisible()
})

test('creates an account, with clear errors for a taken email and a short password', async ({ page }) => {
  const taken = `${uid('parent')}@example.test`
  await ensureUser(taken)
  await openFromHome(page)
  const s = sheet(page)
  await s.getByRole('button', { name: 'New here? Create an account' }).click()
  await expect(s.getByRole('heading', { name: 'Create an account' })).toBeVisible()
  await expect(s.locator('input[name=password]')).toHaveAttribute('autocomplete', 'new-password')

  await submitPassword(page, taken, 'password1')
  await expect(s.getByRole('alert')).toHaveText('That email already has an account. Choose “Back to sign in” to use its password.')

  const fresh = `${uid('parent')}@example.test`
  await submitPassword(page, fresh, '123')
  await expect(s.getByRole('alert')).toHaveText('Choose a password with at least 6 characters.')

  await submitPassword(page, fresh, 'password1')
  // Signed in: the sheet goes, and a brand-new account is asked how it uses the app.
  await expect(page.getByRole('heading', { name: 'How do you use ScotDance.app?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0)
})

test('sends a password reset link', async ({ page }) => {
  const email = `${uid('parent')}@example.test`
  await ensureUser(email)
  await openFromHome(page)
  const s = sheet(page)
  await s.getByRole('textbox', { name: 'Email address' }).fill(email)
  await s.getByRole('button', { name: 'Forgot your password?' }).click()
  await expect(s.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
  // The address carries over from the step before.
  await expect(s.getByRole('textbox', { name: 'Email address' })).toHaveValue(email)
  await s.getByRole('button', { name: 'Send reset link' }).click()
  await expect(s.getByRole('status')).toHaveText(`A reset link is on its way to ${email}.`)
  await s.getByRole('button', { name: 'Back to sign in' }).click()
  await expect(s.locator('input[name=password]')).toBeVisible()
})

test('in the native app, signs in the same way', async ({ page }) => {
  await fakeNative(page)
  const email = `${uid('parent')}@example.test`
  await ensureUser(email)
  await openFromHome(page)
  const s = sheet(page)
  await expect(s.getByRole('heading', { name: 'Sign in to ScotDance.app' })).toBeVisible()
  await submitPassword(page, email)
  await expect(sheet(page)).toHaveCount(0)
  await openAccount(page)
  await expect(page.getByRole('main').getByText(email)).toBeVisible()
})

test('a beta account without a password is offered a link to set one', async ({ page }) => {
  await page.goto('/')
  // Sign in as a Google account (made in the v4 beta) through the app's own
  // Firebase instance; the emulator takes an unsigned token.
  const src = await (await page.request.get('/src/firebase.ts')).text()
  const authDeps = src.match(/"(\/node_modules\/\.vite\/deps\/firebase_auth\.js[^"]*)"/)![1]
  const email = `${uid('google')}@example.test`
  await page.evaluate(
    async ({ authDeps, email }) => {
      const { auth } = await import(/* @vite-ignore */ '/src/firebase.ts')
      const { GoogleAuthProvider, signInWithCredential } = await import(/* @vite-ignore */ authDeps)
      const token = JSON.stringify({ sub: email, email, email_verified: true })
      await signInWithCredential(auth, GoogleAuthProvider.credential(token))
    },
    { authDeps, email },
  )
  await openAccount(page)
  await expect(page.getByRole('button', { name: 'Password Change' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Delete account' }).click()
  const s = sheet(page)
  await expect(s.getByText('your account needs a password', { exact: false })).toBeVisible()
  await expect(s.getByText('Your current password')).toHaveCount(0)
  await s.getByRole('button', { name: 'Email me a link' }).click()
  await expect(s.getByRole('status')).toHaveText(`A link is on its way to ${email}.`)
  await page.keyboard.press('Escape')
})
