import { expect, test, type Page } from '@playwright/test'
import { dbGet, dbSet, ensureUser, grantCompetition, signIn, uid } from './support/emulator'
import { retry } from './support/retry'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'

// Draws: the order dancers go up in each dance, stored as the old app did,
// draws/{group}/{dance} = ["dancer number", …].

// One competition for the file (seeding fans out into many triggers), and
// each test changes the draws of an age group of its own.
test.describe.configure({ mode: 'default' })
// The emulator can answer 503 for a moment while triggers fan out.
const put = (path: string, value: unknown) => retry(() => dbSet(path, value))

let comp: SeededCompetition
let email: string

test.beforeAll(async () => {
  const id = uid('comp')
  comp = await retry(() => seedCompetition({ id, dancersPerGroup: 10 }))
  email = `${uid('org')}@example.test`
  const user = await ensureUser(email)
  await retry(() => grantCompetition(user, comp.id))
})
test.afterAll(async () => {
  if (comp) await retry(() => removeCompetition(comp.id))
})

// Age groups with no draws seeded, one per test.
const GROUPS = ['20', '21', '22', '30', '31', '32']
let next = 0
function freshGroup() {
  const suffix = `-grp-${GROUPS[next++ % GROUPS.length]}`
  return comp.groups.find((g) => g.id.endsWith(suffix))!
}
const numbersOf = (groupId: string) => comp.dancers.filter((d) => d.groupId === groupId).map((d) => d.number)
const draw = (groupId: string, danceId: string) => dbGet<string[] | null>(`competitions:data/${comp.id}/draws/${groupId}/${danceId}`)
const open = (page: Page, groupId: string) => page.goto(`/competitions/${comp.id}/manage/groups/${groupId}/draws`)
const danceCard = (page: Page, name: string) => page.locator('section').filter({ has: page.getByRole('heading', { name, exact: true }) })

test('shuffle every dance, by number, clear, and undo', async ({ page }) => {
  const group = freshGroup()
  const numbers = numbersOf(group.id)
  const [fling, , , reel] = comp.dances
  await signIn(page, email)
  await open(page, group.id)

  await page.getByRole('button', { name: 'Shuffle every dance' }).click()
  await expect.poll(async () => [...((await draw(group.id, fling.id)) ?? [])].sort()).toEqual([...numbers].sort())
  // Reels are danced together, in number order.
  expect(await draw(group.id, reel.id)).toEqual(numbers)

  const card = danceCard(page, 'Highland Fling (4)')
  await card.getByRole('button', { name: 'By number' }).click()
  await expect.poll(() => draw(group.id, fling.id)).toEqual(numbers)
  await card.getByRole('button', { name: 'Clear' }).click()
  await expect.poll(() => draw(group.id, fling.id)).toBeNull()
  await expect(card.getByText('No draw set.')).toBeVisible()
  // The newest toast's Undo.
  await page.getByRole('button', { name: 'Undo', exact: true }).last().click()
  await expect.poll(() => draw(group.id, fling.id)).toEqual(numbers)

  await page.getByRole('button', { name: 'Clear all' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Clear all' }).click()
  await expect.poll(() => dbGet(`competitions:data/${comp.id}/draws/${group.id}`)).toBeNull()
})

test('numbers missing from a draw, or no longer in the age group', async ({ page }) => {
  const group = freshGroup()
  const numbers = numbersOf(group.id)
  const fling = comp.dances[0]
  await put(`competitions:data/${comp.id}/draws/${group.id}/${fling.id}`, ['999', numbers[2], numbers[0]])
  await signIn(page, email)
  await open(page, group.id)

  const card = danceCard(page, 'Highland Fling (4)')
  await expect(card.getByText('Not in this age group')).toBeVisible()
  await card.getByRole('button', { name: 'Take out' }).click()
  await expect.poll(() => draw(group.id, fling.id)).toEqual([numbers[2], numbers[0]])
  await card.getByRole('button', { name: 'Add to the end' }).click()
  await expect.poll(() => draw(group.id, fling.id)).toEqual([numbers[2], numbers[0], ...numbers.filter((n, i) => i !== 0 && i !== 2)])
})

test('drag a dancer by the handle to change the order', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Mouse drag')
  const group = freshGroup()
  const numbers = numbersOf(group.id)
  const fling = comp.dances[0]
  await put(`competitions:data/${comp.id}/draws/${group.id}/${fling.id}`, numbers)
  await signIn(page, email)
  await open(page, group.id)

  const rows = danceCard(page, 'Highland Fling (4)').getByRole('listitem')
  await rows.nth(0).locator('[data-handle]').dragTo(rows.nth(2))
  await expect.poll(async () => (await draw(group.id, fling.id))?.indexOf(numbers[0])).toBeGreaterThan(0)
  expect([...((await draw(group.id, fling.id)) ?? [])].sort()).toEqual([...numbers].sort())
})

test('on a phone, swiping the list scrolls it instead of reordering', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'Touch')
  const group = freshGroup()
  const numbers = numbersOf(group.id)
  await put(
    `competitions:data/${comp.id}/draws/${group.id}`,
    Object.fromEntries(comp.dances.map((d) => [d.id, numbers])),
  )
  await signIn(page, email)
  await open(page, group.id)
  const row = danceCard(page, 'Highland Fling (4)').getByRole('listitem').nth(4)
  await row.scrollIntoViewIfNeeded()
  const box = (await row.boundingBox())!
  const x = box.x + box.width * 0.6
  const y = box.y + box.height / 2
  const top = () => page.evaluate(() => document.scrollingElement!.scrollTop)
  const before = await top()

  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let i = 1; i <= 10; i += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 25 }] })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

  await expect.poll(top).toBeGreaterThan(before)
  expect(await draw(group.id, comp.dances[0].id)).toEqual(numbers)
})

test('the public schedule shows the draw', async ({ page }) => {
  // Beginner Under 7 has a seeded draw (numbers in reverse) in the Beginner event.
  const group = comp.groups.find((g) => g.id.endsWith('-grp-10'))!
  const order = numbersOf(group.id).reverse()
  await page.goto(`/competitions/${comp.id}/schedule/${comp.id}-day1/${comp.id}-b1/${comp.id}-e2`)
  await page.getByRole('button', { name: new RegExp(group.name) }).first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByText('Dancing order')).toBeVisible()
  await expect(sheet.getByRole('listitem').first()).toContainText(order[0])
  await expect(sheet.getByRole('listitem').nth(1)).toContainText(order[1])
})

test('a draw the old admin left with gaps still opens, and tidies up', async ({ page }) => {
  const group = freshGroup()
  const numbers = numbersOf(group.id)
  const fling = comp.dances[0]
  // Saved cell by cell: so sparse that it comes back as an object.
  await put(`competitions:data/${comp.id}/draws/${group.id}/${fling.id}`, { 1: numbers[1], 7: numbers[0] })
  await signIn(page, email)
  await open(page, group.id)

  const card = danceCard(page, 'Highland Fling (4)')
  await expect(card.getByRole('listitem')).toHaveCount(2)
  await card.getByRole('button', { name: 'Add to the end' }).click()
  await expect.poll(() => draw(group.id, fling.id)).toEqual([numbers[1], numbers[0], ...numbers.slice(2)])
})
