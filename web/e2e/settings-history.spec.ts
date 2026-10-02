import { expect, test } from '@playwright/test'
import { appTab } from './support/nav'

// Settings › Clear history: what this device remembers of where you've been
// goes in one go (a shared or borrowed phone), and search words are never
// kept with scroll positions.

test('clears recent searches, recently viewed and saved places in one go', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem('search:recent', JSON.stringify(['wren']))
    localStorage.setItem('dancers:recent:v2', JSON.stringify([{ id: 'd1', name: 'Wren Test', viewedAt: Date.now() }]))
    localStorage.setItem('competitions:recent:v2', JSON.stringify([{ id: 'c1', name: 'Fergus Games', viewedAt: Date.now() }]))
    localStorage.setItem('scroll-positions', JSON.stringify({ '/dancers': 120 }))
    localStorage.setItem('route-info', JSON.stringify({ $current: 'dancers' }))
  })
  await page.goto('/settings')
  await page.getByRole('button', { name: /^Clear history/ }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Clear history on this device?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Clear history' }).click()
  await expect(page.getByRole('status').getByText('History cleared')).toBeVisible()
  const left = await page.evaluate(() =>
    ['search:recent', 'dancers:recent:v2', 'competitions:recent:v2', 'scroll-positions', 'route-info'].map((k) => localStorage.getItem(k)),
  )
  // Cleared lists are stored empty; the router's records are gone (the
  // router may already have noted the Settings page itself).
  expect(left[0]).toBe('[]')
  expect(left[1]).toBe('[]')
  expect(left[2]).toBe('[]')
  expect(left[3] ?? '{}').not.toContain('/dancers')
  expect(left[4] ?? '{}').not.toContain('"$current":"dancers"')
})

test('never keeps search words with scroll positions', async ({ page }) => {
  await page.goto('/search?q=embarrassing')
  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible()
  await page.goto('/competitions')
  await expect(page.getByRole('heading', { level: 1, name: 'Competitions' })).toBeVisible()
  await appTab(page, 'Home').click()
  await expect(page).toHaveURL(/\/$/)
  const saved = await page.evaluate(() => localStorage.getItem('scroll-positions') ?? '')
  expect(saved).not.toContain('embarrassing')
  expect(saved).toContain('/competitions')
})
