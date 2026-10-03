import { expect as baseExpect, test, type Page } from '@playwright/test'
import { ensureUser, signIn, uid } from './support/emulator'
import { DANCER, JUDGE, VENUE, nameOf } from './support/legacy'

// The dev server is shared and busy during a full run: give page loads time.
const expect = baseExpect.configure({ timeout: 15_000 })

// People and venue pages, from the More menu's lists. Uses the emulator's
// legacy judges, venues and dancers (read only), by id.

let judge = ''
let dancer = ''
test.beforeAll(async () => {
  judge = await nameOf('judges', JUDGE)
  dancer = await nameOf('dancers', DANCER)
})

const findBox = (page: Page) => page.getByRole('searchbox')

test('the Judges list filters by name and opens a judge', { tag: '@seed' }, async ({ page }) => {
  await page.goto('/judges')
  await expect(page).toHaveTitle('Judges • ScotDance.app')
  await expect(page.getByRole('heading', { level: 1, name: 'Judges' })).toBeVisible()
  await findBox(page).fill(judge.split(' ')[0].toLowerCase())
  await expect(page.getByRole('heading', { level: 2, name: /^Matches/ })).toBeVisible()
  await findBox(page).fill('zzzz nobody')
  await expect(page.getByText('No one matches “zzzz nobody”.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear' }).click()
  // Rows are links (cmd-click opens a tab).
  await page.getByRole('link', { name: new RegExp(`^${judge}`) }).first().click()
  await expect(page).toHaveURL(new RegExp(`/judges/${JUDGE}/info$`))
  await expect(page.getByRole('heading', { level: 1, name: judge })).toBeVisible()
  await expect(page).toHaveTitle(`${judge} • ScotDance.app`)
  // Back says where it goes, and goes there.
  await page.getByRole('button', { name: 'Back to Judges' }).click()
  await expect(page).toHaveURL(/\/judges$/)
})

test('a judge page lists where they’ve judged, and each opens', { tag: '@seed' }, async ({ page }) => {
  await page.goto(`/judges/${JUDGE}/info`)
  await expect(page.getByRole('main').getByText(/^Judge/).first()).toBeVisible()
  const first = page.getByRole('link', { name: /Premier Pre-Championship/ })
  await expect(first).toBeVisible()
  await first.click()
  await expect(page).toHaveURL(/\/competitions\/-L9Sck5Kb-4D4wYsQWtZ\/info$/)
})

test('a venue page has directions, a map and its competitions', { tag: '@seed' }, async ({ page }) => {
  await page.goto(`/venues/${VENUE}/info`)
  await expect(page.getByRole('heading', { level: 1, name: 'Calgary Life Church' })).toBeVisible()
  const directions = page.getByRole('link', { name: 'Directions' })
  await expect(directions).toHaveAttribute('href', /maps\.google\.com\/\?q=Calgary%20Life%20Church/)
  await expect(directions).toHaveAttribute('target', '_blank')
  await expect(page.getByRole('link', { name: /Evelyn Nicholsen Leinweber/ })).toBeVisible()
})

test('a dancer page shows every competition with their number there', { tag: '@seed' }, async ({ page }) => {
  await page.goto(`/dancers/${DANCER}/info`)
  await expect(page.getByRole('heading', { level: 1, name: dancer })).toBeVisible()
  await expect(page.getByText(/5 competitions since 2018/)).toBeVisible()
  const nationals = page.getByRole('link', { name: /Nationals/ })
  await expect(nationals).toContainText('#1088')
  await nationals.click()
  await expect(page).toHaveURL(/\/competitions\/-L9Sc9TQWQclq_7oA3ij\/dancers\/[^/]+$/)
})

for (const [path, title] of [
  ['/judges/no-such-judge/info', 'Judge not found'],
  ['/pipers/no-such-piper/info', 'Piper not found'],
  ['/venues/no-such-venue/info', 'Venue not found'],
  ['/dancers/no-such-dancer/info', 'Dancer not found'],
  ['/judges/bad.id[x]/info', 'Judge not found'],
] as const) {
  test(`${path} says it isn’t found`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByText(title)).toBeVisible()
    await expect(page).toHaveTitle('Not found • ScotDance.app')
    await expect(page.getByRole('button', { name: /^Back to/ })).toBeVisible()
  })
}

test('following a judge signed out asks you to sign in first', { tag: '@seed' }, async ({ page }) => {
  await page.goto(`/judges/${JUDGE}/info`)
  await page.getByRole('button', { name: 'Follow', exact: true }).click()
  await expect(page.locator('dialog[open]')).toBeVisible()
  await expect(page.locator('dialog[open]').getByRole('heading', { name: `Sign in to follow ${judge}` })).toBeVisible()
})

test('following a judge puts them under Following on Judges, and unfollowing takes them off', { tag: '@seed' }, async ({ page }) => {
  const email = `${uid('follow')}@example.test`
  await ensureUser(email)
  await signIn(page, email)
  await page.goto(`/judges/${JUDGE}/info`)
  const follow = page.getByRole('button', { name: 'Follow', exact: true })
  await follow.click()
  await expect(page.getByRole('button', { name: 'Following', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await page.goto('/judges')
  const following = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'Following' }) })
  await expect(following.getByRole('link', { name: new RegExp(`^${judge}`) })).toBeVisible()
  await following.getByRole('button', { name: `Following ${judge}` }).click()
  await expect(following).toBeHidden()
})
