import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
const page = await context.newPage(),
  errors = []
page.on('pageerror', (e) => errors.push(e.message))
try {
  await page.goto('http://127.0.0.1:5330/_preview?owner=alex')
  await page.getByRole('button', { name: /Ava Grant/ }).click()
  await page.getByRole('button', { name: 'Sharing', exact: true }).click()
  await page.getByLabel('Invite by email').waitFor()
  assert.equal(
    await page
      .getByRole('button', { name: 'Sharing', exact: true })
      .locator('span[aria-hidden]')
      .count(),
    0,
  )
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: /Isla Grant/ }).click()
  await page.getByLabel('First name', { exact: true }).fill('Unsaved draft')
  await page.getByRole('button', { name: 'Sharing', exact: true }).click()
  await page.getByLabel('Invite by email').fill('popover@example.test')
  const trigger = page.getByRole('button', { name: 'Sharing', exact: true })
  assert.equal(await trigger.locator('[aria-hidden] > span').count(), 2)
  assert.equal(
    await trigger.evaluate((el) => {
      const avatars = el.children[0].getBoundingClientRect(),
        label = el.children[1].getBoundingClientRect()
      return avatars.right <= label.left
    }),
    true,
  )
  const popup = page.getByRole('dialog', { name: 'Sharing', exact: true })
  assert.equal(
    await popup.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return r.left >= 0 && r.right <= innerWidth
    }),
    true,
  )
  await page.getByRole('button', { name: 'Invite', exact: true }).click()
  await page
    .getByRole('button', { name: 'Cancel invitation to popover@example.test' })
    .waitFor()
  assert.equal(context.pages().length, 1)
  assert.equal(new URL(page.url()).pathname, '/dancers')
  assert.equal(
    await page.locator('html').evaluate((el) => el.scrollWidth > innerWidth),
    false,
  )
  await page.screenshot({
    path: '/private/tmp/coowners-review/sharing-popover-mobile.png',
    fullPage: true,
  })
  await page
    .getByRole('button', { name: 'Cancel invitation to popover@example.test' })
    .click()
  await page
    .getByRole('button', { name: 'Cancel invitation to popover@example.test' })
    .waitFor({ state: 'detached' })
  await page.getByRole('button', { name: 'Sharing', exact: true }).click()
  assert.equal(
    await page.getByLabel('First name', { exact: true }).inputValue(),
    'Unsaved draft',
  )
  await page.getByRole('button', { name: 'Sharing', exact: true }).click()
  await page.getByLabel('Invite by email').waitFor()
  await page.keyboard.press('Escape')
  await page.getByLabel('First name', { exact: true }).waitFor()
  assert.equal(
    await page.getByLabel('First name', { exact: true }).inputValue(),
    'Unsaved draft',
  )
  assert.equal(
    await page
      .getByRole('button', { name: 'Sharing', exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  )
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: /Isla Grant/ }).waitFor()

  await page.goto('http://127.0.0.1:5330/_preview/embed')
  await page.getByRole('button', { name: 'Edit shared dancer' }).click()
  const editor = page.frameLocator('iframe[title="ScotDance Connect"]')
  await editor.getByLabel('First name', { exact: true }).fill('Embedded draft')
  await editor.getByRole('button', { name: 'Sharing', exact: true }).click()
  await editor.getByLabel('Invite by email').waitFor()
  assert.equal(context.pages().length, 1)
  assert.equal(new URL(page.url()).pathname, '/_preview/embed')
  // Forged messages from the parent page must not reach the access adapter.
  let writes = 0
  const record = (req) => {
    if (req.url().endsWith('/api/invite')) writes++
  }
  page.on('request', record)
  const session = await page
    .locator('iframe[title="ScotDance Connect"]')
    .getAttribute('src')
  await page.evaluate(
    (session) =>
      window.postMessage(
        {
          channel: 'scotdance:dancer-editor:v1',
          session: new URL(session).searchParams.get('session'),
          type: 'access',
          requestId: 'forged',
          request: {
            action: 'invite',
            id: 'fictional-dancer-isla',
            email: 'wrong@example.test',
            ids: ['fictional-dancer-isla'],
          },
        },
        location.origin,
      ),
    session,
  )
  await editor.getByRole('button', { name: 'Sharing', exact: true }).click()
  assert.equal(writes, 0)
  assert.equal(
    await editor.getByLabel('First name', { exact: true }).inputValue(),
    'Embedded draft',
  )
  await editor.getByRole('button', { name: 'Sharing', exact: true }).click()
  await editor.getByLabel('Invite by email').fill('another@example.test')
  await editor.getByRole('button', { name: 'Invite', exact: true }).click()
  await editor
    .getByRole('button', { name: 'Cancel invitation to another@example.test' })
    .waitFor()
  assert.equal(writes, 1)
  await editor
    .getByRole('button', { name: 'Cancel invitation to another@example.test' })
    .click()
  await editor
    .getByRole('button', { name: 'Cancel invitation to another@example.test' })
    .waitFor({ state: 'detached' })
  await editor.getByRole('button', { name: 'Sharing', exact: true }).click()
  await editor.getByRole('button', { name: 'Close', exact: true }).click()
  await page.locator('iframe[title="ScotDance Connect"]').waitFor({ state: 'detached' })
  assert.deepEqual(errors, [])
  console.log(
    'PASS native and hosted sharing popovers: no navigation/popups, preserved drafts, Escape/toggle/focus, mobile bounds, email invitations and forged-message rejection',
  )
} finally {
  await browser.close()
}
