import { expect, test, type Page } from '@playwright/test'
import { dbGet, dbRemove, dbSet, ensureUser, signIn, uid } from './support/emulator'
import { makePerson, sheet } from './support/parent'
import { removeCompetition, seedCompetition } from './support/seed'

// Push alerts (ADR 0006), for favourite dancers and competitions with alerts
// on (ADR 0008). In the emulator nothing is sent: each alert is written to
// notifications:log, which is what these read.

type Logged = { uid?: string; title?: string; body?: string; kind?: string; link?: string }
const logFor = async (who: string) =>
  Object.values((await dbGet<Record<string, Logged>>('notifications:log')) ?? {}).filter((m) => m.uid === who)

test.describe('the server', () => {
  test.skip(({ isMobile }) => isMobile, 'functions only: one layout is enough')

  test('a placing goes to the people with the dancer as a favourite, once it settles', async () => {
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

  test('a favourite with alerts turned off hears nothing, until they’re back on', async () => {
    test.setTimeout(90_000)
    const comp = await seedCompetition({ dancersPerGroup: 2, resultsForGroups: 0, uniqueNames: true })
    const [entry, rival] = comp.dancers.filter((d) => d.groupId === comp.groups[2].id)
    const person = await makePerson(comp, [entry.id], 'Ishbel')
    const parent = await ensureUser(`${uid('alerts-off')}@example.test`)
    try {
      await dbSet(`users/${parent}/alerts`, { enabled: true })
      await dbSet(`users:favorites/${parent}/dancers/${person.id}`, person.name)
      await dbSet(`users:alertsOff/${parent}/dancers/${person.id}`, true)
      await expect.poll(() => dbGet(`dancers:followers/${person.id}/${parent}`)).toBe(true)

      const results = `competitions:data/${comp.id}/results/${entry.groupId}/${comp.dances[0].id}`
      await dbSet(results, [entry.id, rival.id])
      // Well past the pause (5 s in the emulator): nothing came.
      await new Promise((r) => setTimeout(r, 12_000))
      expect(await logFor(parent)).toEqual([])

      // Back on: the next placing comes through.
      await dbRemove(`users:alertsOff/${parent}/dancers/${person.id}`)
      await dbSet(results, [rival.id, entry.id])
      await expect.poll(async () => (await logFor(parent)).map((m) => m.title), { timeout: 30_000 }).toEqual(['Ishbel placed 2nd'])
    } finally {
      await person.remove()
      await dbRemove(`users:favorites/${parent}`)
      await dbRemove(`users:alertsOff/${parent}`)
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

test('favouriting a dancer offers notifications; turning them on registers the phone, and Settings picks the kinds', async ({ page }) => {
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
    await page.getByRole('button', { name: `Favourite ${person.name}`, pressed: false }).click()
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
    await page.getByRole('button', { name: `Favourite ${person.name}`, pressed: false }).click()
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

// ADR 0008: favouriting a dancer turns their alerts on, and the bell beside
// it turns them off (they stay a favourite) and back on.
test('a favourite dancer’s alerts turn off and on from their page, and they stay a favourite', async ({ page }) => {
  test.setTimeout(90_000)
  const comp = await seedCompetition({ dancersPerGroup: 1, resultsForGroups: 0, uniqueNames: true })
  const person = await makePerson(comp, [comp.dancers[0].id], 'Eilidh')
  const email = `${uid('alerts-bell')}@example.test`
  const parent = await ensureUser(email)
  const favourite = (pressed: boolean) => page.getByRole('button', { name: `Favourite ${person.name}`, pressed })
  const bell = page.getByRole('button', { name: /^Alerts (on|off) for Eilidh$/ })
  try {
    await signIn(page, email)
    await page.goto(`/dancers/${person.id}/info`)
    // No bell until they're a favourite.
    await expect(favourite(false)).toBeVisible()
    await expect(bell).toHaveCount(0)

    await favourite(false).click()
    await expect(favourite(true)).toBeVisible()
    await expect(bell).toHaveAccessibleName('Alerts on for Eilidh')
    await expect(bell).toHaveText('Alerts')
    await expect.poll(() => dbGet(`users:favorites/${parent}/dancers/${person.id}`)).toBe(person.name)
    expect(await dbGet(`users:alertsOff/${parent}/dancers/${person.id}`)).toBeNull()

    // Off: still a favourite.
    await bell.click()
    await expect(bell).toHaveText('Alerts off')
    await expect.poll(() => dbGet(`users:alertsOff/${parent}/dancers/${person.id}`)).toBe(true)
    await expect(favourite(true)).toBeVisible()
    expect(await dbGet(`users:favorites/${parent}/dancers/${person.id}`)).toBe(person.name)

    // The Dancers page lists them with the star, and says so.
    await page.goto('/dancers')
    const row = page.getByRole('listitem').filter({ hasText: person.name })
    await expect(row).toContainText('Alerts off')
    await expect(row.getByRole('button', { name: `Favourite ${person.name}`, pressed: true })).toBeVisible()

    // Back on.
    await page.goto(`/dancers/${person.id}/info`)
    await expect(bell).toHaveText('Alerts off')
    await bell.click()
    await expect(bell).toHaveText('Alerts')
    await expect.poll(() => dbGet(`users:alertsOff/${parent}/dancers/${person.id}`)).toBeNull()

    // Off, then taken off favourites: nothing of them is left.
    await bell.click()
    await expect.poll(() => dbGet(`users:alertsOff/${parent}/dancers/${person.id}`)).toBe(true)
    await favourite(true).click()
    await expect(page.getByText(`Removed Eilidh from favourites`)).toBeVisible()
    await expect(bell).toHaveCount(0)
    await expect.poll(() => dbGet(`users:alertsOff/${parent}/dancers/${person.id}`)).toBeNull()
    expect(await dbGet(`users:favorites/${parent}/dancers/${person.id}`)).toBeNull()
  } finally {
    await person.remove()
    await dbRemove(`users:favorites/${parent}`)
    await dbRemove(`users:alertsOff/${parent}`)
    await removeCompetition(comp.id)
  }
})

test.describe('a competition’s alerts', () => {
  // A Canadian visitor, so the Competitions list shows the seeded one.
  test.use({ timezoneId: 'America/Edmonton' })

  test('Alerts is its only button: it offers notifications, and lists say “Alerts on”', async ({ page }) => {
    test.setTimeout(90_000)
    const comp = await seedCompetition({ dancersPerGroup: 1, resultsForGroups: 0, uniqueNames: true, startOffset: 3 })
    const email = `${uid('alerts-comp')}@example.test`
    const parent = await ensureUser(email)
    await fakePhone(page)
    try {
      await signIn(page, email)
      await page.goto(`/competitions/${comp.id}/info`)
      const alerts = page.getByRole('main').getByRole('button', { name: /^Alerts/ })
      await expect(alerts).toHaveText('Alerts')
      await expect(alerts).toHaveAttribute('aria-pressed', 'false')
      // Nothing to favourite on a competition.
      await expect(page.getByRole('main').getByRole('button', { name: 'Favourite', exact: true })).toHaveCount(0)

      await alerts.click()
      await expect(sheet(page)).toContainText('Know when the dancer list is up')
      await expect(sheet(page)).toContainText(`${comp.name} is live`)
      await sheet(page).getByRole('button', { name: 'Not now' }).click()
      await expect(sheet(page)).toHaveCount(0)
      await expect(alerts).toHaveText('Alerts on')
      await expect(alerts).toHaveAttribute('aria-pressed', 'true')
      await expect.poll(() => dbGet(`users:favorites/${parent}/competitions/${comp.id}`)).toBeTruthy()
      await expect.poll(() => dbGet(`competitions:followers/${comp.id}/${parent}`)).toBe(true)

      await page.goto('/competitions')
      const row = page.getByRole('link', { name: new RegExp(comp.name) })
      await expect(row).toContainText('Alerts on')
    } finally {
      await dbRemove(`users:favorites/${parent}`)
      await removeCompetition(comp.id)
    }
  })
})
