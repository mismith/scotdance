import { expect, test, type Locator, type Page } from '@playwright/test'
import { dbGet } from './support/emulator'
import {
  removeCompetition,
  seedCompetition,
  type SeededCompetition,
} from './support/seed'
import { retry } from './support/retry'
import {
  confirmDialog,
  expectDb,
  isPhone,
  signInOrganiser,
  toastUndo,
} from './support/manageData'

// Manage lists as an organiser: on a touch screen, swipe a row left to
// delete it (only on letting go past the line, the finger free to wander on
// the way); with a mouse, rows never swipe. And the selected row's
// background takes in its drag handle.

// One competition per worker; each test works on its own rows.
let comp: SeededCompetition
test.beforeAll(async () => {
  comp = await retry(() => seedCompetition({ dancersPerGroup: 1 }))
})
test.afterAll(async () => {
  await retry(() => removeCompetition(comp.id))
})
test.beforeEach(async ({ page }) => {
  await signInOrganiser(page, comp.id)
})

const manage = (path = '') => `/competitions/${comp.id}/manage${path}`
const data = (path: string) => `competitions:data/${comp.id}/${path}`
const row = (page: Page, name: string) =>
  page.getByRole('link', { name: new RegExp(`^${name}`) })
/** A dancer with no results (only the first two age groups have any), so deleting them asks nothing. */
const dancerIn = (group: number) =>
  comp.dancers.find((d) => d.groupId === comp.groups[group].id)!
const dancerRow = (page: Page, d: { number: string }) => row(page, `${d.number} `)
/** The part of a row that slides (its handle and link). */
const slider = (link: Locator) => link.locator('xpath=..')
const shift = (link: Locator) =>
  slider(link).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41)
const action = (page: Page) => page.getByText('Delete', { exact: true })

/** A finger on the screen: touch events, as a phone sends them. */
async function touch(page: Page, at: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page)
  const send = (
    type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
    points = [at],
  ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points })
  await send('touchStart')
  return {
    /** Slide to a point at an easy pace (or quickly, in fewer steps). */
    async to(x: number, y = at.y, steps = 10) {
      const from = at
      for (let i = 1; i <= steps; i++) {
        at = {
          x: from.x + ((x - from.x) * i) / steps,
          y: from.y + ((y - from.y) * i) / steps,
        }
        await send('touchMove')
        await page.waitForTimeout(20)
      }
    },
    /** Lift the finger after a pause, so it isn't a flick. */
    async lift() {
      await page.waitForTimeout(150)
      await send('touchEnd', [])
    },
    flick: () => send('touchEnd', []),
    /** The system takes the touch away (a call coming in, say). */
    cancel: () => send('touchCancel', []),
  }
}

/** Put a finger on a row towards its right end (clear of any handle). */
async function onRow(page: Page, el: Locator) {
  await el.scrollIntoViewIfNeeded()
  const box = (await el.boundingBox())!
  const finger = await touch(page, {
    x: box.x + box.width * 0.85,
    y: box.y + box.height / 2,
  })
  /** Where the finger is once the row has slid this much of its width. */
  const across = (fraction: number) => box.x + box.width * (0.85 - fraction)
  return { finger, box, across }
}

test.describe('swiping', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch screens only')

  test('a short or cancelled swipe springs back and deletes nothing; a tap still opens the row', async ({
    page,
  }) => {
    const d = dancerIn(3)
    await page.goto(manage('/dancers'))
    const link = dancerRow(page, d)
    let { finger, box, across } = await onRow(page, slider(link))
    await finger.to(across(0.3))
    // The row follows the finger, showing what letting go further along would do.
    expect(await shift(link)).toBeCloseTo(-box.width * 0.3, -1)
    await expect(action(page)).toBeVisible()
    await finger.lift()
    await expect.poll(() => shift(link)).toBe(0)

    // Past the line, but the touch is cancelled rather than let go.
    ;({ finger, box, across } = await onRow(page, slider(link)))
    await finger.to(across(0.7))
    await finger.cancel()
    await expect.poll(() => shift(link)).toBe(0)

    await page.waitForTimeout(500)
    expect(await dbGet(data(`dancers/${d.id}`))).not.toBeNull()
    await expect(confirmDialog(page)).toHaveCount(0)
    await expect(page).toHaveURL(manage('/dancers'))
    await link.tap()
    await expect(page).toHaveURL(manage(`/dancers/${d.id}`))
  })

  test('a drag up or down scrolls the list instead', async ({ page }) => {
    const d = comp.dancers[1]
    await page.goto(manage('/dancers'))
    const link = dancerRow(page, d)
    const top = () => page.evaluate(() => document.scrollingElement!.scrollTop)
    const { finger, box } = await onRow(page, slider(link))
    const before = await top()
    await finger.to(box.x + box.width * 0.8, box.y - 150)
    expect(await shift(link)).toBe(0)
    await finger.lift()
    await expect.poll(top).toBeGreaterThan(before)
    await expect(action(page)).toHaveCount(0)
    expect(await dbGet(data(`dancers/${d.id}`))).not.toBeNull()
  })

  test('a long swipe deletes on letting go, the usual way (draws too), with Undo', async ({
    page,
  }) => {
    // In their age group's draws, which lose their number along with them.
    const d = dancerIn(2)
    const draws = data(`draws/${d.groupId}`)
    const drawsBefore = await dbGet(draws)
    expect(JSON.stringify(drawsBefore)).toContain(`"${d.number}"`)
    await page.goto(manage('/dancers'))
    const link = dancerRow(page, d)
    const { finger, across } = await onRow(page, slider(link))
    await finger.to(across(0.7))
    // Past the line, but nothing happens until it's let go.
    await page.waitForTimeout(400)
    expect(await dbGet(data(`dancers/${d.id}`))).not.toBeNull()
    await finger.lift()
    await expectDb(data(`dancers/${d.id}`), null)
    expect(JSON.stringify(await dbGet(draws))).not.toContain(`"${d.number}"`)
    // Only the dancer goes, so it doesn't ask; the toast offers Undo.
    await expect(confirmDialog(page)).toHaveCount(0)
    await expect(
      page.getByRole('status').getByText(`Deleted ${d.firstName} ${d.lastName}`),
    ).toBeVisible()
    await expect(link).toHaveCount(0)
    await toastUndo(page).click()
    await expect.poll(() => dbGet(data(`dancers/${d.id}/firstName`))).toBe(d.firstName)
    expect(await dbGet(draws)).toEqual(drawsBefore)
    await expect(link).toBeVisible()
    expect(await shift(link)).toBe(0)
  })

  test('a swipe that would take more than the row still asks first', async ({ page }) => {
    const [premier] = Object.entries(comp.categories).find(([, n]) => n === 'Premier')!
    await page.goto(manage('/categories'))
    const link = row(page, 'Premier')
    let { finger, across } = await onRow(page, slider(link))
    await finger.to(across(0.7))
    await finger.lift()
    await expect(confirmDialog(page)).toContainText('Delete Premier?')
    await expect(confirmDialog(page)).toContainText(
      '3 age groups use it and will need another category.',
    )
    // Kept: the row slides back.
    await confirmDialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect.poll(() => shift(link)).toBe(0)
    expect(await dbGet(data(`categories/${premier}/name`))).toBe('Premier')
    ;({ finger, across } = await onRow(page, slider(link)))
    await finger.to(across(0.7))
    await finger.lift()
    await confirmDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
    await expectDb(data(`categories/${premier}`), null)
    await toastUndo(page).click()
    await expect.poll(() => dbGet(data(`categories/${premier}/name`))).toBe('Premier')
  })

  test('the finger can wander up, down and off the row without dropping it', async ({
    page,
  }) => {
    const d = dancerIn(4)
    await page.goto(manage('/dancers'))
    const link = dancerRow(page, d)
    const { finger, box, across } = await onRow(page, slider(link))
    const scrolled = await page.evaluate(() => scrollY)
    await finger.to(across(0.15))
    // Up into the top bar…
    await finger.to(across(0.35), 40)
    expect(await shift(link)).toBeCloseTo(-box.width * 0.35, -1)
    // …and down to the bottom of the screen: the page doesn't scroll either.
    await finger.to(across(0.7), page.viewportSize()!.height - 10)
    expect(await shift(link)).toBeCloseTo(-box.width * 0.7, -1)
    expect(await page.evaluate(() => scrollY)).toBe(scrolled)
    await finger.lift()
    await expectDb(data(`dancers/${d.id}`), null)
  })

  test('a quick flick left deletes too', async ({ page }) => {
    const d = dancerIn(5)
    await page.goto(manage('/dancers'))
    const { finger, across } = await onRow(page, slider(dancerRow(page, d)))
    await finger.to(across(0.3), undefined, 4)
    await finger.flick()
    await expectDb(data(`dancers/${d.id}`), null)
  })

  test('offline, or while selecting, rows don’t swipe', async ({ page, context }) => {
    const d = dancerIn(6)
    await page.goto(manage('/dancers'))
    const link = dancerRow(page, d)
    await expect(link).toBeVisible()
    await context.setOffline(true)
    await expect(page.getByRole('status').filter({ hasText: 'Offline' })).toBeVisible({
      timeout: 15000,
    })
    let { finger, across } = await onRow(page, slider(link))
    await finger.to(across(0.7))
    expect(await shift(link)).toBe(0)
    await expect(action(page)).toHaveCount(0)
    await finger.lift()
    await context.setOffline(false)
    await expect(page.getByRole('status').filter({ hasText: 'Offline' })).toBeHidden({
      timeout: 20000,
    })

    await page.getByRole('button', { name: 'Select', exact: true }).click()
    ;({ finger, across } = await onRow(
      page,
      page.getByRole('checkbox', { name: new RegExp(`^${d.number} `) }),
    ))
    await finger.to(across(0.7))
    await expect(action(page)).toHaveCount(0)
    await finger.lift()
    await page.waitForTimeout(300)
    await expect(confirmDialog(page)).toHaveCount(0)
    expect(await dbGet(data(`dancers/${d.id}`))).not.toBeNull()
  })
})

test('a mouse drag never swipes', async ({ page }) => {
  const d = dancerIn(7)
  await page.goto(manage('/dancers'))
  const link = dancerRow(page, d)
  await link.scrollIntoViewIfNeeded()
  const box = (await slider(link).boundingBox())!
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width * 0.85, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.1, y, { steps: 15 })
  expect(await shift(link)).toBe(0)
  await expect(action(page)).toHaveCount(0)
  await page.mouse.up()
  await page.waitForTimeout(500)
  await expect(confirmDialog(page)).toHaveCount(0)
  expect(await dbGet(data(`dancers/${d.id}`))).not.toBeNull()
})

test('the selected row’s background, hover and focus ring take in its grip', async ({
  page,
}, info) => {
  test.skip(isPhone(info), 'needs the list and the item side by side')
  const [novice] = Object.entries(comp.categories).find(([, n]) => n === 'Novice')!
  await page.goto(manage(`/categories/${novice}`))
  await expect(row(page, 'Novice')).toHaveAttribute('aria-current', 'true')
  // The colour behind an element: the first background going up from it.
  const behind = (l: Locator) =>
    l.evaluate((el) => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const bg = getComputedStyle(e).backgroundColor
        if (bg !== 'rgba(0, 0, 0, 0)') return bg
      }
      return ''
    })
  const handle = (name: string) => page.getByLabel(`Move ${name}`)
  const selected = await behind(row(page, 'Novice'))
  expect(selected).not.toBe(await behind(row(page, 'Primary')))
  expect(await behind(handle('Novice'))).toBe(selected)

  // Hovering tints the whole row (a shade over its background), grip and all.
  const tint = (name: string) => slider(row(page, name)).evaluate((el) => getComputedStyle(el).boxShadow)
  const plain = await tint('Beginner')
  await handle('Beginner').hover()
  await expect.poll(() => tint('Beginner')).not.toBe(plain)

  // From the keyboard, the ring goes round the whole row, not just its link.
  await page.keyboard.press('Tab')
  await row(page, 'Premier').focus()
  expect(
    await slider(row(page, 'Premier')).evaluate(
      (el) => getComputedStyle(el).outlineStyle,
    ),
  ).toBe('solid')
  expect(
    await row(page, 'Premier').evaluate((el) => getComputedStyle(el).outlineStyle),
  ).toBe('none')
})
