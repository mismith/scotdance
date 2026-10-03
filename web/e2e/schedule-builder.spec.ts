import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import {
  dbGet,
  dbRemove,
  dbSet,
  ensureUser,
  grantCompetition,
  signIn,
  uid,
} from './support/emulator'
import {
  removeCompetition,
  seedCompetition,
  type SeededCompetition,
} from './support/seed'
import { barMenuItem, sectionMenuItem } from './support/manageData'

// Manage › Schedule (the Blocks builder) as an organiser, on phone and
// desktop, then the public Schedule and Event pages. Writes must keep the
// shape the old app reads: schedule/days/{day}/blocks/{block}/events/{event}/
// dances/{row}/{danceId?, order, platforms/{platform}/{orderedGroupIds[],
// orderedJudgeIds[]}}, with names on days, sessions and events.
//
// One competition per worker (seeding is heavy on the emulators); each test
// starts from an empty schedule and puts back anything else it changes.

let comp: SeededCompetition
let email: string
let seeded: Schedule

const isPhone = (info: TestInfo) => info.project.name === 'phone'

/** The emulators drop writes now and then when busy (503): try again. */
async function retry<T>(fn: () => Promise<T>, tries = 8): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn()
    } catch (e) {
      if (
        i >= tries ||
        !/\b503\b|inactive|fetch failed|not attached|Timeout/i.test(String(e))
      )
        throw e
      await new Promise((r) => setTimeout(r, 2000 * i))
    }
  }
}
const set = (path: string, value: unknown) => retry(() => dbSet(path, value))
const remove = (path: string) => retry(() => dbRemove(path))
const dataPath = (path = '') => `competitions:data/${comp.id}${path ? `/${path}` : ''}`
const data = <T = unknown>(path = '') => retry(() => dbGet<T>(dataPath(path)))

type Cell = { orderedGroupIds?: string[]; orderedJudgeIds?: string[] }
type Row = {
  order?: number
  danceId?: string
  name?: string
  description?: string
  platforms?: Record<string, Cell>
}
type Ev = {
  order?: number
  name?: string
  description?: string
  dances?: Record<string, Row>
}
type Block = {
  order?: number
  name?: string
  description?: string
  events?: Record<string, Ev>
}
type Day = {
  order?: number
  name?: string
  date?: string
  blocks?: Record<string, Block>
}
type Schedule = { days?: Record<string, Day> }

const sorted = <T extends { order?: number }>(rec?: Record<string, T> | null) =>
  Object.entries(rec ?? {}).sort(
    ([ak, a], [bk, b]) => (a.order ?? 0) - (b.order ?? 0) || (ak < bk ? -1 : 1),
  )

/** Uncaught errors from the app. */
function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (
      m.type() === 'error' &&
      !/crisp|favicon|Failed to load resource|maps\.googleapis/i.test(m.text())
    )
      errors.push(`console: ${m.text()}`)
  })
  return errors
}

/**
 * Drag with a mouse, or a finger by the grip on touch screens (the builder
 * only drags by the grip there, so swiping still scrolls).
 */
async function drag(
  page: Page,
  from: Locator,
  to: Locator,
  info: TestInfo,
  at: 'middle' | 'top' | 'bottom' = 'middle',
) {
  const grip = isPhone(info) ? from.locator('[data-grip]').first() : from
  // (Other edits to the app hot-reload parts of the page now and then: try again.)
  const box = (l: Locator) =>
    retry(async () => {
      await l.scrollIntoViewIfNeeded({ timeout: 5000 })
      return (await l.boundingBox())!
    }, 3)
  const a = await box(grip)
  await box(to)
  const b = await box(to)
  const sx = a.x + a.width / 2
  const sy = a.y + a.height / 2
  const tx = b.x + b.width / 2
  const ty =
    at === 'top' ? b.y + 3 : at === 'bottom' ? b.y + b.height - 3 : b.y + b.height / 2
  if (isPhone(info)) {
    const cdp = await page.context().newCDPSession(page)
    const touch = (type: string, x?: number, y?: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: x == null ? [] : [{ x, y }],
      } as never)
    await touch('touchStart', sx, sy)
    for (let i = 1; i <= 16; i++)
      await touch('touchMove', sx + ((tx - sx) * i) / 16, sy + ((ty - sy) * i) / 16)
    await page.waitForTimeout(50)
    await touch('touchEnd')
    await cdp.detach()
  } else {
    await page.mouse.move(sx, sy)
    await page.mouse.down()
    await page.mouse.move(sx + 6, sy + 6, { steps: 3 })
    await page.mouse.move(tx, ty, { steps: 16 })
    await page.waitForTimeout(50)
    await page.mouse.up()
  }
}

const openBuilder = async (page: Page) => {
  await page.goto(`/competitions/${comp.id}/manage/schedule`)
  await expect(page.getByRole('button', { name: 'Add session' })).toBeVisible()
}
const palette = (page: Page) =>
  page.locator('aside').filter({ has: page.getByRole('heading', { name: 'Dances' }) })
const session = (page: Page, name: string) =>
  page
    .locator('section[data-block]')
    .filter({
      has: page.getByRole('button', { name: `Session name: ${name}`, exact: true }),
    })
const event = (page: Page, name: string) =>
  page
    .locator('[data-event]')
    .filter({
      has: page.getByRole('button', { name: `Event name: ${name}`, exact: true }),
    })
const confirmDialog = (page: Page) => page.locator('dialog[open]')

/** The menu has shrunk back into its button: the page takes taps again. */
const settled = (page: Page) =>
  page.waitForFunction(() => !document.querySelector('dialog[open]') && !document.documentElement.matches(':active-view-transition'))

async function addSession(page: Page, name: string, custom = false) {
  await page.getByRole('button', { name: 'Add session' }).click()
  if (custom) {
    await page.getByRole('textbox', { name: 'Session name…' }).fill(name)
    await page.keyboard.press('Enter')
  } else await page.getByRole('option', { name, exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(session(page, name)).toBeVisible()
  await settled(page)
}

async function addEvent(page: Page, sessionName: string, name: string) {
  await session(page, sessionName).getByRole('button', { name: 'Add event' }).click()
  await page.getByRole('option', { name, exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(event(page, name)).toBeVisible()
  await settled(page)
}

/** Let page transitions finish (for screenshots). */
const settle = (page: Page) =>
  page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running'),
  )

/** The page doesn't scroll sideways (the grid scrolls inside itself). */
async function expectNoSideScroll(page: Page) {
  const [scroll, width] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ])
  if (scroll > width)
    console.log(
      'wide:',
      await page.evaluate(() =>
        [...document.querySelectorAll('body *')]
          .filter(
            (el) =>
              el.getBoundingClientRect().right >
                document.documentElement.clientWidth + 1 && !el.closest('nav'),
          )
          .slice(0, 12)
          .map(
            (el) =>
              `${el.tagName}.${String(el.className).slice(0, 100)} → ${Math.round(el.getBoundingClientRect().right)} [${getComputedStyle(el).position}]`,
          ),
      ),
    )
  expect(scroll).toBeLessThanOrEqual(width)
}

test.beforeAll(async () => {
  const id = uid('comp')
  comp = await retry(async () => {
    try {
      return await seedCompetition({ id, dancersPerGroup: 2 })
    } catch (e) {
      await removeCompetition(id).catch(() => {})
      throw e
    }
  })
  seeded = await retry(() => data<Schedule>('schedule'))
  email = `${uid('org')}@example.test`
  const user = await retry(() => ensureUser(email))
  await retry(() => grantCompetition(user, comp.id))
})
test.afterAll(async () => {
  if (comp) await retry(() => removeCompetition(comp.id))
})
test.beforeEach(async ({ page }) => {
  await retry(() => dbRemove(dataPath('schedule')))
  await signIn(page, email)
})

test('build a schedule from nothing, then see it on the public pages', async ({
  page,
}, info) => {
  test.slow()
  const errors = collectErrors(page)
  await openBuilder(page)
  await expect(page.getByText('Start with a session')).toBeVisible()

  await addSession(page, 'Morning')
  await addEvent(page, 'Morning', 'Primary')

  // A dance from the palette into the event.
  const fling = palette(page).locator('[data-chip=dance]', { hasText: 'Highland Fling' })
  await drag(page, fling, event(page, 'Primary').getByText('Drag dances here'), info)
  const row = event(page, 'Primary').locator('[data-row]').first()
  await expect(row.locator('[data-chip=dance]')).toContainText('Highland Fling')

  // Age groups and a judge onto Platform A.
  const cellA = row.locator('> div').nth(1)
  const under7 = palette(page)
    .locator('[data-chip=group]', { hasText: 'Under 7' })
    .first()
  await drag(page, under7, cellA, info)
  await expect(cellA.locator('[data-chip=group]')).toHaveCount(1)
  const sevens = palette(page)
    .locator('[data-chip=group]', { hasText: '7 & 8 Years' })
    .first()
  await drag(page, sevens, cellA, info, 'bottom')
  await expect(cellA.locator('[data-chip=group]')).toHaveCount(2)
  const judge = palette(page).locator('[data-chip=judge]', {
    hasText: 'Aileen Robertson',
  })
  await drag(page, judge, cellA, info, 'bottom')
  await expect(cellA.locator('[data-chip=judge]')).toHaveCount(1)

  // Reorder the age groups within the cell: 7 & 8 first.
  await drag(
    page,
    cellA.locator('[data-chip=group]').nth(1),
    cellA.locator('[data-chip=group]').nth(0),
    info,
    'top',
  )
  await expect(cellA.locator('[data-chip=group]').first()).toContainText('7 & 8')

  // Rename the session and give it a time.
  await session(page, 'Morning')
    .getByRole('button', { name: 'Session name: Morning' })
    .click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Morning session')
  await page.keyboard.press('Enter')
  await session(page, 'Morning session')
    .getByRole('button', { name: /^Session time and notes/ })
    .click()
  await page.keyboard.type('8:30 am')
  await page.locator('body').click({ position: { x: 5, y: 5 } })

  // Stored as the old apps read it.
  const groups = comp.groups
    .filter((g) => g.categoryId.endsWith('-cat-pri'))
    .map((g) => g.id)
  await expect
    .poll(async () => {
      const s = await data<Schedule>('schedule')
      const days = sorted(s?.days)
      if (days.length !== 1) return days.length
      const [, day] = days[0]
      const [, block] = sorted(day.blocks)[0] ?? []
      const [, ev] = sorted(block?.events)[0] ?? []
      const [, r] = sorted(ev?.dances)[0] ?? []
      return {
        day: { name: day.name, date: day.date, order: day.order },
        block: {
          name: block?.name,
          description: block?.description,
          order: block?.order,
        },
        event: { name: ev?.name, order: ev?.order },
        row: { danceId: r?.danceId, order: r?.order, platforms: r?.platforms },
      }
    })
    .toEqual({
      // Older apps head the schedule with the day's name.
      day: {
        name: await page.evaluate(
          (d) =>
            new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(
              new Date(`${d}T12:00`),
            ),
          comp.days[0],
        ),
        date: comp.days[0],
        order: 0,
      },
      block: { name: 'Morning session', description: '8:30 am', order: 0 },
      event: { name: 'Primary', order: 0 },
      row: {
        danceId: comp.dances[0].id,
        order: 0,
        platforms: {
          [comp.platforms[0]]: {
            orderedGroupIds: [groups[1], groups[0]],
            orderedJudgeIds: [comp.judges[0]],
          },
        },
      },
    })

  // Undo the time, then redo it.
  await (await barMenuItem(page, /^Undo: Changed Morning session/)).click()
  await expect(
    session(page, 'Morning session').getByRole('button', {
      name: /^Session time and notes: Add a time/,
    }),
  ).toBeVisible()
  await (await barMenuItem(page, /^Redo: Changed Morning session/)).click()
  await expect(session(page, 'Morning session').getByText('8:30 am')).toBeVisible()
  await expect
    .poll(async () => JSON.stringify(await data('schedule')))
    .toContain('8:30 am')

  // The public pages show it.
  await page.goto(`/competitions/${comp.id}/schedule`)
  await expect(page.getByRole('heading', { name: /Morning session/ })).toBeVisible()
  await expect(page.getByText('8:30 am')).toBeVisible()
  await page.getByRole('link', { name: /Primary/ }).click()
  await expect(page.getByRole('heading', { name: 'Primary', level: 1 })).toBeVisible()
  // One day: not named (as on Schedule).
  await expect(page.getByText('Morning session', { exact: true })).toBeVisible()
  // The time once, as typed.
  await expect(page.getByText('8:30 am', { exact: true })).toBeVisible()
  await expect(page.getByText('Platform A', { exact: true })).toBeVisible()
  await expect(page.getByText('Platform Platform')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Aileen Robertson/ })).toBeVisible()
  const groupRows = page.locator('li').filter({ hasText: /\d+ dancers/ })
  await expect(groupRows.first()).toContainText('7 & 8 Years')
  await expect(groupRows.nth(1)).toContainText('Under 7')
  expect(errors).toEqual([])
})

test('a double click on a suggestion adds it once', async ({ page }, info) => {
  test.skip(isPhone(info), 'mouse')
  await openBuilder(page)
  await page.getByRole('button', { name: 'Add session' }).click()
  // The list moves up as Morning is added: the second click mustn't add Afternoon.
  await page.getByRole('option', { name: 'Morning' }).dblclick()
  await page.keyboard.press('Escape')
  await expect(session(page, 'Morning')).toBeVisible()
  await expect(page.locator('section[data-block]')).toHaveCount(1)
})

test('an empty schedule offers hiding the tab instead; Show brings it back', async ({
  page,
}) => {
  await openBuilder(page)
  await page.getByRole('button', { name: 'Hide the Schedule tab' }).click()
  await confirmDialog(page).getByRole('button', { name: 'Hide schedule' }).click()
  await expect(page.getByText('The schedule is hidden')).toBeVisible()
  await expect.poll(() => data('schedule')).toBe(false)
  await page.getByRole('button', { name: 'Show the Schedule tab' }).click()
  await expect(page.getByRole('button', { name: 'Add session' })).toBeVisible()
  await expect.poll(() => data('schedule')).toBeNull()
  // Once there's a schedule, it's in the ⋯ menu at the top instead.
  await addSession(page, 'Morning')
  await expect(await sectionMenuItem(page, 'More for the schedule', 'Hide the Schedule tab')).toBeEnabled()
})

test('dragging near the bottom of the grid scrolls it, by finger too', async ({
  page,
}, info) => {
  await set(dataPath('schedule'), seeded)
  await page.setViewportSize({ width: isPhone(info) ? 412 : 1280, height: 600 })
  await openBuilder(page)
  await expect(page.locator('section[data-block]').first()).toBeVisible()
  const grid = page
    .locator('section[data-block]')
    .first()
    .locator('xpath=ancestor::div[contains(@class,"overflow-auto")][1]')
  const box = (await grid.boundingBox())!
  const scrollTop = () => grid.evaluate((el) => el.scrollTop)
  expect(await scrollTop()).toBe(0)

  const chip = palette(page).locator('[data-chip=group]').first()
  const grip = isPhone(info) ? chip.locator('[data-grip]') : chip
  // (Below the section's header in the palette, on a short phone.)
  await chip.scrollIntoViewIfNeeded()
  const c = (await grip.boundingBox())!
  const [sx, sy] = [c.x + c.width / 2, c.y + c.height / 2]
  const [tx, ty] = [box.x + box.width / 2, box.y + box.height - 8]
  if (isPhone(info)) {
    const cdp = await page.context().newCDPSession(page)
    const touch = (type: string, x?: number, y?: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: x == null ? [] : [{ x, y }],
      } as never)
    await touch('touchStart', sx, sy)
    for (let i = 1; i <= 10; i++)
      await touch('touchMove', sx + ((tx - sx) * i) / 10, sy + ((ty - sy) * i) / 10)
    for (let i = 0; i < 15; i++) {
      await touch('touchMove', tx + (i % 2), ty)
      await page.waitForTimeout(50)
    }
    await expect.poll(scrollTop).toBeGreaterThan(100)
    await touch('touchEnd')
    await cdp.detach()
  } else {
    await page.mouse.move(sx, sy)
    await page.mouse.down()
    await page.mouse.move(sx + 6, sy + 6, { steps: 3 })
    await page.mouse.move(tx, ty, { steps: 10 })
    await expect.poll(scrollTop).toBeGreaterThan(100)
    await page.mouse.up()
  }
})

test('offline: nothing to edit until back online', async ({ page, context }, info) => {
  test.skip(isPhone(info), 'same on both')
  await set(dataPath('schedule'), seeded)
  await openBuilder(page)
  await expect(page.getByRole('button', { name: 'Session name: Morning' })).toBeVisible()
  await context.setOffline(true)
  try {
    await expect(page.getByRole('button', { name: 'Add session' })).toHaveCount(0, {
      timeout: 15000,
    })
    // Names are plain text, nothing can be deleted, dragged or dated.
    await expect(page.getByRole('button', { name: /^Session name:/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Delete / })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Move / })).toHaveCount(0)
    await expect(page.getByLabel(/^Date of /)).toBeDisabled()
  } finally {
    await context.setOffline(false)
  }
  await expect(page.getByRole('button', { name: 'Add session' })).toBeVisible({
    timeout: 30000,
  })
})

test('keyboard only: add, rename, autofill, delete and move with keys', async ({
  page,
}, info) => {
  test.skip(isPhone(info), 'keyboard')
  const errors = collectErrors(page)
  await openBuilder(page)

  // Add two sessions from the keyboard.
  await page.getByRole('button', { name: 'Add session' }).focus()
  await page.keyboard.press('Enter')
  // (Once it has grown out of the button, the keyboard is in its field.)
  await expect(page.getByRole('textbox', { name: 'Session name…' })).toBeFocused()
  await page.keyboard.type('Morning')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Late 🌙')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await expect(session(page, 'Morning')).toBeVisible()
  await expect(session(page, 'Late 🌙')).toBeVisible()
  // Escape gives focus back to the button.
  await expect(page.getByRole('button', { name: 'Add session' })).toBeFocused()

  // Space or Enter on a name edits it; Escape puts it back; Enter saves.
  const name = session(page, 'Late 🌙').getByRole('button', {
    name: 'Session name: Late 🌙',
  })
  await name.focus()
  await page.keyboard.press('Space')
  await page.keyboard.type('Nope')
  await page.keyboard.press('Escape')
  await expect(name).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Evening')
  await page.keyboard.press('Enter')
  await expect(session(page, 'Evening')).toBeVisible()
  // An empty name isn't saved.
  await session(page, 'Evening')
    .getByRole('button', { name: 'Session name: Evening' })
    .press('Enter')
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Enter')
  await expect(session(page, 'Evening')).toBeVisible()

  // Enter on Delete deletes (it used to pick the session up to drag instead).
  await session(page, 'Evening')
    .getByRole('button', { name: 'Delete Evening' })
    .press('Enter')
  await expect(session(page, 'Evening')).toHaveCount(0)

  // Autofill one event from the keyboard: focus goes into the menu.
  await session(page, 'Morning').getByRole('button', { name: 'Add event' }).press('Enter')
  await expect(page.getByRole('textbox', { name: 'Event name…' })).toBeFocused()
  await page.keyboard.type('Beginner')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await settled(page)
  await event(page, 'Beginner').getByRole('button', { name: 'Autofill' }).press('Enter')
  await expect(page.getByRole('menuitem', { name: 'Place Primary dances' })).toBeFocused()
  await page.getByRole('menuitem', { name: 'Place all dances' }).press('Enter')
  await expect(event(page, 'Beginner').locator('[data-row]')).toHaveCount(4)
  await expect(
    event(page, 'Beginner').getByRole('button', { name: 'Autofill' }),
  ).toBeFocused()

  // Move a session with the keys: grip, Enter, arrows, Enter.
  await addSession(page, 'Afternoon')
  await session(page, 'Afternoon').getByRole('button', { name: 'Move Afternoon' }).focus()
  await page.keyboard.press('Enter')
  for (let i = 0; i < 12; i++) await page.keyboard.press('Shift+ArrowUp')
  await page.keyboard.press('Enter')
  await expect
    .poll(async () => {
      const [[, day]] = sorted((await data<Schedule>('schedule')).days)
      return sorted(day.blocks).map(([, b]) => b.name)
    })
    .toEqual(['Afternoon', 'Morning'])

  // Remove a chip from the keyboard.
  const row = event(page, 'Beginner').locator('[data-row]').first()
  await row.getByRole('button', { name: /^Remove Highland Fling/ }).press('Enter')
  await expect(event(page, 'Beginner').locator('[data-row]')).toHaveCount(3)
  expect(errors).toEqual([])
})

test('autofill, and deletes that matter ask first', async ({ page }) => {
  test.slow()
  const errors = collectErrors(page)
  await openBuilder(page)
  await page.getByRole('button', { name: 'Autofill the schedule' }).click()
  await expect(session(page, 'Morning')).toBeVisible()
  await expect(session(page, 'Afternoon')).toBeVisible()
  await expect(
    page.getByRole('status').getByText('Autofilled the schedule'),
  ).toBeVisible()
  const primaryEvent = event(page, 'Primary / Beginner')
  await expect(primaryEvent.locator('[data-chip=group]').first()).toBeVisible()
  await expect(primaryEvent.locator('[data-chip=judge]').first()).toBeVisible()

  const filled = await data<Schedule>('schedule')
  const [[, day]] = sorted(filled.days)
  expect(
    sorted(day.blocks).map(([, b]) => [b.name, sorted(b.events).map(([, e]) => e.name)]),
  ).toEqual([
    ['Morning', ['Registration', 'Primary / Beginner', 'Results']],
    ['Afternoon', ['Registration', 'Novice / Premier', 'Results']],
  ])
  // Every list is an array of ids that exist.
  const known = new Set([...comp.groups.map((g) => g.id), ...comp.judges])
  for (const [, b] of sorted(day.blocks))
    for (const [, e] of sorted(b.events))
      for (const [, r] of sorted(e.dances))
        for (const [p, c] of Object.entries(r.platforms ?? {})) {
          expect(comp.platforms).toContain(p)
          for (const list of [c.orderedGroupIds ?? [], c.orderedJudgeIds ?? []]) {
            expect(Array.isArray(list)).toBe(true)
            for (const id of list) expect(known.has(id)).toBe(true)
          }
        }

  // Autofilling again asks first.
  await page.getByRole('button', { name: 'Autofill the schedule' }).click()
  await expect(confirmDialog(page)).toContainText('Replace the schedule?')
  await confirmDialog(page).getByRole('button', { name: 'Cancel' }).click()

  // A session with events asks; Cancel keeps it.
  await session(page, 'Afternoon')
    .getByRole('button', { name: 'Delete Afternoon' })
    .click()
  await expect(confirmDialog(page)).toContainText('Its 3 events go too')
  await confirmDialog(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(session(page, 'Afternoon')).toBeVisible()
  await session(page, 'Afternoon')
    .getByRole('button', { name: 'Delete Afternoon' })
    .click()
  await confirmDialog(page).getByRole('button', { name: 'Delete' }).click()
  await expect(session(page, 'Afternoon')).toHaveCount(0)

  // A dance with age groups on it asks too.
  const firstRow = primaryEvent.locator('[data-row]').first()
  await firstRow.locator('[data-chip=dance]').hover()
  await firstRow.getByRole('button', { name: /^Remove Highland Fling/ }).click()
  await expect(confirmDialog(page)).toContainText(
    'Its age groups and judges on each platform go too',
  )
  await confirmDialog(page).getByRole('button', { name: 'Delete' }).click()
  await expect(primaryEvent.locator('[data-row]')).toHaveCount(3)

  // Undo twice brings both back.
  await (await barMenuItem(page, /^Undo: /)).click()
  await expect(primaryEvent.locator('[data-row]')).toHaveCount(4)
  await (await barMenuItem(page, /^Undo: /)).click()
  await expect(session(page, 'Afternoon')).toBeVisible()
  await expect(await barMenuItem(page, /^Redo: Deleted Afternoon/)).toBeEnabled()
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})

test('several days: add, name, date and delete one', async ({ page }) => {
  const errors = collectErrors(page)
  await openBuilder(page)
  await addSession(page, 'Morning')
  // One day: no tabs.
  await expect(page.getByRole('navigation', { name: 'Days' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Add day' }).click()
  const tabs = page.getByRole('navigation', { name: 'Days' })
  await expect(tabs.getByRole('link')).toHaveCount(2)
  await expect(tabs.getByRole('link').nth(1)).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('Start with a session')).toBeVisible()
  await addSession(page, 'Championship', true)

  const days = async () =>
    sorted((await data<Schedule>('schedule')).days).map(([id, d]) => ({
      id,
      name: d.name,
      date: d.date,
      order: d.order,
      blocks: sorted(d.blocks).map(([, b]) => b.name),
    }))
  const weekday = (iso: string) =>
    page.evaluate(
      (d) =>
        new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(
          new Date(`${d}T12:00`),
        ),
      iso,
    )
  await expect
    .poll(days)
    .toEqual([
      expect.objectContaining({
        name: await weekday(comp.days[0]),
        date: comp.days[0],
        order: 0,
        blocks: ['Morning'],
      }),
      expect.objectContaining({
        name: await weekday(comp.days[1]),
        date: comp.days[1],
        order: 1,
        blocks: ['Championship'],
      }),
    ])

  // Rename the second day and change its date.
  await page.getByRole('button', { name: /^Day name: / }).click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Finals day')
  await page.keyboard.press('Enter')
  await page.getByLabel('Date of Finals day').fill('2030-06-02')
  await expect
    .poll(async () => (await days())[1])
    .toEqual(expect.objectContaining({ name: 'Finals day', date: '2030-06-02' }))
  await expect(tabs.getByRole('link', { name: 'Finals day' })).toBeVisible()

  // The public pages name the days.
  await page.goto(`/competitions/${comp.id}/schedule`)
  await expect(page.getByRole('heading', { name: 'Finals day' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: await weekday(comp.days[0]) }),
  ).toBeVisible()

  // Delete the day (it has a session, so it asks), back to one day.
  await openBuilder(page)
  await page
    .getByRole('navigation', { name: 'Days' })
    .getByRole('link', { name: 'Finals day' })
    .click()
  await page.getByRole('button', { name: 'Delete Finals day' }).click()
  await expect(confirmDialog(page)).toContainText('Its session goes too')
  await confirmDialog(page).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('navigation', { name: 'Days' })).toHaveCount(0)
  await expect(session(page, 'Morning')).toBeVisible()
  await expect.poll(async () => (await days()).length).toBe(1)
  expect(errors).toEqual([])
})

test('bad inputs: long and emoji names, no or many platforms, deleted age groups, judges and platforms', async ({
  page,
}, info) => {
  test.slow()
  const errors = collectErrors(page)
  const platforms = await data<Record<string, unknown>>('platforms')
  const groups = await data<Record<string, unknown>>('groups')
  const staff = await data<Record<string, unknown>>('staff')
  const categories = await data<Record<string, unknown>>('categories')
  try {
    await set(
      dataPath(`categories/${comp.id}-cat-pri/name`),
      'Primary Highland Dancers From All Over The Province 🌟',
    )
    await openBuilder(page)
    const long = `Premier Championship ${'and Very Long Session Name '.repeat(6).trim()} 🏴󠁧󠁢󠁳󠁣󠁴󠁿💃`
    await addSession(page, long, true)
    await expectNoSideScroll(page)
    // The autofill menu names categories: it fits the screen, however long they are.
    await session(page, long).getByRole('button', { name: 'Add event' }).click()
    await expect(page.getByRole('option', { name: 'Results', exact: true })).toBeVisible()
    await expectNoSideScroll(page)
    await page.getByRole('option', { name: 'Results', exact: true }).click()
    await page.keyboard.press('Escape')
    await event(page, 'Results').getByRole('button', { name: 'Autofill' }).click()
    await expect(
      page.getByRole('menuitem', { name: /^Place Primary Highland/ }),
    ).toBeVisible()
    await expectNoSideScroll(page)
    const menu = (await page.getByRole('menu').boundingBox())!
    expect(menu.x).toBeGreaterThanOrEqual(0)
    expect(menu.x + menu.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    await page.keyboard.press('Escape')

    // The seeded schedule (two days, two platforms, groups and judges on
    // them), with the kind of long notes old competitions have.
    const note =
      'Any Primary dancer aged 4, 5 or 6 wishing to practise a competition may take part in this non-judged event. '.repeat(
        6,
      )
    await set(dataPath('schedule'), seeded)
    await set(
      dataPath(
        `schedule/days/${comp.id}-day1/blocks/${comp.id}-b1/events/${comp.id}-e1/description`,
      ),
      note,
    )
    await set(
      dataPath(`schedule/days/${comp.id}-day1/blocks/${comp.id}-b1/description`),
      note,
    )
    await set(
      dataPath(
        `schedule/days/${comp.id}-day1/blocks/${comp.id}-b1/events/${comp.id}-e1/name`,
      ),
      `Primary ${'Championship '.repeat(12)}`,
    )
    await openBuilder(page)
    await expect(page.getByRole('navigation', { name: 'Days' })).toBeVisible()
    await expect(page.locator('[data-chip=group]').first()).toBeVisible()
    // Long names and notes wrap: the grid stays as wide as its platforms need.
    const grid = page
      .locator('section[data-block]')
      .first()
      .locator('xpath=ancestor::div[contains(@class,"overflow-auto")][1]')
    expect(await grid.evaluate((el) => el.scrollWidth)).toBeLessThan(1100)

    // Delete an age group, a judge and a platform the schedule uses, behind
    // the builder's back (as another device would).
    const g = comp.groups[0].id
    const j = comp.judges[0]
    await remove(dataPath(`groups/${g}`))
    await remove(dataPath(`staff/${j}`))
    await remove(dataPath(`platforms/${comp.platforms[1]}`))
    await expect(page.getByText('Unknown age group').first()).toBeVisible()
    await expect(page.getByText('Unknown judge').first()).toBeVisible()
    // Take the unknown age group off.
    const unknown = page
      .locator('[data-chip=group]', { hasText: 'Unknown age group' })
      .first()
    await unknown.hover()
    await unknown.getByRole('button', { name: 'Remove Unknown age group' }).click()
    await expect
      .poll(async () => JSON.stringify(await data('schedule')).split(`"${g}"`).length - 1)
      .toBeLessThan(JSON.stringify(seeded).split(`"${g}"`).length - 1)

    // The public pages skip what's gone.
    for (const path of [
      'schedule',
      `schedule/${Object.keys(seeded.days!)[0]}/${comp.id}-b1/${comp.id}-e1`,
    ]) {
      await page.goto(`/competitions/${comp.id}/${path}`)
      await expect(page.getByText(/Primary|Saturday/).first()).toBeVisible()
    }
    await expect(page.getByText('Platform B')).toHaveCount(0)

    // No platforms at all: the builder still lays out.
    await remove(dataPath('platforms'))
    await openBuilder(page)
    await expect(page.getByText('To fill in the schedule')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add platforms' })).toBeVisible()
    await expectNoSideScroll(page)

    // Twenty platforms.
    await set(
      dataPath('platforms'),
      Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [
          `${comp.id}-p${String(i).padStart(2, '0')}`,
          { name: String.fromCharCode(65 + i), _order: i },
        ]),
      ),
    )
    await openBuilder(page)
    await expect(page.getByText('T', { exact: true })).toHaveCount(1)
    await expectNoSideScroll(page)
    await page.screenshot({
      path: test.info().outputPath(`${info.project.name}-twenty-platforms.png`),
    })
  } finally {
    await set(dataPath('platforms'), platforms)
    await set(dataPath('groups'), groups)
    await set(dataPath('staff'), staff)
    await set(dataPath('categories'), categories)
  }
  expect(errors).toEqual([])
})

test('public schedule: spacers don’t hold back “Results in”; empty days aren’t a schedule', async ({
  page,
}) => {
  const errors = collectErrors(page)
  const [g1, g2] = comp.groups
    .filter((g) => g.categoryId.endsWith('-cat-pri'))
    .map((g) => g.id)
  const [d1] = comp.dances
  await set(dataPath('schedule'), {
    days: {
      day1: {
        order: 0,
        name: 'Saturday',
        blocks: {
          b1: {
            order: 0,
            name: 'Morning',
            events: {
              e1: {
                order: 0,
                name: 'Primary',
                dances: {
                  r1: {
                    order: 0,
                    danceId: d1.id,
                    platforms: {
                      [comp.platforms[0]]: {
                        orderedGroupIds: [g1, '1575433498638', g2, '-DeletedGroup'],
                        orderedJudgeIds: [comp.judges[0], '-DeletedJudge'],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  const results = await data('results')
  try {
    await set(dataPath(`results/${g1}/${d1.id}`), [
      comp.dancers.find((d) => d.groupId === g1)!.id,
    ])
    await set(dataPath(`results/${g2}/${d1.id}`), false)
    await page.goto(`/competitions/${comp.id}/schedule`)
    const primary = page.getByRole('link', { name: /Primary/ })
    await expect(primary).toBeVisible()
    // Both real age groups are in: a check, not "2 of 4".
    await expect(primary.getByText('Results in')).toBeAttached()
    await expect(primary.getByText(/of/)).toHaveCount(0)

    await primary.click()
    await expect(page.getByText('Platform A', { exact: true })).toBeVisible()
    await expect(page.locator('li').filter({ hasText: /\d+ dancers/ })).toHaveCount(2)

    // Every session deleted: the day is left, but there's no schedule to show.
    await set(dataPath('schedule'), { days: { day1: { order: 0, name: 'Saturday' } } })
    await page.goto(`/competitions/${comp.id}/schedule`)
    await expect(page.getByText('No schedule yet')).toBeVisible()

    // Hidden in Manage: it isn't coming.
    await set(dataPath('schedule'), false)
    await page.goto(`/competitions/${comp.id}/schedule`)
    await expect(page.getByText('No schedule here')).toBeVisible()
  } finally {
    await set(dataPath('results'), results)
  }
  expect(errors).toEqual([])
})

test('narrow phone: the builder and public pages fit 360px, light and dark', async ({
  browser,
}, info) => {
  test.skip(!isPhone(info), 'phone only')
  for (const colorScheme of ['light', 'dark'] as const) {
    const context = await browser.newContext({
      viewport: { width: 360, height: 740 },
      isMobile: true,
      hasTouch: true,
      colorScheme,
    })
    const page = await context.newPage()
    const errors = collectErrors(page)
    await signIn(page, email)
    await set(dataPath('schedule'), seeded)
    await openBuilder(page)
    await expect(page.locator('[data-chip=group]').first()).toBeVisible()
    await expectNoSideScroll(page)
    await page.screenshot({
      path: test.info().outputPath(`builder-360-${colorScheme}.png`),
    })
    await page.goto(`/competitions/${comp.id}/schedule`)
    await expect(page.getByRole('link', { name: /Primary/ })).toBeVisible()
    await expectNoSideScroll(page)
    await page.getByRole('link', { name: /Primary/ }).click()
    await expect(page.getByText('Platform A', { exact: true }).first()).toBeVisible()
    await expectNoSideScroll(page)
    await settle(page)
    await page.screenshot({
      path: test.info().outputPath(`event-360-${colorScheme}.png`),
      fullPage: true,
    })
    expect(errors).toEqual([])
    await context.close()
  }
})

test('legacy competitions read as before, on their day (read only)', { tag: '@seed' }, async ({ page }) => {
  const errors = collectErrors(page)
  // Nationals: three named days (one with an old ISO date), numeric spacers,
  // deleted age groups and judges still listed in places.
  await page.goto('/competitions/-L9Sc9TQWQclq_7oA3ij/schedule?now=2019-01-14')
  await expect(page.getByRole('heading', { name: 'Tuesday, July 3rd' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Saturday' })).toBeVisible()
  const event = page.getByRole('link', { name: /^Pre-Premier/ })
  await expect(event.getByText('Results in')).toBeAttached()
  await event.click()
  await expect(page.getByText('Tuesday, July 3rd · Morning', { exact: true })).toBeVisible()
  await expect(page.getByText(/8:00 am/).first()).toBeVisible()
  await expect(page.getByText(/^Platform \d+$/).first()).toBeVisible()
  await expect(page.getByText(/Platform Platform/)).toHaveCount(0)
  // One day: no day heading.
  await page.goto('/competitions/-L9O-hu-htXrSPqsEG8l/schedule?now=2018-07-02')
  await expect(page.getByRole('heading', { name: 'Morning' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Monday, July 2nd' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('on a phone, one platform at a time, and Add picks age groups and judges from a list', async ({
  page,
}, info) => {
  test.skip(!isPhone(info), 'phone layout')
  await set(dataPath('schedule'), seeded)
  await page.goto(`/competitions/${comp.id}/manage/schedule`)
  // Day 1's morning: Primary on A and B, in the first row (Highland Fling).
  const platformB = comp.platforms[1]
  const firstRow = () => event(page, 'Primary').locator('[data-row]').first()
  await expect(firstRow().locator('[data-chip=group]')).toHaveCount(1)
  // Platform B, then its cell's Add.
  await page.getByRole('group', { name: 'Platform' }).getByRole('button', { name: 'B', exact: true }).click()
  await firstRow().getByRole('button', { name: 'Add age groups or judges to Platform B' }).click()
  const sheet = page.locator('dialog[open]')
  // Already on A: it says so, and ticking it puts it on B too.
  const under7 = sheet.getByRole('checkbox', { name: /^Primary Under 7/ })
  await expect(under7).toContainText('On Platform A')
  await under7.click()
  await sheet.getByRole('checkbox', { name: /^Deborah Wardrope/ }).click()
  await expect(sheet.getByRole('checkbox', { name: /^Deborah Wardrope/ })).toHaveAttribute('aria-checked', 'false')
  await sheet.getByRole('checkbox', { name: /^Iain Fraser/ }).click()
  await expect.poll(async () => {
    const [[, day]] = sorted((await data<Schedule>('schedule')).days)
    const [[, block]] = sorted(day.blocks)
    const [[, ev]] = sorted(block.events)
    const [[, row]] = sorted(ev.dances)
    return row.platforms?.[platformB]
  }).toEqual({ orderedGroupIds: [`${comp.id}-grp-01`, `${comp.id}-grp-00`], orderedJudgeIds: [`${comp.id}-judge-2`] })
})
