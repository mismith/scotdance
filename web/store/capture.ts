/// <reference lib="dom" />
// Screenshots of the demo app, as each device's store shots need them, in
// light and dark: the whole screen at its native pixels, with the status
// bar and home indicator areas left blank for the art to draw. Writes
// store/out/raw/<device>/<theme>/<scene>.png.
import { mkdirSync } from 'node:fs'
import { chromium, type Browser, type Page } from '@playwright/test'
import { APP_URL } from './stack.ts'
import { DEMO_DAY, DEMO_USER } from './demo.ts'
import { DEVICES, type Device } from './devices.ts'
import { SCENES, type Scene } from './scenes.ts'

export const RAW = new URL('./out/raw/', import.meta.url).pathname
export type Theme = 'light' | 'dark'
// The stores take one set per device (no dark variant), so: light.
export const THEMES: Theme[] = ['light']

export async function open(browser: Browser, device: Device, theme: Theme) {
  const context = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: device.scale,
    isMobile: device.id !== 'ipad',
    hasTouch: true,
    colorScheme: theme,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    locale: 'en-CA',
    timezoneId: 'America/Edmonton',
  })
  await context.addInitScript(
    ({ platform, safe, text }) => {
      // Be the native app (lib/native reads window.Capacitor at import).
      ;(window as unknown as { Capacitor: unknown }).Capacitor = {
        getPlatform: () => platform,
        Plugins: {},
      }
      // Pad for the status bar and home indicator, as the device would (style.css).
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style')
        style.textContent =
          `:root{--safe-area-inset-top:${safe.top}px;--safe-area-inset-bottom:${safe.bottom}px;font-size:${100 * text}%}` +
          // No support bubble or text cursor in a picture.
          '#crisp-chatbox,.crisp-client{display:none!important}*{caret-color:transparent!important}'
        document.head.append(style)
      })
    },
    { platform: device.platform, safe: device.safe, text: device.text ?? 1 },
  )
  const page = await context.newPage()
  // "Today" is the demo day, for the rest of this tab's session (lib/now).
  await page.goto(`${APP_URL}/?now=${DEMO_DAY}`)
  await signIn(page)
  return page
}

async function signIn(page: Page) {
  await page.goto(`${APP_URL}/profile`)
  // /profile needs an account: the app goes Home and opens the sheet.
  const field = page.locator('dialog[open] input[name=password]')
  await field.waitFor()
  await page
    .locator('dialog[open]')
    .getByRole('textbox', { name: 'Email address' })
    .fill(DEMO_USER.email)
  await field.fill(DEMO_USER.password)
  await field.press('Enter')
  await page.locator('dialog[open]').waitFor({ state: 'detached' })
}

/** Let the page finish: data in, fonts and images loaded, nothing moving. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      [...document.images].map((img) =>
        img.complete ? null : new Promise((r) => (img.onload = img.onerror = r)),
      ),
    )
  })
  await page.waitForTimeout(1200)
}

export async function capture(scene: Scene, page: Page, device: Device, theme: Theme) {
  const path = typeof scene.path === 'function' ? await scene.path() : scene.path
  // A cold start each time: no reopening the last page, no recents from the
  // shot before (the account is in IndexedDB, so it stays signed in).
  // Competitions everywhere, not just the phone's country: the demo parent is
  // Canadian, and today's competition is in Scotland.
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('competitions:location.mode', 'worldwide')
  })
  await page.goto(
    `${APP_URL}${path}${path.includes('?') ? '&' : '?'}now=${scene.now ?? DEMO_DAY}`,
  )
  await settle(page)
  if (scene.prepare) {
    await scene.prepare(page, device)
    await settle(page)
  }
  const dir = `${RAW}${device.id}/${theme}/`
  mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: `${dir}${scene.id}.png`, animations: 'disabled' })
}

/** Capture `ids` (every scene by default) on each of `devices`, light and dark. Ad-hoc paths ("/competitions") work too. */
export async function captureAll(
  devices: Device['id'][],
  ids: string[] = [],
  themes: Theme[] = THEMES,
) {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const id of devices) {
      const device = DEVICES[id]
      for (const theme of themes) {
        const page = await open(browser, device, theme)
        const scenes: Scene[] = ids.length
          ? ids.map(
              (x) =>
                SCENES.find((s) => s.id === x) ?? {
                  id: x.replace(/\W+/g, '_').replace(/^_|_$/g, '') || 'home',
                  path: x,
                },
            )
          : SCENES
        for (const scene of scenes) {
          if (scene.devices && !scene.devices.includes(id)) continue
          console.log(`  ${id} · ${theme} · ${scene.id}`)
          await capture(scene, page, device, theme)
        }
        await page.context().close()
      }
    }
  } finally {
    await browser.close()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const devices = args.filter((a): a is Device['id'] => a in DEVICES)
  const themes = args.filter((a): a is Theme => a === 'light' || a === 'dark')
  const rest = args.filter((a) => !(a in DEVICES) && a !== 'light' && a !== 'dark')
  await captureAll(
    devices.length ? devices : ['iphone'],
    rest,
    themes.length ? themes : THEMES,
  )
}
