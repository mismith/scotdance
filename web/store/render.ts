/// <reference lib="dom" />
// The store shots from the captures: composes each device's strip, cuts it
// into slots, and saves them where the apps' projects keep them, in the
// folders fastlane reads (deliver for the App Store, supply for Google Play),
// so uploading is one command:
//   ios/App/fastlane/screenshots/en-US/iphone-NN-<scene>.jpg (and ipad-)
//   android/fastlane/metadata/android/en-US/images/phoneScreenshots/NN-<scene>.jpg
// JPEG at the top quality with full-resolution colour: no alpha channel (the
// App Store refuses one), and a third of a PNG's size for the same picture.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { RAW } from './capture.ts'
import { compose, loadRaw } from './compose.ts'
import { DEVICES, type Device } from './devices.ts'
import { SHOTS, type Shot } from './shots.ts'

const ROOT = new URL('../../', import.meta.url).pathname
const OUT = new URL('./out/', import.meta.url).pathname

/** Where each device's shots go, and what their names start with. */
const DEST: Record<Device['id'], { dir: string; prefix: string }> = {
  iphone: { dir: `${ROOT}ios/App/fastlane/screenshots/en-US/`, prefix: 'iphone-' },
  ipad: { dir: `${ROOT}ios/App/fastlane/screenshots/en-US/`, prefix: 'ipad-' },
  android: {
    dir: `${ROOT}android/fastlane/metadata/android/en-US/images/phoneScreenshots/`,
    prefix: '',
  },
}

/**
 * Render `shots` (the set by default) for each device into its project
 * folder, or only the slots numbered in `only`. With `into`, to
 * store/out/<device>/<into>/ instead, for trying something out.
 */
export async function render(
  devices: Device['id'][],
  opts: { only?: number[]; shots?: Shot[]; into?: string } = {},
) {
  const shots = opts.shots ?? SHOTS
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const id of devices) {
      const device = DEVICES[id]
      const raws = Object.fromEntries(
        shots.map((s) => [s.scene, loadRaw(`${RAW}${id}/light/`, s.scene)]),
      )
      const html = `${OUT}art/${id}${opts.into ? `-${opts.into}` : ''}.html`
      mkdirSync(`${OUT}art`, { recursive: true })
      writeFileSync(html, compose(device, shots, raws))

      const { dir, prefix } = opts.into
        ? { dir: `${OUT}${id}/${opts.into}/`, prefix: '' }
        : DEST[id]
      mkdirSync(dir, { recursive: true })
      // A whole set replaces the last one (a slot that's gone mustn't linger).
      if (!opts.only)
        for (const f of readdirSync(dir))
          if (f.startsWith(prefix) && /\.(jpe?g|png)$/.test(f)) rmSync(dir + f)

      const page = await browser.newPage({ viewport: device.slot, deviceScaleFactor: 1 })
      await page.goto(`file://${html}`)
      // The headlines fit themselves once the font is in (compose.ts).
      await page.waitForFunction(() => document.body.dataset.ready === '1')
      for (const [i, shot] of shots.entries()) {
        if (opts.only && !opts.only.includes(i + 1)) continue
        await page.evaluate(
          (x) =>
            (document.getElementById('strip')!.style.transform = `translateX(${-x}px)`),
          i * device.slot.width,
        )
        const file = `${dir}${prefix}${String(i + 1).padStart(2, '0')}-${shot.scene}.jpg`
        const png = `${OUT}${id}-slot.png`
        await page.screenshot({ path: png })
        execFileSync('ffmpeg', [
          '-y',
          '-loglevel',
          'error',
          '-i',
          png,
          '-q:v',
          '2',
          '-pix_fmt',
          'yuvj444p',
          file,
        ])
        rmSync(png)
        console.log(`  ${id} · ${i + 1} ${shot.scene}`)
      }
      await page.close()
    }
  } finally {
    await browser.close()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const devices = args.filter((a): a is Device['id'] => a in DEVICES)
  const only = args.filter((a) => /^\d+$/.test(a)).map(Number)
  await render(devices.length ? devices : (Object.keys(DEVICES) as Device['id'][]), {
    only: only.length ? only : undefined,
  })
}
