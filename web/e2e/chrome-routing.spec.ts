import { expect as baseExpect, test } from '@playwright/test'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'
import { retry } from './support/retry'
import { uid } from './support/emulator'

// The dev server is shared and busy during a full run: give page loads time.
const expect = baseExpect.configure({ timeout: 15_000 })

// Old links (v3's hash router, still in every invite and approval email),
// redirects, and resuming where you left off on a cold launch.

test.describe('legacy #/ links', () => {
  test('a hash link to Competitions opens Competitions', async ({ page }) => {
    await page.goto('/#/competitions')
    await expect(page).toHaveURL(/\/competitions$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Competitions' })).toBeVisible()
  })

  test('a submission approval link lands on System admin', async ({ page }) => {
    await page.goto('/#/admin/submissions/sub-123')
    await expect(page).toHaveURL(/\/admin\/submissions\/sub-123$/)
  })

  test('a hash link keeps its query', async ({ page }) => {
    await page.goto('/#/competitions?view=calendar')
    await expect(page).toHaveURL(/\/competitions\?view=calendar$/)
  })
})

test.describe('old routes redirect', () => {
  for (const [from, to] of [
    ['/more', /\/settings$/],
    ['/policies/privacy', /\/policies$/],
    ['/policies/terms', /\/policies$/],
    ['/dancers/abc/results', /\/dancers\/abc\/info$/],
    ['/judges/abc/competitions', /\/judges\/abc\/info$/],
    ['/pipers/abc/results', /\/pipers\/abc\/info$/],
    ['/venues/abc/results', /\/venues\/abc\/info$/],
    ['/admin/info/whatever', /\/admin\/tools$/],
  ] as const) {
    test(`${from} redirects`, async ({ page }) => {
      const warnings: string[] = []
      page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()))
      await page.goto(from)
      await expect(page).toHaveURL(to)
      expect(warnings.filter((w) => w.includes('Discarded invalid param'))).toEqual([])
    })
  }
})

test.describe('the old app\'s competition links', () => {
  test.describe.configure({ mode: 'serial' })
  let comp: SeededCompetition
  const id = uid('routing')
  test.beforeAll(async () => {
    comp = await retry(() => seedCompetition({ id, dancersPerGroup: 1, resultsForGroups: 1 }))
  })
  test.afterAll(async () => {
    await retry(() => removeCompetition(id))
  })

  test('an invite email link opens the invite page', async ({ page }) => {
    await page.goto(`/#/competitions/${comp.id}/invites/inv-123`)
    await expect(page).toHaveURL(new RegExp(`/competitions/${comp.id}/invites/inv-123$`))
    await expect(page).toHaveTitle(/^Invitation/)
  })

  test('an old admin link lands in Manage', async ({ page }) => {
    await page.goto(`/#/competitions/${comp.id}/admin`)
    await expect(page).toHaveURL(new RegExp(`/competitions/${comp.id}/manage$`))
  })

  test('a dance\'s results open its age group at that dance', async ({ page }) => {
    const g = comp.groups[0].id
    const d = comp.dances[1].id
    await page.goto(`/competitions/${comp.id}/results/${g}/${d}`)
    await expect(page).toHaveURL(new RegExp(`/competitions/${comp.id}/results/${g}#dance-${d}$`))
    await expect(page.locator(`[id="dance-${d}"]`)).toBeInViewport()
  })

  test('the same link from an old #/ email works too', async ({ page }) => {
    const g = comp.groups[0].id
    const d = comp.dances[1].id
    await page.goto(`/#/competitions/${comp.id}/results/${g}/${d}`)
    await expect(page).toHaveURL(new RegExp(`/competitions/${comp.id}/results/${g}#dance-${d}$`))
  })

  test('a schedule day or session link opens the schedule', async ({ page }) => {
    await page.goto(`/competitions/${comp.id}/schedule/${comp.id}-day1`)
    await expect(page).toHaveURL(new RegExp(`/competitions/${comp.id}/schedule$`))
    await page.goto(`/competitions/${comp.id}/schedule/${comp.id}-day1/${comp.id}-b1`)
    await expect(page).toHaveURL(new RegExp(`/competitions/${comp.id}/schedule$`))
    await expect(page.getByRole('heading', { level: 1, name: 'Schedule' })).toBeVisible()
  })

  test('a link to one dance in an event opens the event', async ({ page }) => {
    const event = `${comp.id}-day1/${comp.id}-b1/${comp.id}-e1`
    await page.goto(`/competitions/${comp.id}/schedule/${event}/${comp.id}-e1-d0`)
    await expect(page).toHaveURL(new RegExp(`/competitions/${comp.id}/schedule/${event}$`))
  })
})

test.describe('cold launch', () => {
  test('in a browser tab, opening the address lands on Home', async ({ page }) => {
    await page.goto('/about')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
  })

  test.describe('the installed app', () => {
    // A home-screen web app on iOS reports navigator.standalone.
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }))
    })

    test('reopening soon after leaving resumes where you were', async ({ page }) => {
      await page.goto('/about')
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await page.goto('/')
      await expect(page).toHaveURL(/\/about$/)
    })

    test('reopening after a long break stays on Home', async ({ page }) => {
      await page.goto('/about')
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await page.evaluate(() => {
        const info = JSON.parse(localStorage.getItem('route-info') ?? '{}')
        info.$at = String(Date.now() - 3 * 60 * 60 * 1000)
        localStorage.setItem('route-info', JSON.stringify(info))
      })
      await page.goto('/')
      await expect(page).toHaveURL(/\/$/)
    })

    test('a signed-out link to Account stays on Home with sign-in open', async ({ page }) => {
      await page.goto('/about')
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await page.goto('/profile')
      await expect(page).toHaveURL(/\/$/)
      await expect(page.locator('dialog[open]')).toBeVisible()
      await expect(page.locator('dialog[open] input[name=password]')).toBeVisible()
    })

    test('an unknown page is never resumed', async ({ page }) => {
      await page.goto('/no/such/page')
      await expect(page.getByRole('heading', { name: 'This page isn’t here' })).toBeVisible()
      await page.goto('/')
      await expect(page).toHaveURL(/\/$/)
    })
  })

  test('a signed-out link to Account in a tab stays on Home with sign-in open', async ({ page }) => {
    await page.goto('/about')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('dialog[open] input[name=password]')).toBeVisible()
  })
})
