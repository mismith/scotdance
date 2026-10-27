// Renders the paper's grain (style.css, --paper-grain: an SVG filter, one
// per theme) to tiles in public/paper/, for the apps to paint above the page
// (lib/paperAbove): WebKit won't let a canvas an SVG was drawn into be read
// back, so they draw these instead. The page itself keeps the SVG. Run from
// web/ after changing the grain: `npm run paper`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const WEB = new URL('../', import.meta.url).pathname
const OUT = `${WEB}public/paper/`

// The light theme's grain comes first in style.css, the dark one's after.
const css = readFileSync(`${WEB}src/style.css`, 'utf8')
const [light, dark] = [...css.matchAll(/--paper-grain: url\("(data:image\/svg\+xml,[^"]+)"\)/g)].map((m) => m[1])
if (!light || !dark) throw new Error('No --paper-grain for both themes in style.css')

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome' }) // as the e2e tests do
const page = await browser.newPage()
for (const [name, src] of Object.entries({ light, dark })) {
  const url = await page.evaluate(async (svg) => {
    const img = new Image()
    img.src = svg
    await img.decode()
    const canvas = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height })
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    return canvas.toDataURL('image/webp', 0.9)
  }, src)
  writeFileSync(`${OUT}grain-${name}.webp`, Buffer.from(url.split(',')[1], 'base64'))
  console.log(`public/paper/grain-${name}.webp`)
}
await browser.close()
