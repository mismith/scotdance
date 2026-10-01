import { expect as baseExpect, test, type Page } from '@playwright/test'
import { dbUpdate, uid } from './support/emulator'
import { retry } from './support/retry'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'

// The dev server is shared and busy during a full run: give page loads time.
const expect = baseExpect.configure({ timeout: 15_000 })

// Organisers' descriptions are shown as rich text (v-html) on the
// competition, schedule, event and staff screens. Nothing in them may run,
// and plain text (ampersands!) must read as typed. DOMPurify needs a real
// browser, so lib/sanitize is checked here rather than in a unit test.

type Sanitize = typeof import('../src/lib/sanitize')
const inBrowser = <T>(page: Page, fn: (m: Sanitize) => T) =>
  page.evaluate(async (src) => {
    const m = (await import('/src/lib/sanitize.ts')) as Sanitize
    return new Function('m', `return (${src})(m)`)(m)
  }, fn.toString()) as Promise<T>

test.describe('lib/sanitize', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/about')
  })

  test('strips everything that can run code', async ({ page }) => {
    const out = await inBrowser(page, (m) =>
      [
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)><circle /></svg>',
        '<script>alert(1)</script>Hi',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<p onclick="alert(1)" style="color:red">Hi</p>',
        '<a href="javascript:alert(1)">x</a>',
        '<a href="JaVaScRiPt:alert(1)">x</a>',
        '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
        '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
        '<form action="https://evil.example"><input name="pw"></form>',
        '<style>body{display:none}</style>Hi',
      ].map((s) => m.sanitizeRichText(s)),
    )
    expect(out).toEqual([
      '',
      '',
      'Hi',
      '',
      '<p>Hi</p>',
      '<a target="_blank" rel="noopener noreferrer">x</a>',
      '<a target="_blank" rel="noopener noreferrer">x</a>',
      '<a target="_blank" rel="noopener noreferrer">x</a>',
      '',
      '',
      'Hi',
    ])
  })

  test('keeps formatting and links, and opens links safely in a new tab', async ({ page }) => {
    const out = await inBrowser(page, (m) => [
      m.sanitizeRichText('<p><strong>Bold</strong> and <em>italic</em></p>'),
      m.sanitizeRichText('<a href="http://highlandinstyle.ca" target="_self" class="ext">Site</a>'),
      m.sanitizeRichText('<a href="mailto:entries@example.com">Email</a>'),
      m.sanitizeRichText('Line one\nLine two & three'),
      m.sanitizeRichText('<p>One</p>\n<p>Two</p>'),
    ])
    expect(out).toEqual([
      '<p><strong>Bold</strong> and <em>italic</em></p>',
      '<a href="http://highlandinstyle.ca" target="_blank" rel="noopener noreferrer">Site</a>',
      '<a href="mailto:entries@example.com" target="_blank" rel="noopener noreferrer">Email</a>',
      'Line one<br>Line two &amp; three',
      '<p>One</p>\n<p>Two</p>',
    ])
  })

  test('one-line previews are plain text: no tags, no &amp;', async ({ page }) => {
    const out = await inBrowser(page, (m) => [
      m.stripTags('Fling & Sword'),
      m.stripTags('<b>Morning</b> session'),
      m.stripTags('8:30 am<br>Doors open'),
      m.stripTags('<p>First</p><p>Second</p>'),
      m.stripTags('<img src=x onerror=alert(1)>Hi'),
      m.stripTags(''),
    ])
    expect(out).toEqual(['Fling & Sword', 'Morning session', '8:30 am\nDoors open', 'First\nSecond\n', 'Hi', ''])
  })
})

test.describe('organiser text on the competition screens', () => {
  test.describe.configure({ mode: 'serial' })
  let comp: SeededCompetition
  const id = uid('xss')
  const xss = (n: number) => `window.__xss=${n}`

  test.beforeAll(async () => {
    comp = await retry(() => seedCompetition({ id, dancersPerGroup: 1, resultsForGroups: 0 }))
    await retry(() =>
      dbUpdate(`competitions/${id}`, {
        description: `<img src=x onerror="${xss(1)}">Welcome & enjoy <a href="javascript:${xss(2)}">bad link</a> <a href="https://example.com">good link</a>\nSecond line`,
      }),
    )
    const day = `competitions:data/${id}/schedule/days/${id}-day1`
    await retry(() => dbUpdate(day, { description: `<svg onload="${xss(3)}"></svg>Day one & all` }))
    await retry(() => dbUpdate(`${day}/blocks/${id}-b1`, { description: '8:30 am & on<br>Doors at 8' }))
    await retry(() => dbUpdate(`${day}/blocks/${id}-b1/events/${id}-e1`, { description: `Fling & Sword<script>${xss(4)}</script>` }))
    await retry(() =>
      dbUpdate(`${day}/blocks/${id}-b1/events/${id}-e1/dances/${id}-e1-d0`, {
        description: `<iframe src="javascript:${xss(5)}"></iframe>Steps & more`,
      }),
    )
  })
  test.afterAll(async () => {
    await retry(() => removeCompetition(id))
  })

  async function expectNothingRan(page: Page) {
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => (window as Window & { __xss?: number }).__xss)).toBeUndefined()
    // (Firebase Auth adds its own iframe on phones, outside the page content.)
    await expect(page.locator('main').locator('[onerror], [onload], script, iframe, a[href^="javascript"]')).toHaveCount(0)
  }

  test('the competition description', async ({ page }) => {
    await page.goto(`/competitions/${comp.id}/info`)
    await expect(page.getByText(/Welcome & enjoy/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'good link' })).toHaveAttribute('target', '_blank')
    await expectNothingRan(page)
  })

  test('the schedule, its times and event previews', async ({ page }) => {
    await page.goto(`/competitions/${comp.id}/schedule`)
    await expect(page.getByText('Day one & all')).toBeVisible()
    await expect(page.getByText('8:30 am & on', { exact: true })).toBeVisible()
    await expect(page.getByText('Fling & Sword', { exact: true })).toBeVisible()
    await expect(page.getByText(/&amp;/)).toHaveCount(0)
    await expectNothingRan(page)
  })

  test('an event and its dances', async ({ page }) => {
    await page.goto(`/competitions/${comp.id}/schedule/${id}-day1/${id}-b1/${id}-e1`)
    await expect(page.getByText('Fling & Sword', { exact: true })).toBeVisible()
    await expect(page.getByText('Steps & more')).toBeVisible()
    await expectNothingRan(page)
  })
})
