import { expect, test, type Page } from '@playwright/test'
import { dbGet, dbSet, ensureUser, uid } from './support/emulator'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'
import { makePerson, sheet, signInFromSheet, signOut, type Person } from './support/parent'
import { hasSidebar } from './support/nav'

// A parent's day: follow a dancer, see their day on Home on competition day,
// watch a placing arrive, choose their look (a colour, a tartan, one of their
// own from the loom), unfollow. Then the edges:
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
  await page.getByRole('main').getByRole('button', { name: 'Sign in', exact: true }).click()
  await signInFromSheet(page, email)
}

const card = (page: Page, p: Person) => page.locator('article').filter({ hasText: p.name })

/** On their page, their avatar opens a small menu: their colour and pattern, and Customise. */
async function lookMenu(page: Page, p: Person) {
  await page.getByRole('button', { name: `Choose ${p.firstName}’s look` }).click()
  return page.getByRole('dialog', { name: `${p.firstName}’s look` })
}
/** Following is one tap either way; stopping offers Undo. */
async function unfollow(page: Page, p: Person) {
  await page.getByRole('button', { name: `Following ${p.name}` }).click()
  await expect(page.getByText(`Stopped following ${p.firstName}`)).toBeVisible()
}

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
  // Competition day: the competition, with the dancer's day under it.
  await expect(page.getByRole('heading', { name: new RegExp(`${comp.name}.*Today`) })).toBeVisible()
  // No guess at what's on now: plenty of competitions post nothing until the end.
  await expect(page.getByText(/dances next/)).toHaveCount(0)
  const day = card(page, person)
  await expect(day.getByLabel('Number 107')).toBeVisible()
  await expect(day.getByText('Beginner Under 7', { exact: true })).toBeVisible()
  // Each dance still to come, in facts from the schedule: the platform and
  // 3rd in the draw.
  // (In the list of dances still to come: once placed, a dance's rosette is
  // in the card's header instead.)
  const fling = day.getByRole('listitem').getByRole('link', { name: /Highland Fling \(4\)/ })
  await expect(fling).toContainText('Platform A')
  await expect(fling).toContainText('3rd to dance')
  await expect(fling).not.toContainText('Next')

  // The organiser posts the Fling: 2nd. Home pins it on as a rosette without
  // a reload, and the Fling leaves the dances still to come.
  const g = comp.groups[2].id
  await dbSet(`competitions:data/${comp.id}/results/${g}/${comp.dances[0].id}`, [entry(2, 1).id, entry(2).id])
  await expect(day.getByRole('img', { name: /^Highland Fling.*: 2nd place$/ })).toBeVisible()
  await expect(fling).toHaveCount(0)
  const sword = day.getByRole('listitem').getByRole('link', { name: /Sword Dance/ })

  // A late change to the draw shows up too.
  await dbSet(`competitions:data/${comp.id}/draws/${g}/${comp.dances[1].id}`, ['107', '108'])
  await expect(sword).toContainText('1st to dance')

  // Unfollow from their page: Home goes back to the pitch, with them under
  // Recently viewed rather than Your dancers.
  await page.goto(`/dancers/${person.id}/info`)
  await unfollow(page, person)
  await expect(page.getByRole('button', { name: `Follow ${person.name}` })).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'See your dancer’s day at a glance' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your dancers' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Recently viewed' })).toBeVisible()
  await expect(page.getByRole('heading', { name: new RegExp(`${comp.name}.*Today`) })).toHaveCount(0)
})

test('on competition day, whoever has dances to come comes first, and a finished day folds to its placings', async ({ page }) => {
  // Primary 7 & 8 has every result in; Premier dances later today.
  const done = await makePerson(comp, [entry(1).id], 'Isla')
  const next = await makePerson(comp, [entry(8).id], 'Skye')
  people.push(done, next)
  const parent = await freshParent()
  await dbSet(`users:favorites/${parent.uid}/dancers`, { [done.id]: done.name, [next.id]: next.name })

  await signInFromHome(page, parent.email)
  const days = page.locator('main article')
  await expect(days.first()).toContainText(next.name)
  await expect(days.nth(1)).toContainText(done.name)
  // Finished: the bib and its rosettes, no dances still to come.
  await expect(card(page, done).getByRole('img', { name: /place/ }).first()).toBeVisible()
  await expect(card(page, done).getByRole('link')).toHaveCount(1)
  await expect(card(page, next).getByRole('link', { name: /Highland Fling/ })).toBeVisible()
})

test('a chosen colour sticks, and stays with that account', async ({ page }) => {
  const person = await follow(4)
  const a = await freshParent()
  const b = await freshParent()
  await dbSet(`users:favorites/${a.uid}/dancers/${person.id}`, person.name)
  await dbSet(`users:favorites/${b.uid}/dancers/${person.id}`, person.name)

  await signInFromHome(page, a.email)
  await page.goto(`/dancers/${person.id}/info`)
  const picker = (await lookMenu(page, person)).getByRole('radiogroup', { name: `${person.firstName}’s colour` })
  // The first dancer you follow is red until you choose.
  await expect(picker.getByRole('radio', { name: 'Red' })).toHaveAttribute('aria-checked', 'true')
  await picker.getByRole('radio', { name: 'Teal' }).click()
  await expect(picker.getByRole('radio', { name: 'Teal' })).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => dbGet(`users:dancerColors/${a.uid}/${person.id}`)).toBe('dancer-6')
  await page.reload()
  await lookMenu(page, person)
  await expect(page.getByRole('radio', { name: 'Teal' })).toHaveAttribute('aria-checked', 'true')

  // The next account on this phone has its own colours.
  await signOut(page)
  await page.getByRole('main').getByRole('button', { name: 'Sign in', exact: true }).click()
  await signInFromSheet(page, b.email)
  await page.goto(`/dancers/${person.id}/info`)
  await lookMenu(page, person)
  await expect(page.getByRole('radio', { name: 'Red' })).toHaveAttribute('aria-checked', 'true')
})

test('a tartan: pick a pattern, then make it your own on the loom', async ({ page }) => {
  const person = await follow(3)
  const a = await freshParent()
  await dbSet(`users:favorites/${a.uid}/dancers/${person.id}`, person.name)
  const look = () => dbGet(`users:dancerColors/${a.uid}/${person.id}`)

  await signInFromHome(page, a.email)
  await page.goto(`/dancers/${person.id}/info`)
  const menu = await lookMenu(page, person)
  // A pattern is woven in their colour, and a new colour keeps the pattern.
  await menu.getByRole('radiogroup', { name: `${person.firstName}’s pattern` }).getByRole('radio', { name: 'Reel' }).click()
  await expect.poll(look).toEqual({ color: 'dancer-1', sett: 'P16 K16', colors: { P: '#b0102c' } })
  await menu.getByRole('radio', { name: 'Navy' }).click()
  await expect.poll(look).toEqual({ color: 'dancer-9', sett: 'P16 K16', colors: { P: '#14306b' } })

  // Customise: the loom, saving as you go.
  await menu.getByRole('button', { name: 'Customise' }).click()
  const loom = page.getByRole('dialog', { name: `${person.firstName}’s tartan` })
  await expect(loom.getByRole('img', { name: 'The tartan' })).toBeVisible()
  await loom.getByRole('button', { name: 'Add a stripe' }).click()
  // (In the colour that goes with navy: green.)
  await expect.poll(look).toEqual({ color: 'dancer-9', sett: 'P16 K16 A6', colors: { P: '#14306b', A: '#1d6a48' } })
  // The new stripe is chosen: make it a line in white.
  await loom.getByRole('radiogroup', { name: 'Width', exact: true }).getByRole('radio', { name: 'Line', exact: true }).click()
  await loom.getByRole('radiogroup', { name: 'Colour', exact: true }).getByRole('radio', { name: 'White', exact: true }).click()
  await expect.poll(look).toEqual({ color: 'dancer-9', sett: 'P16 K16 W2', colors: { P: '#14306b' } })
  // Arrow keys move the chosen stripe; Undo steps back one change at a time.
  await loom.getByRole('button', { name: /^Line in white, 3 of 3/ }).press('ArrowLeft')
  await expect.poll(look).toEqual({ color: 'dancer-9', sett: 'P16 W2 K16', colors: { P: '#14306b' } })
  await loom.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect.poll(look).toEqual({ color: 'dancer-9', sett: 'P16 K16 W2', colors: { P: '#14306b' } })
  // Painting the navy band gold leaves no navy, so their colour follows the cloth.
  await loom.getByRole('button', { name: /^Band in navy, 1 of 3/ }).click()
  await loom.getByRole('radiogroup', { name: 'Colour', exact: true }).getByRole('radio', { name: 'Gold', exact: true }).click()
  await expect.poll(look).toEqual({ color: 'dancer-4', sett: 'A16 K16 W2', colors: { A: '#b5800a' } })
  await loom.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(loom).toBeHidden()

  // Their own now: the menu says so, and Plain goes back to just the colour.
  const again = await lookMenu(page, person)
  await expect(again.getByText('Your own')).toBeVisible()
  await again.getByRole('radio', { name: 'Plain', exact: true }).click()
  await expect.poll(look).toBe('dancer-4')
})

test('the loom from a plain colour: nothing changes until you do, Undo goes back, drags work after a removal', async ({ page }) => {
  const person = await follow(7)
  const a = await freshParent()
  await dbSet(`users:favorites/${a.uid}/dancers/${person.id}`, person.name)
  await dbSet(`users:dancerColors/${a.uid}/${person.id}`, 'dancer-3')
  const look = () => dbGet(`users:dancerColors/${a.uid}/${person.id}`)

  await signInFromHome(page, a.email)
  await page.goto(`/dancers/${person.id}/info`)
  await (await lookMenu(page, person)).getByRole('button', { name: 'Customise' }).click()
  const loom = page.getByRole('dialog', { name: `${person.firstName}’s tartan` })
  // Just looking keeps them plain; the first change weaves the tartan.
  await expect(loom.getByText(`${person.firstName} stays plain until you change something here.`)).toBeVisible()
  expect(await look()).toBe('dancer-3')
  await loom.getByRole('button', { name: /^Line in white, 5 of 5/ }).click()
  await loom.getByRole('button', { name: 'Remove' }).click()
  await expect.poll(look).toEqual({ color: 'dancer-3', sett: 'P40 K16 S16 K2', colors: { P: '#6a3fa0', S: '#1d6a48' } })
  // With a stripe gone, the rest still drag: the field to the end.
  const field = loom.getByRole('button', { name: /^Field in purple, 1 of 4/ })
  const box = (await field.boundingBox())!
  const end = (await loom.getByRole('button', { name: /^Line in black, 4 of 4/ }).boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, { steps: 4 })
  await page.mouse.move(end.x + end.width + 8, end.y + end.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect.poll(look).toEqual({ color: 'dancer-3', sett: 'K16 S16 K2 P40', colors: { P: '#6a3fa0', S: '#1d6a48' } })
  // Undo all the way: back to plain purple.
  await loom.getByRole('button', { name: 'Undo', exact: true }).click()
  await loom.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect.poll(look).toBe('dancer-3')
  await expect(loom.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
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

  await page.getByRole('main').getByRole('button', { name: 'Sign in', exact: true }).click()
  await signInFromSheet(page, b.email)
  await expect(page.getByRole('heading', { name: 'See your dancer’s day at a glance' })).toBeVisible()
  await expect(card(page, person)).toHaveCount(0)
  await page.goto(`/competitions/${comp.id}/dancers/${entry(5).id}`)
  await expect(page.getByRole('button', { name: `Follow ${person.name}` })).toBeVisible()
})

test('following lots: Home shows the few that matter, and See all lists everyone', async ({ page }) => {
  // The third entry of seven age groups, which no other test here follows.
  const ps: Person[] = []
  for (let g = 0; g < 7; g++) ps.push(await follow(g, 2))
  const parent = await freshParent()
  await dbSet(`users:favorites/${parent.uid}/dancers`, Object.fromEntries(ps.map((p) => [p.id, p.name])))

  await signInFromHome(page, parent.email)
  const seeAll = page.getByRole('link', { name: 'See all 7' })
  await expect(seeAll).toBeVisible()
  const onHome = async () => (await Promise.all(ps.map((p) => page.getByText(p.name, { exact: true }).count()))).filter(Boolean).length
  await expect.poll(onHome).toBe(6)

  await seeAll.click()
  await expect(page).toHaveURL(/\/dancers$/)
  for (const p of ps) await expect(page.getByText(p.name, { exact: true }).first()).toBeVisible()
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
  await expect(page.locator('main article')).toHaveCount(1)
  await expect(page.getByText('Not entered in any listed competitions')).toHaveCount(0)

  await expect
    .poll(() => dbGet<Record<string, unknown>>(`users:favorites/${parentId}/oldDancers`))
    .toEqual({ [entry(6).id]: person.id })
  expect(await dbGet(`users:favorites/${parentId}/dancers`)).toEqual({ ...old, [person.id]: person.name })

  // Unfollowing sticks: the old key isn't copied again next time.
  await page.goto(`/dancers/${person.id}/info`)
  await unfollow(page, person)
  await expect(page.getByRole('button', { name: `Follow ${person.name}` })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: `Follow ${person.name}` })).toBeVisible()
  expect(await dbGet(`users:favorites/${parentId}/dancers`)).toEqual(old)
})

test('the new look is news only to people whose old favourites came over', async ({ page }) => {
  const person = await follow(9)
  const returning = await freshParent()
  await dbSet(`users:favorites/${returning.uid}`, { dancers: { [entry(9).id]: person.name } })
  const fresh = await freshParent()
  await dbSet(`users:favorites/${fresh.uid}/dancers/${person.id}`, person.name)
  const note = page.getByRole('note').filter({ hasText: 'ScotDance.app has a new look.' })

  // Not on competition day: a day with nothing on.
  await signInFromHome(page, returning.email)
  await page.goto('/?now=2031-02-01')
  await expect(note).toBeVisible()
  await note.getByRole('button', { name: 'Dismiss' }).click()
  await expect(note).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your dancers' })).toBeVisible()
  await expect(note).toHaveCount(0)

  await signOut(page)
  await page.evaluate(() => localStorage.removeItem('home:whatsNew:v4'))
  await page.getByRole('main').getByRole('button', { name: 'Sign in', exact: true }).click()
  await signInFromSheet(page, fresh.email)
  await page.goto('/?now=2031-02-01')
  await expect(page.getByRole('heading', { name: 'Your dancers' })).toBeVisible()
  await expect(note).toHaveCount(0)
  await page.goto('/?now=')
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
  await expect(page.getByRole('link', { name: /Highland Fling/ })).toContainText('2nd to dance')
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
  if (hasSidebar(page)) {
    // Wide screens: Sign in sits at the foot of the sidebar.
    await page.getByRole('complementary').getByRole('button', { name: 'Sign in', exact: true }).click()
  } else {
    await page.getByRole('navigation').getByRole('button', { name: 'Sign in and settings' }).click()
    await page.locator('dialog[open]').getByRole('button', { name: 'Sign in', exact: true }).click()
  }
  await signInFromSheet(page, email)
  await expect(page.getByRole('button', { name: `Follow ${person.name}` })).toBeVisible()
  await page.waitForTimeout(500)
  expect(await dbGet(`users:favorites/${parentId}`)).toBeNull()
})

test('a dancer link that’s out of date says so', async ({ page }) => {
  await page.goto(`/competitions/${comp.id}/dancers/not-a-dancer`)
  await expect(page.getByText('This dancer isn’t on the list any more.', { exact: false })).toBeVisible()
})
