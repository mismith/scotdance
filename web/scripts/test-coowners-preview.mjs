import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
const origin = process.env.COOWNERS_PREVIEW_ORIGIN || 'http://127.0.0.1:5330'
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error('Local preview required')
const browser = await chromium.launch({ headless: true })
const a = await browser.newContext({ viewport: { width: 375, height: 812 } }),
  b = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const alex = await a.newPage(),
  jamie = await b.newPage(),
  errors = []
for (const page of [alex, jamie]) page.on('pageerror', (e) => errors.push(e.message))
const api = (page, action, body = {}) =>
  page.evaluate(
    async ({ action, body }) => {
      const r = await fetch(`/api/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return { status: r.status, ...(await r.json()) }
    },
    { action, body },
  )
try {
  await alex.goto(`${origin}/_preview?owner=alex`)
  await alex.getByRole('button', { name: /Isla Grant/ }).waitFor()
  await jamie.goto(`${origin}/_preview?owner=jamie`)
  const before = await api(alex, 'access', {
    id: 'fictional-dancer-isla',
    operation: 'list',
  })
  for (const invitation of before.invitations || [])
    await api(alex, 'access', {
      id: 'fictional-dancer-isla',
      operation: 'revoke',
      invitationId: invitation.id,
    })
  await alex.goto(`${origin}/dancers/fictional-dancer-isla/access`)
  await alex.getByRole('button', { name: 'Sharing', exact: true }).click()
  await alex.getByLabel('Invite by email').fill('jamie@example.test')
  await alex.getByRole('button', { name: 'Invite', exact: true }).click()
  await alex.getByText('Invited', { exact: true }).last().waitFor()
  await jamie.goto(`${origin}/_preview/inbox`)
  await jamie.getByRole('link', { name: 'Open invitation' }).last().click()
  await jamie.getByRole('button', { name: 'Accept invitation' }).click()
  await jamie.getByRole('heading', { name: 'Dancers added' }).waitFor()
  await jamie.getByRole('link', { name: 'Your dancers', exact: true }).click()
  await jamie.getByRole('button', { name: /Isla Grant/ }).click()
  await jamie.getByLabel('First name', { exact: true }).fill('Isla Shared')
  await jamie.getByRole('button', { name: 'Save', exact: true }).click()
  await jamie.getByRole('button', { name: /Isla Shared Grant/ }).waitFor()
  await alex.goto(`${origin}/dancers`)
  await alex.getByRole('button', { name: /Isla Shared Grant/ }).waitFor()
  assert.equal(
    await alex.locator('html').evaluate((el) => el.scrollWidth > innerWidth),
    false,
  )
  await mkdir('/private/tmp/coowners-review', { recursive: true })
  await alex.screenshot({
    path: '/private/tmp/coowners-review/access-mobile.png',
    fullPage: true,
  })
  await alex.setViewportSize({ width: 320, height: 700 })
  assert.equal(
    await alex.locator('html').evaluate((el) => el.scrollWidth > innerWidth),
    false,
  )
  await jamie.goto(`${origin}/dancers/fictional-dancer-isla/access`)
  await jamie.getByRole('button', { name: 'Sharing', exact: true }).click()
  const originalOwner = jamie.getByRole('listitem').filter({ hasText: 'Alex Grant' })
  await originalOwner.getByRole('button', { name: 'Remove', exact: true }).click()
  await jamie
    .getByRole('group', { name: 'Confirm removal' })
    .getByRole('button', { name: 'Remove access', exact: true })
    .click()
  await jamie.getByRole('group', { name: 'Confirm removal' }).waitFor({ state: 'detached' })
  await jamie.getByLabel('Invite by email').waitFor()
  await originalOwner.waitFor({ state: 'detached' })
  assert.equal(
    (await api(alex, 'load')).dancers.some((d) => d.id === 'fictional-dancer-isla'),
    false,
  )
  await jamie.getByLabel('Invite by email').fill('alex@example.test')
  await jamie.getByRole('button', { name: 'Invite', exact: true }).click()
  await jamie.getByText('Invited', { exact: true }).last().waitFor()
  await alex.goto(`${origin}/_preview/inbox`)
  await alex.getByRole('link', { name: 'Open invitation' }).last().click()
  await alex.getByRole('button', { name: 'Accept invitation' }).click()
  await alex.getByRole('heading', { name: 'Dancers added' }).waitFor()
  await alex.getByRole('link', { name: 'Your dancers', exact: true }).click()
  await alex.getByRole('button', { name: /Isla Shared Grant/ }).click()
  await alex.getByLabel('First name', { exact: true }).fill('Isla')
  await alex.getByRole('button', { name: 'Save', exact: true }).click()
  await alex.getByRole('button', { name: /Isla Grant/ }).waitFor()
  await jamie.goto(`${origin}/dancers`)
  await jamie.getByText('Isla Grant', { exact: true }).first().waitFor()
  await jamie.screenshot({
    path: '/private/tmp/coowners-review/access-desktop.png',
    fullPage: true,
  })
  assert.deepEqual(errors, [])
  console.log(
    'PASS two-parent browser: email inbox, explicit acceptance, shared edits, equal removal/reinvite, 320/375px layout, no browser errors',
  )
} finally {
  await browser.close()
}
