import { expect, test, type Page } from '@playwright/test'
import { dbSet, ensureUser, uid } from './support/emulator'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'
import { makePerson, signInFromSheet, type Person } from './support/parent'

// No signal in the hall: the app opens with what it saved last time, says
// so, and picks up live results when the signal comes back.

const OFFSET = Number(process.env.E2E_EMULATOR_PORT_OFFSET ?? 0)
const DB_PORT = 9009 + OFFSET

let comp: SeededCompetition
let person: Person
test.beforeAll(async () => {
  comp = await seedCompetition({ dancersPerGroup: 2 })
  person = await makePerson(comp, [comp.dancers.find((d) => d.groupId === comp.groups[2].id)!.id])
})
test.afterAll(async () => {
  await removeCompetition(comp.id)
  await person.remove()
})

/** Cut the page off from the database (not the page itself, which a phone has installed). */
async function signal(page: Page) {
  const state = { on: true }
  const db = new RegExp(`:${DB_PORT}/`)
  await page.routeWebSocket(db, (ws) => {
    if (state.on) ws.connectToServer()
    else ws.close()
  })
  await page.route(db, (route) => (state.on ? route.continue() : route.abort('internetdisconnected')))
  return state
}

test('opens with the last saved data, says so, and recovers live results', async ({ page }) => {
  test.setTimeout(120_000)
  const net = await signal(page)
  const email = `${uid('parent')}@example.test`
  const parentId = await ensureUser(email)
  await dbSet(`users:favorites/${parentId}/dancers/${person.id}`, person.name)

  await page.goto('/')
  await page.getByRole('main').getByRole('button', { name: 'Sign in', exact: true }).click()
  await signInFromSheet(page, email)
  const card = page.locator('article').filter({ hasText: person.name })
  await expect(card.getByRole('link', { name: /Highland Fling/ })).toContainText('Next')
  // Visit the competition too, so its pages are saved.
  await page.goto(`/competitions/${comp.id}/info`)
  await expect(page.getByRole('heading', { name: 'Your dancers here' })).toBeVisible()
  await page.goto('/')
  await expect(card).toBeVisible()

  // Signal gone; reopen the app.
  net.on = false
  await page.reload()
  await expect(card.getByRole('link', { name: /Highland Fling/ })).toContainText('Next', { timeout: 15_000 })
  const notice = page.getByRole('status').filter({ hasText: 'Offline' })
  await expect(notice).toContainText(/Offline · last updated \d/)
  await page.goto(`/competitions/${comp.id}/info`)
  await expect(page.getByRole('heading', { name: comp.name, level: 1 })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Your dancers here' })).toBeVisible()
  await page.goto('/')

  // Meanwhile the Fling is posted: 1st.
  const entryId = person.entries[0]
  await dbSet(`competitions:data/${comp.id}/results/${comp.groups[2].id}/${comp.dances[0].id}`, [entryId])

  // Signal back: the notice goes, and the placing arrives without a reload.
  net.on = true
  await expect(card.getByRole('img', { name: '1st place' })).toBeVisible({ timeout: 60_000 })
  await expect(notice).toHaveCount(0)
})
