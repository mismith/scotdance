import { expect as baseExpect, test, type Page } from '@playwright/test'
import { dbRemove, dbSet, ensureUser, signIn, uid } from './support/emulator'
import { retry } from './support/retry'
import { isoDay, removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'

// The dev server is shared and busy during a full run: give page loads time.
const expect = baseExpect.configure({ timeout: 20_000 })

// Search by number looks in one competition, chosen from cards: the likeliest
// first, the rest in a sheet that filters as you type. Everything here is
// dated around a day years ago (each project its own), and the app is told
// that's today (?now=), so no other test's competitions get in the way.

test.describe.configure({ mode: 'serial' })
test.use({ timezoneId: 'America/Edmonton' })

const tag = uid('sn').slice(-5)
let anchor = 0 // days from today to the pretend today
let today: SeededCompetition // two days, starting on the pretend today, with dancers
const listings: Record<'next' | 'followed' | 'far', { id: string; name: string }> = {
  next: { id: `sn-next-${tag}`, name: `Number Next Games ${tag}` },
  followed: { id: `sn-followed-${tag}`, name: `Number Followed Games ${tag}` },
  far: { id: `sn-far-${tag}`, name: `Faraway Fling ${tag}` },
}
const fillers = [-3, 4, -8, 12, -15].map((days, i) => ({ id: `sn-filler${i}-${tag}`, days }))

/** Just the listing (no dancers): enough to be a choice, and light on triggers. */
async function seedListing(id: string, name: string, days: number) {
  await dbSet(`competitions/${id}`, {
    name,
    date: isoDay(anchor + days),
    location: 'Halifax, NS',
    country: 'CA',
    published: true,
    listed: true,
  })
  await dbSet(`competitions:published/${id}`, true)
}

test.beforeAll(async ({}, info) => {
  test.setTimeout(120_000)
  anchor = -(info.project.name === 'phone' ? 4400 : 3650) - Math.floor(Math.random() * 300)
  today = await retry(() =>
    seedCompetition({ id: `sn-today-${tag}`, name: `Number Today Games ${tag}`, startOffset: anchor, dancersPerGroup: 1, resultsForGroups: 0 }),
  )
  await retry(() => seedListing(listings.next.id, listings.next.name, 2))
  await retry(() => seedListing(listings.followed.id, listings.followed.name, 20))
  await retry(() => seedListing(listings.far.id, listings.far.name, 25))
  for (const f of fillers) await retry(() => seedListing(f.id, `Number Filler ${f.days} ${tag}`, f.days))
})

test.afterAll(async () => {
  test.setTimeout(120_000)
  for (const id of [`sn-today-${tag}`, ...Object.values(listings).map((l) => l.id), ...fillers.map((f) => f.id)]) {
    await retry(() => removeCompetition(id))
  }
})

const open = (page: Page, query = '', days = 0) => page.goto(`/search?by=number&now=${isoDay(anchor + days)}${query}`)
const row = (page: Page) => page.getByRole('radiogroup', { name: 'Looking in' })
const chosen = (page: Page) => row(page).getByRole('radio', { checked: true })
const card = (page: Page, name: string) => row(page).getByRole('radio', { name: new RegExp(name) })
const sheet = (page: Page) => page.locator('dialog[open]')
const numberBox = (page: Page) => page.getByRole('textbox', { name: 'Number on their card' })
const inAddress = (id: string) => new RegExp(`[?&]in=${id}(&|$)`)

test('starts on today’s competition and finds a dancer by the number on their card', async ({ page }) => {
  await open(page)
  await expect(chosen(page)).toContainText(today.name)
  await expect(chosen(page)).toContainText('Today')
  await expect(row(page).getByRole('radio').first()).toHaveAttribute('aria-checked', 'true')
  await expect(page).toHaveURL(inAddress(today.id))

  const dancer = today.dancers[0]
  await numberBox(page).fill(dancer.number)
  const result = page.getByRole('link', { name: new RegExp(`${dancer.firstName} ${dancer.lastName}`) })
  await expect(result).toBeVisible()
  await result.click()
  await expect(page).toHaveURL(new RegExp(`/competitions/${today.id}/dancers/${dancer.id}$`))
})

test('day 2 of a two-day competition still counts as today', async ({ page }) => {
  await open(page, '', 1)
  await expect(chosen(page)).toContainText(today.name)
  await expect(chosen(page)).toContainText('Today')
})

test('one tap switches competition, the results and the address follow', async ({ page }) => {
  await open(page)
  await numberBox(page).fill(today.dancers[0].number)
  await expect(page.getByRole('link', { name: new RegExp(today.dancers[0].lastName) })).toBeVisible()

  await card(page, listings.next.name).click()
  await expect(chosen(page)).toContainText(listings.next.name)
  await expect(page).toHaveURL(inAddress(listings.next.id))
  await expect(page.getByText(`The dancer list for ${listings.next.name} hasn’t been posted yet.`)).toBeVisible()

  await card(page, today.name).click()
  await expect(chosen(page)).toContainText(today.name)
  await expect(page).toHaveURL(inAddress(today.id))
  await expect(page.getByRole('link', { name: new RegExp(today.dancers[0].lastName) })).toBeVisible()
})

test('with many competitions, shows the closest few and finds any other by typing', async ({ page }) => {
  await open(page)
  await expect(chosen(page)).toContainText(today.name)
  // Nine competitions around today: the closest three, not all of them.
  await expect(row(page).getByRole('radio')).toHaveCount(3)
  await expect(card(page, listings.far.name)).toHaveCount(0)

  await page.getByRole('button', { name: 'More competitions' }).click()
  await expect(sheet(page).getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(sheet(page).getByRole('heading', { name: 'Coming up' })).toBeVisible()
  await expect(sheet(page).getByRole('heading', { name: 'Earlier' })).toBeVisible()
  await expect(sheet(page).getByRole('radio')).toHaveCount(9)

  await sheet(page).getByRole('searchbox', { name: 'Find a competition' }).fill('faraway')
  await expect(sheet(page).getByRole('radio')).toHaveCount(1)
  await sheet(page).getByRole('radio', { name: new RegExp(listings.far.name) }).click()
  await expect(sheet(page)).toHaveCount(0)

  // It joins the front of the row, chosen, so switching back is one tap.
  await expect(chosen(page)).toContainText(listings.far.name)
  await expect(row(page).getByRole('radio').first()).toContainText(listings.far.name)
  await expect(page).toHaveURL(inAddress(listings.far.id))
  await card(page, today.name).click()
  await expect(chosen(page)).toContainText(today.name)
  await expect(card(page, listings.far.name)).toBeVisible()
})

test('nothing matching says so', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'More competitions' }).click()
  await sheet(page).getByRole('searchbox', { name: 'Find a competition' }).fill('zzqx')
  await expect(sheet(page).getByText('No competition matches “zzqx”.')).toBeVisible()
  await expect(sheet(page).getByRole('radio')).toHaveCount(0)
})

test('a link opens on its competition, and an old one falls back to today’s', async ({ page }) => {
  await open(page, `&in=${listings.far.id}`)
  await expect(chosen(page)).toContainText(listings.far.name)
  await page.reload()
  await expect(chosen(page)).toContainText(listings.far.name)
  await expect(page).toHaveURL(inAddress(listings.far.id))

  await open(page, '&in=no-such-competition')
  await expect(chosen(page)).toContainText(today.name)
  await expect(page).toHaveURL(inAddress(today.id))
})

test('works from the keyboard: arrows between cards, Enter picks the match', async ({ page }) => {
  await open(page)
  await chosen(page).focus()
  await page.keyboard.press('ArrowRight')
  await expect(row(page).getByRole('radio').nth(1)).toHaveAttribute('aria-checked', 'true')
  await expect(row(page).getByRole('radio').nth(1)).toBeFocused()
  await page.keyboard.press('Home')
  await expect(row(page).getByRole('radio').first()).toBeFocused()
  await expect(chosen(page)).toContainText(today.name)

  await page.getByRole('button', { name: 'More competitions' }).focus()
  await page.keyboard.press('Enter')
  const filter = sheet(page).getByRole('searchbox', { name: 'Find a competition' })
  await filter.focus()
  await filter.pressSequentially('faraway')
  await page.keyboard.press('Enter')
  await expect(sheet(page)).toHaveCount(0)
  await expect(chosen(page)).toContainText(listings.far.name)
})

test('a followed competition further out is kept in the row, marked', async ({ page }) => {
  const email = `sn-${tag}@example.test`
  const userId = await ensureUser(email)
  await dbSet(`users:favorites/${userId}/competitions/${listings.followed.id}`, true)
  try {
    await signIn(page, email)
    await open(page)
    const followed = card(page, listings.followed.name)
    await expect(followed).toBeVisible()
    await expect(followed).toContainText('Following')
    await expect(chosen(page)).toContainText(today.name)
  } finally {
    await dbRemove(`users:favorites/${userId}`)
  }
})
