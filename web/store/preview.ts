/// <reference lib="dom" />
// `npm run store:preview`: an App Store preview, recorded from the demo app
// (Apple wants footage captured from the app itself). It opens on the real
// launch, Scott's split leap landing as the logo, then a result arrives
// live (the banner drops in and the medal flips), and it follows the banner
// to the results and on to the schedule. Needs the store stack
// (`npm run store:stack`). Writes store/out/preview/iphone.mp4: 886×1920,
// 30 fps, H.264, with the silent stereo track Apple requires.
//
// It's filmed frame by frame, not in real time: the page's clock (timers,
// animation frames, performance.now) is stepped 1/30 s at a time, every CSS
// animation is held to that clock, and each frame is a full-resolution
// screenshot. So it's sharp and plays the same every run, however long a
// frame takes to shoot.
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { chromium, type Page } from '@playwright/test'
import { APP_URL } from './stack.ts'
import { DEMO_DAY, DEMO_USER, TODAY_ID, dbGet, dbSet } from './demo.ts'
import { DEVICES } from './devices.ts'
import { statusBar } from './frame.ts'

const OUT = new URL('./out/preview/', import.meta.url).pathname
const FRAMES = `${OUT}frames/`
const FPS = 30
const STEP = 1000 / FPS
// The 6.9" preview's size, in points at 2×.
const VIEW = { width: 443, height: 960 }
const device = DEVICES.iphone
const GROUP = `${TODAY_ID}-grp-int-11`
const SEANN = `${TODAY_ID}-dance-seann`

rmSync(OUT, { recursive: true, force: true })
mkdirSync(FRAMES, { recursive: true })

// Isla's entry, and five others in her group, for the result that arrives live.
const dancers =
  (await dbGet<Record<string, { firstName: string; lastName: string; groupId: string }>>(
    `competitions:data/${TODAY_ID}/dancers`,
  )) ?? {}
const inGroup = Object.entries(dancers).filter(([, d]) => d.groupId === GROUP)
const isla = inGroup.find(
  ([, d]) => d.firstName === 'Isla' && d.lastName === 'Morrison',
)?.[0]
if (!isla) throw new Error('No Isla Morrison in the demo: is the store stack seeded?')
const placings = [
  isla,
  ...inGroup
    .map(([id]) => id)
    .filter((id) => id !== isla)
    .slice(0, 5),
]
const resultPath = `competitions:data/${TODAY_ID}/results/${GROUP}/${SEANN}`
await dbSet(resultPath, null)

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({
  viewport: VIEW,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'light',
  reducedMotion: 'no-preference',
  serviceWorkers: 'block',
  locale: 'en-CA',
  timezoneId: 'America/Edmonton',
})
// The phone around the app: the status bar and home indicator the app pads
// for, and the launch screen's plain background before the page paints.
const chrome =
  statusBar(device, 1) +
  `<div style="position:absolute;bottom:8px;left:50%;width:140px;height:5px;margin-left:-70px;border-radius:3px;background:#101828"></div>`
await context.addInitScript(
  ({ safe, chrome }) => {
    ;(window as unknown as { Capacitor: unknown }).Capacitor = {
      getPlatform: () => 'ios',
      Plugins: {},
    }
    document.documentElement.style.background = '#f2f4f7'
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent =
        `:root{--safe-area-inset-top:${safe.top}px;--safe-area-inset-bottom:${safe.bottom}px}` +
        '#crisp-chatbox,.crisp-client{display:none!important}*{caret-color:transparent!important}' +
        '#store-chrome{position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:-apple-system,system-ui}'
      document.head.append(style)
      const div = document.createElement('div')
      div.id = 'store-chrome'
      div.innerHTML = chrome
      document.body.append(div)
    })
  },
  { safe: device.safe, chrome },
)

// Sign in first, in a tab of its own (the account stays in IndexedDB).
{
  const page = await context.newPage()
  await page.goto(`${APP_URL}/?now=${DEMO_DAY}`)
  await page.goto(`${APP_URL}/profile`)
  const field = page.locator('dialog[open] input[name=password]')
  await field.waitFor()
  await page
    .locator('dialog[open]')
    .getByRole('textbox', { name: 'Email address' })
    .fill(DEMO_USER.email)
  await field.fill(DEMO_USER.password)
  await field.press('Enter')
  await page.locator('dialog[open]').waitFor({ state: 'detached' })
  await page.evaluate(() => {
    localStorage.removeItem('route-info')
    localStorage.removeItem('scroll-positions')
  })
  await page.close()
}

const page = await context.newPage()
// The page's clock, held still: time moves only when a frame is shot.
await page.clock.install()
await page.clock.pauseAt(Date.now() + 1000)

// Hold every CSS animation (transitions, the medal flip, page slides) to
// the page's clock: paused, and moved on by hand each frame.
async function syncAnimations(p: Page) {
  await p.evaluate(() => {
    const w = window as unknown as { __starts?: WeakMap<Animation, number> }
    w.__starts ??= new WeakMap()
    const now = performance.now()
    for (const a of document.getAnimations()) {
      let start = w.__starts.get(a)
      if (start === undefined) {
        start = now
        w.__starts.set(a, start)
        a.pause()
      }
      const t = now - start
      const end = Number(a.effect?.getComputedTiming().endTime ?? 0)
      if (Number.isFinite(end) && t >= end) a.finish()
      else a.currentTime = t
    }
  })
}

let frame = 0
async function shoot(seconds: number, each?: (i: number, n: number) => Promise<void>) {
  const n = Math.round(seconds * FPS)
  for (let i = 0; i < n; i++) {
    await page.clock.runFor(STEP)
    if (each) await each(i, n)
    await syncAnimations(page)
    await page.screenshot({
      path: `${FRAMES}${String(frame++).padStart(5, '0')}.jpg`,
      type: 'jpeg',
      quality: 93,
    })
  }
}

// Shoot until something's on screen (at least `min` seconds, at most 20).
async function shootUntil(min: number, ready: () => Promise<boolean>) {
  await shoot(min)
  for (let i = 0; i < 20 * FPS && !(await ready()); i++) await shoot(1 / FPS)
}
const competitionTab = (name: string) =>
  page.getByRole('navigation', { name: 'Competition' }).getByRole('link', { name })

// The launch: Scott's leap, landing as the logo, and Home.
await page.goto(`${APP_URL}/?now=${DEMO_DAY}`, { waitUntil: 'commit' })
await shootUntil(0.6, () => page.getByText('Good morning').first().isVisible())
await shoot(1.3)
// A result arrives: Isla's Seann Triubhas, 1st. The banner drops in, the medal flips.
await dbSet(resultPath, placings)
const banner = page.getByRole('status').getByText(/Isla placed 1st/)
await shootUntil(0.2, () => banner.isVisible())
await shoot(2.8)
// Follow the banner to the results.
await banner.tap()
await shoot(3.2)
// The schedule: where everyone's got to.
await competitionTab('Schedule').tap()
await shoot(3.2)
// And the competition at a glance: her dancers, and what's next.
await competitionTab('Overview').tap()
await shoot(4.6)
await browser.close()
await dbSet(resultPath, null)

execFileSync('ffmpeg', [
  '-y',
  '-loglevel',
  'error',
  '-framerate',
  String(FPS),
  '-i',
  `${FRAMES}%05d.jpg`,
  '-f',
  'lavfi',
  '-i',
  'anullsrc=channel_layout=stereo:sample_rate=44100',
  '-vf',
  'format=yuv420p',
  // A constant 11 Mbps: Apple asks for 10–12 (a mostly still screen would otherwise come out far lower).
  '-c:v',
  'libx264',
  '-profile:v',
  'high',
  '-level',
  '4.0',
  '-b:v',
  '11M',
  '-minrate',
  '11M',
  '-maxrate',
  '11M',
  '-bufsize',
  '11M',
  '-x264-params',
  'nal-hrd=cbr:force-cfr=1',
  '-c:a',
  'aac',
  '-b:a',
  '128k',
  '-shortest',
  `${OUT}iphone.mp4`,
])
console.log(`${frame} frames, ${(frame / FPS).toFixed(1)} s → ${OUT}iphone.mp4`)
