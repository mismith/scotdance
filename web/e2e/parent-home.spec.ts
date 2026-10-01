import { expect, test, type Page } from '@playwright/test'
import { dbGet, dbSet, ensureUser, uid } from './support/emulator'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'
import { makePerson, sheet, signInFromSheet, signOut, type Person } from './support/parent'

// A parent's day: follow a dancer, see their day on Home on competition day,
// watch a placing arrive, choose their colour, unfollow. Then the edges:
// switching accounts, old favourites from the previous app.
//
// One small competition (dated today) per worker; each test follows a dancer
// from its own age group, so tests don't trip over each other's results.

let comp: SeededCompetition
test.beforeAll(async () => {
  comp = await seedCompetition({ dancersPerGroup: 3 })
})
test.afterAll(async () => {
  await removeCompetition(comp.id)
})

/** The i-th entry in the g-th age group (groups in seeded order). */
const entry = (g: number, i = 0) => comp.dancers.filter((d) => d.groupId === comp.groups[g].id)[i]

const people: Person[] = []
test.afterEach(async () => {
  for (const p of people.splice(0)) await p.remove()
})
async function follow(g: number, i = 0) {
  const p = await makePerson(comp, [entry(g, i).id])
  people.push(p)
  return p
}

async function freshParent() {
  const email = `${uid('parent')}@example.test`
  return { email, uid: await ensureUser(email) }
}

async function signInFromHome(page: Page, email: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await signInFromSheet(page, email)
}

const card = (page: Page, p: Person) => page.locator('article').filter({ hasText: p.name })

test('follow a dancer, see their day on Home, and watch a placing arrive', async ({ page }) => {
  // Beginner Under 7: drawn, on platform A this morning, no results yet.
  // This entry is number 107, last of three to dance the Fling.
  const person = await follow(2)
  const { email, uid: parentId } = await freshParent()

  // Signed out, Follow asks you to sign in, naming the dancer…
  await page.goto(`/competitions/${comp.id}/dancers/${entry(2).id}`)
  await expect(page.getByRole('heading', { name: person.name })).toBeVisible()
  await page.getByRole('button', { name: `Follow ${person.name}` }).click()
  await expect(sheet(page).getByRole('heading', { name: `Sign in to follow ${person.firstName}` })).toBeVisible()
  await signInFromSheet(page, email)
  // …and the follow goes through once you have.
  await expect(page.getByRole('button', { name: `Following ${person.name}` })).toBeVisible({ timeout: 10_000 })
  // The button shows it at once; the save reaches the server a moment later.
  await expect.poll(() => dbGet(`users:favorites/${parentId}/dancers/${person.id}`)).toBe(person.name)

  await page.goto('/')
  // Competition day: the banner, and the dancer's day.
  await expect(page.getByRole('link', { name: new RegExp(`${person.firstName} is dancing`) })).toBeVisible()
  const day = card(page, person)
  await expect(day.getByLabel('Number 107')).toBeVisible()
  await expect(day.getByText('Beginner Under 7 · Platform A')).toBeVisible()
  const fling = day.getByRole('link', { name: /Highland Fling \(4\)/ })
  await expect(fling).toContainText('3rd to dance · group 1 of 2')
  await expect(fling).toContainText('Next')
  await expect(day.getByRole('link', { name: /Overall/ })).toContainText('After all dances')

  // The organiser posts the Fling: 2nd. Home updates without a reload.
  const g = comp.groups[2].id
  await dbSet(`competitions:data/${comp.id}/results/${g}/${comp.dances[0].id}`, [entry(2, 1).id, entry(2).id])
  await expect(fling.getByRole('img', { name: '2nd place' })).toBeVisible()
  const sword = day.getByRole('link', { name: /Sword Dance/ })
  await expect(sword).toContainText('Next')

  // A late change to the draw shows up too.
  await dbSet(`competitions:data/${comp.id}/draws/${g}/${comp.dances[1].id}`, ['107', '108'])
  await expect(sword).toContainText('1st to dance')

  // Unfollow from their page: Home goes back to the pitch, with them under
  // Recently viewed rather than Your dancers.
  await page.goto(`/dancers/${person.id}/info`)
  await page.getByRole('button', { name: `Following ${person.name}` }).click()
  await expect(page.getByRole('button', { name: `Follow ${person.name}` })).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'See your dancer’s day at a glance' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your dancers' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Recently viewed' })).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(`${person.firstName} is dancing`) })).toHaveCount(0)
})

test('a chosen colour sticks, and stays with that account', async ({ page }) => {
  const person = await follow(4)
  const a = await freshParent()
  const b = await freshParent()
  await dbSet(`users:favorites/${a.uid}/dancers/${person.id}`, person.name)
  await dbSet(`users:favorites/${b.uid}/dancers/${person.id}`, person.name)

  await signInFromHome(page, a.email)
  await page.goto(`/dancers/${person.id}/info`)
  const picker = page.getByRole('radiogroup', { name: `${person.firstName}’s colour` })
  // The first dancer you follow is red until you choose.
  await expect(picker.getByRole('radio', { name: 'Red' })).toHaveAttribute('aria-checked', 'true')
  await picker.getByRole('radio', { name: 'Teal' }).click()
  await expect(picker.getByRole('radio', { name: 'Teal' })).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => dbGet(`users:dancerColors/${a.uid}/${person.id}`)).toBe('dancer-6')
  await page.reload()
  await expect(page.getByRole('radio', { name: 'Teal' })).toHaveAttribute('aria-checked', 'true')

  // The next account on this phone has its own colours.
  await signOut(page)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await signInFromSheet(page, b.email)
  await page.goto(`/dancers/${person.id}/info`)
  await expect(page.getByRole('radio', { name: 'Red' })).toHaveAttribute('aria-checked', 'true')
})

test('signing out clears your dancers; the next account sees only its own', async ({ page }) => {
  const person = await follow(5)
  const a = await freshParent()
  const b = await freshParent()
  await dbSet(`users:favorites/${a.uid}/dancers/${person.id}`, person.name)

  await signInFromHome(page, a.email)
  await expect(card(page, person)).toBeVisible()

  await signOut(page)
  await expect(page.getByRole('heading', { name: 'See your dancer’s day at a glance' })).toBeVisible()
  await expect(card(page, person)).toHaveCount(0)

  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await signInFromSheet(page, b.email)
  await expect(page.getByRole('heading', { name: 'See your dancer’s day at a glance' })).toBeVisible()
  await expect(card(page, person)).toHaveCount(0)
  await page.goto(`/competitions/${comp.id}/dancers/${entry(5).id}`)
  await expect(page.getByRole('button', { name: `Follow ${person.name}` })).toBeVisible()
})

test('old favourites from the previous app: named ones follow the person, nothing is deleted', async ({ page }) => {
  const person = await follow(6)
  const { email, uid: parentId } = await freshParent()
  // As the old app stored them: per-competition entry ids, with the name
  // (newer) or just `true` (older).
  const old = {
    [entry(6).id]: person.name,
    [entry(6, 1).id]: true,
    '-LFzNaTIWXDQtzncmAL4': true,
  }
  await dbSet(`users:favorites/${parentId}`, { dancers: old, competitions: { [comp.id]: true } })

  await signInFromHome(page, email)
  // One card, for the person: no "Dancer" ghosts for the old keys.
  await expect(card(page, person)).toBeVisible()
  await expect(page.getByText('1 followed')).toBeVisible()
  await expect(page.getByText('Not entered in any listed competitions')).toHaveCount(0)

  await expect
    .poll(() => dbGet<Record<string, unknown>>(`users:favorites/${parentId}/oldDancers`))
    .toEqual({ [entry(6).id]: person.id })
  expect(await dbGet(`users:favorites/${parentId}/dancers`)).toEqual({ ...old, [person.id]: person.name })

  // Unfollowing sticks: the old key isn't copied again next time.
  await page.goto(`/dancers/${person.id}/info`)
  await page.getByRole('button', { name: `Following ${person.name}` }).click()
  await expect(page.getByRole('button', { name: `Follow ${person.name}` })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: `Follow ${person.name}` })).toBeVisible()
  expect(await dbGet(`users:favorites/${parentId}/dancers`)).toEqual(old)
})

test('the competition’s pages show your dancer’s day', async ({ page }) => {
  // Beginner 7 & 8: on platform A after Under 7, with a draw of its own.
  const person = await follow(3)
  const g = comp.groups[3].id
  await dbSet(`competitions:data/${comp.id}/draws/${g}/${comp.dances[0].id}`, ['111', '110', '112'])
  const { email, uid: parentId } = await freshParent()
  await dbSet(`users:favorites/${parentId}/dancers/${person.id}`, person.name)
  await signInFromHome(page, email)

  await page.goto(`/competitions/${comp.id}/info`)
  await expect(page.getByRole('heading', { name: 'Your dancers here' })).toBeVisible()
  await expect(page.locator('article').filter({ hasText: person.name }).getByLabel('Number 110')).toBeVisible()

  await page.goto(`/competitions/${comp.id}/dancers/${entry(3).id}`)
  await expect(page.getByRole('heading', { name: person.name })).toBeVisible()
  await expect(page.getByText('Beginner 7 & 8 Years')).toBeVisible()
  await expect(page.getByRole('link', { name: /Highland Fling/ })).toContainText('2nd of 3 to dance')
  await expect(page.getByRole('link', { name: `All competitions for ${person.firstName}` })).toBeVisible()

  // Dancers: only mine, and finding by number.
  await page.goto(`/competitions/${comp.id}/dancers`)
  await page.getByRole('switch', { name: 'Only my dancers' }).click()
  await expect(page.getByRole('link', { name: new RegExp(person.name) })).toHaveCount(1)
  await expect(page.locator('main li')).toHaveCount(1)
  await page.getByRole('switch', { name: 'Only my dancers' }).click()
  await page.getByRole('searchbox', { name: 'Search dancers by name or number' }).fill('110')
  await expect(page.locator('main li')).toHaveCount(1)
})

test('closing the sign-in sheet drops the follow it was opened for', async ({ page }) => {
  const person = await follow(7)
  const { email, uid: parentId } = await freshParent()
  await page.goto(`/competitions/${comp.id}/dancers/${entry(7).id}`)
  await page.getByRole('button', { name: `Follow ${person.name}` }).click()
  await expect(sheet(page).getByRole('heading', { name: `Sign in to follow ${person.firstName}` })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet(page)).toHaveCount(0)

  // Signing in later, for something else, doesn't follow them after all.
  await page.getByRole('navigation').getByRole('button', { name: 'Sign in and settings' }).click()
  await page.locator('dialog[open]').getByRole('button', { name: 'Sign in', exact: true }).click()
  await signInFromSheet(page, email)
  await expect(page.getByRole('button', { name: `Follow ${person.name}` })).toBeVisible()
  await page.waitForTimeout(500)
  expect(await dbGet(`users:favorites/${parentId}`)).toBeNull()
})

test('a dancer link that’s out of date says so', async ({ page }) => {
  await page.goto(`/competitions/${comp.id}/dancers/not-a-dancer`)
  await expect(page.getByText('This dancer isn’t on the list any more.', { exact: false })).toBeVisible()
})
