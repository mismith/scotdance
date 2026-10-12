import { expect, type Page } from '@playwright/test'

// Add a competition, one question at a time (ADR 0010): the steps every spec
// that sends one walks through. submit.spec.ts covers the questions
// themselves.

/** The question showing, by its place in the steps ("Step 3 of 8: …"). */
export const question = (page: Page, step: number) =>
  page.getByRole('heading', { level: 1, name: new RegExp(`^Step ${step} of 8`) })

/** The one button at the foot of each question (Continue, Skip, Send…). */
export const action = (page: Page) =>
  page.getByRole('main').locator('form > div:last-child').getByRole('button')

/** The day picker's button for an ISO date, a month at a time until it shows. */
export async function pickDay(page: Page, iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const label = new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const day = page.getByRole('main').getByRole('button', { name: label, exact: true })
  for (let i = 0; i < 36 && !(await day.isVisible()); i++) {
    const [month, year] = (
      (await page
        .getByRole('main')
        .locator('[aria-live=polite]')
        .first()
        .textContent()) ?? ''
    )
      .trim()
      .split(' ')
    const shown = new Date(`${month} 1, ${year}`)
    await page
      .getByRole('main')
      .getByRole('button', {
        name: shown < new Date(y, m - 1, 1) ? 'Next month' : 'Previous month',
      })
      .click()
    // The old month slides out first.
    await expect(
      page.getByRole('main').locator('[role=group] .touch-pan-y > div'),
    ).toHaveCount(1)
  }
  await day.click()
}

/**
 * From the first question to Sent, with just what's needed: Canada, the date,
 * the name, the town (typed, as without a Maps key), your name.
 */
export async function addCompetition(
  page: Page,
  { name, date, town, you }: { name: string; date: string; town: string; you: string },
) {
  await expect(question(page, 1)).toBeVisible()
  await page.getByRole('radio', { name: /Canada/ }).click()
  await action(page).click()
  await pickDay(page, date)
  await action(page).click()
  await expect(question(page, 3)).toBeVisible()
  await page.getByRole('main').getByRole('textbox').fill(name)
  await action(page).click()
  await expect(question(page, 4)).toBeVisible()
  await action(page).click()
  await expect(question(page, 5)).toBeVisible()
  const justTown = page
    .getByRole('main')
    .getByRole('button', { name: 'Just the town for now' })
  if (await justTown.isVisible()) await justTown.click()
  await page.getByRole('main').getByRole('textbox', { name: 'Town or city' }).fill(town)
  await action(page).click()
  await expect(question(page, 6)).toBeVisible()
  await action(page).click()
  await expect(question(page, 7)).toBeVisible()
  await page.getByRole('main').getByRole('textbox').fill(you)
  await action(page).click()
  await expect(question(page, 8)).toBeVisible()
  await page.getByRole('checkbox', { name: /no guarantees/ }).check()
  await action(page).click()
  await expect(page.getByRole('heading', { name: 'Sent' })).toBeVisible()
}
