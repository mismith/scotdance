import { expect, test, type Page } from '@playwright/test'
import { dbGet, dbRemove, dbSet, ensureUser, signIn, uid } from './support/emulator'
import { makePerson, sheet } from './support/parent'
import { removeCompetition, seedCompetition } from './support/seed'

// Push alerts (ADR 0006). In the emulator nothing is sent: each alert is
// written to notifications:log, which is what these read.

type Logged = { uid?: string; title?: string; body?: string; kind?: string; link?: string }
const logFor = async (who: string) =>
  Object.values((await dbGet<Record<string, Logged>>('notifications:log')) ?? {}).filter((m) => m.uid === who)

test.describe('the server', () => {
  test.skip(({ isMobile }) => isMobile, 'functions only: one layout is enough')

  test('a placing goes to the people following the dancer, once it settles', async () => {
    test.setTimeout(90_000)
    const comp = await seedCompetition({ dancersPerGroup: 2, resultsForGroups: 0, uniqueNames: true })
    const [entry, rival] = comp.dancers.filter((d) => d.groupId === comp.groups[2].id)
    const person = await makePerson(comp, [entry.id], 'Isla')
    const parent = await ensureUser(`${uid('alerts-parent')}@example.test`)
    try {
      await dbSet(`users/${parent}/alerts`, { enabled: true })
      await dbSet(`users:favorites/${parent}/dancers/${person.id}`, person.name)
      await expect.poll(() => dbGet(`dancers:followers/${person.id}/${parent}`)).toBe(true)

      const results = `competitions:data/${comp.id}/results/${entry.groupId}/${comp.dances[0].id}`
      await dbSet(results, [entry.id, rival.id])
      await expect.poll(async () => (await logFor(parent)).map((m) => m.title), { timeout: 30_000 }).toEqual(['Isla placed 1st'])
      const [alert] = await logFor(parent)
      expect(alert.kind).toBe('results')
      expect(alert.body).toMatch(new RegExp(`^Highland Fling · .+ · ${comp.name}$`))
      expect(alert.link).toBe(`/competitions/${comp.id}/results/${entry.groupId}#dance-${comp.dances[0].id}`)

      // Changed and changed back within the pause: no new alert, since
      // only the placing it settles on is sent.
      await dbSet(results, [rival.id, entry.id])
      await dbSet(results, [entry.id, rival.id])
      await new Promise((r) => setTimeout(r, 12_000))
      expect((await logFor(parent)).map((m) => m.title)).toEqual(['Isla placed 1st'])
    } finally {
      await person.remove()
      await dbRemove(`users:favorites/${parent}`)
      await dbRemove(`users/${parent}/alerts`)
      await removeCompetition(comp.id)
    }
  })
})

// The iOS app, with @capacitor-firebase/messaging standing in. With
// `tokenFails`, Firebase can't hand the phone a token (unreachable, say).
async function fakePhone(page: Page, { tokenFails = false } = {}) {
  await page.addInitScript((fails) => {
    const perm = () => (localStorage.getItem('e2e:perm') as string) || 'prompt'
    ;(window as unknown as { Capacitor: unknown }).Capacitor = {
      getPlatform: () => 'ios',
      Plugins: {
        FirebaseMessaging: {
          checkPermissions: async () => ({ receive: perm() }),
          requestPermissions: async () => {
            localStorage.setItem('e2e:perm', 'granted')
            return { receive: 'granted' }
          },
          getToken: async () => {
            if (fails) throw new Error('Firebase unreachable')
            return { token: 'e2e-fcm-token' }
          },
          deleteToken: async () => {},
          addListener: async () => ({ remove: () => {} }),
        },
      },
    }
  }, tokenFails)
}

test('following a dancer offers notifications; turning them on registers the phone, and Settings picks the kinds', async ({ page }) => {
  test.setTimeout(90_000)
  const comp = await seedCompetition({ dancersPerGroup: 1, resultsForGroups: 0, uniqueNames: true })
  const entry = comp.dancers[0]
  const person = await makePerson(comp, [entry.id], 'Morag')
  const email = `${uid('alerts-phone')}@example.test`
  const parent = await ensureUser(email)
  await fakePhone(page)
  try {
    await signIn(page, email)
    await page.goto(`/competitions/${comp.id}/dancers`)
    await page.getByRole('button', { name: `Follow ${person.name}` }).click()
    await expect(sheet(page)).toContainText('Know the moment Morag places')
    await sheet(page).getByRole('button', { name: 'Turn on notifications' }).click()
    await expect(page.getByText('Notifications on. Choose which kinds in Settings.')).toBeVisible()
    await expect.poll(async () => Object.values((await dbGet<Record<string, { token?: string }>>(`users:tokens/${parent}`)) ?? {}).map((t) => t.token)).toEqual(['e2e-fcm-token'])
    expect(await dbGet(`users/${parent}/alerts/enabled`)).toBe(true)

    await page.goto('/settings')
    await expect(page.getByRole('switch', { name: 'Notifications' })).toBeChecked()
    await page.getByRole('switch', { name: 'Morning of' }).click()
    await expect.poll(() => dbGet(`users/${parent}/alerts/morning`)).toBe(false)

    // Off for this phone: its token goes.
    await page.getByRole('switch', { name: 'Notifications' }).click()
    await expect.poll(() => dbGet(`users:tokens/${parent}`)).toBeNull()
  } finally {
    await person.remove()
    await dbRemove(`users:favorites/${parent}`)
    await dbRemove(`users/${parent}/alerts`)
    await dbRemove(`users:tokens/${parent}`)
    await removeCompetition(comp.id)
  }
})

test('when the phone can’t be registered, the sheet says so and closes, and nothing is saved', async ({ page }) => {
  test.setTimeout(90_000)
  const comp = await seedCompetition({ dancersPerGroup: 1, resultsForGroups: 0, uniqueNames: true })
  const person = await makePerson(comp, [comp.dancers[0].id], 'Kirsty')
  const email = `${uid('alerts-fail')}@example.test`
  const parent = await ensureUser(email)
  await fakePhone(page, { tokenFails: true })
  try {
    await signIn(page, email)
    await page.goto(`/competitions/${comp.id}/dancers`)
    await page.getByRole('button', { name: `Follow ${person.name}` }).click()
    await sheet(page).getByRole('button', { name: 'Turn on notifications' }).click()
    await expect(page.getByText('Notifications couldn’t be turned on. Try again from Settings.')).toBeVisible()
    await expect(sheet(page)).toHaveCount(0)
    expect(await dbGet(`users:tokens/${parent}`)).toBeNull()
  } finally {
    await person.remove()
    await dbRemove(`users:favorites/${parent}`)
    await dbRemove(`users/${parent}/alerts`)
    await removeCompetition(comp.id)
  }
})
