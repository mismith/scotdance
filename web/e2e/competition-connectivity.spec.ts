import { expect, test, type Page, type WebSocketRoute } from '@playwright/test'
import { dbSet } from './support/emulator'
import { removeCompetition, seedCompetition } from './support/seed'

// Keep the installed app reachable while cutting its database connection.
async function signal(page: Page, initial = true) {
  let online = initial
  const sockets = new Set<WebSocketRoute>()
  const database = new RegExp(
    `:${9009 + Number(process.env.E2E_EMULATOR_PORT_OFFSET ?? 0)}/`,
  )
  await page.routeWebSocket(database, (socket) => {
    if (!online) return socket.close()
    sockets.add(socket)
    socket.connectToServer()
  })
  await page.route(database, (route) =>
    online ? route.continue() : route.abort('internetdisconnected'),
  )
  return (value: boolean) => {
    online = value
    if (!online) {
      for (const socket of sockets) socket.close()
      sockets.clear()
    }
  }
}

test('drops the Live badge on disconnect and restores it without reloading', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const comp = await seedCompetition({ dancersPerGroup: 2 })
  try {
    const setSignal = await signal(page)
    await page.goto(`/competitions/${comp.id}/results`)
    const live = page.getByText('Live', { exact: true })
    const notice = page.locator('[data-offline-notice]')
    await expect(live).toBeVisible()
    setSignal(false)
    await expect(live).toHaveCount(0)
    await expect(notice).toBeVisible({ timeout: 10_000 })
    setSignal(true)
    await expect(live).toBeVisible({ timeout: 60_000 })
    await expect(notice).toHaveCount(0)
  } finally {
    await removeCompetition(comp.id)
  }
})

test('an uncached offline page explains the problem and recovers without reloading', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const comp = await seedCompetition({ dancersPerGroup: 2, startOffset: 14 })
  try {
    const setSignal = await signal(page, false)
    await page.goto(`/competitions/${comp.id}/dancers`)
    const unavailable = page.getByText(
      'This page isn’t available offline yet. It will try again when you’re connected.',
    )
    await expect(unavailable).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Competition not found', { exact: true })).toHaveCount(0)
    setSignal(true)
    await expect(page.getByRole('heading', { name: /^Dancers/ })).toBeVisible({
      timeout: 60_000,
    })
    await expect(unavailable).toHaveCount(0)
    await expect(page.getByText('Isla MacDonald', { exact: true }).first()).toBeVisible()
  } finally {
    await removeCompetition(comp.id)
  }
})

for (const startOffset of [0, 14]) {
  test(`publishing and unpublishing update an open competition (${startOffset === 0 ? 'today' : 'upcoming'})`, async ({
    page,
  }) => {
    const comp = await seedCompetition({
      dancersPerGroup: 2,
      startOffset,
      published: false,
    })
    try {
      await page.goto(`/competitions/${comp.id}/info`)
      const waiting = page.getByText(
        'Dancers, the schedule and results show here once they’re published.',
      )
      await expect(waiting).toBeVisible()
      await dbSet(`competitions/${comp.id}/published`, true)
      await expect(waiting).toHaveCount(0)
      await page
        .locator(`a[href="/competitions/${comp.id}/dancers"]:visible`)
        .first()
        .click()
      await expect(
        page.getByText('Isla MacDonald', { exact: true }).first(),
      ).toBeVisible()
      await dbSet(`competitions/${comp.id}/published`, false)
      await expect(page.getByText('Isla MacDonald', { exact: true })).toHaveCount(0)
      await dbSet(
        `competitions:data/${comp.id}/dancers/${comp.dancers[0].id}/firstName`,
        'Updated',
      )
      await dbSet(`competitions/${comp.id}/published`, true)
      await expect(
        page.getByText('Updated MacDonald', { exact: true }).first(),
      ).toBeVisible()
    } finally {
      await removeCompetition(comp.id)
    }
  })
}
