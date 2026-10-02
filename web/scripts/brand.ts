// Renders every brand asset from Scott (src/lib/scott.ts): the app icons
// (iOS, Android, web), the favicon, the Play Store feature graphic and the
// vector sources in resources/. Run from web/ after changing his shape or
// FRAME: `npm run brand`.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { CX, FRAME, HEAD_R, LOGO, WIDTH, pose } from '../src/lib/scott.ts'

const ROOT = new URL('../../', import.meta.url).pathname
const BLUE = '#0065bd'
const p = pose(0)

// Scott as the logo, in the mark's units, in `ink`.
const scott = (ink: string) =>
  `<g stroke="${ink}" stroke-width="${WIDTH}">` +
  [...p.hands, ...p.legs.map((l) => l.foot)]
    .map((q) => `<line x1="${p.hip.x}" y1="${p.hip.y}" x2="${q.x.toFixed(2)}" y2="${q.y.toFixed(2)}"/>`)
    .join('') +
  `</g><circle cx="${p.hip.x}" cy="${p.hip.y}" r="${WIDTH / 2 + 4}" fill="${ink}"/>` +
  `<circle cx="${p.head.x}" cy="${p.head.y}" r="${HEAD_R}" fill="${ink}"/>`

// A 1024 icon: white Scott on the blue, square (centred by eye) or circle
// (centred on the X). `round` cuts the corners off; `inset` shrinks him, for
// icons whose mask can be smaller than the art.
type Icon = { frame: 'square' | 'circle'; round?: boolean; inset?: number }
function icon({ frame, round = false, inset = 1 }: Icon) {
  const [k, cy] =
    frame === 'square'
      ? [(FRAME.square.width * 1024) / (LOGO.right - LOGO.left), FRAME.square.centre]
      : [(FRAME.circle.reach * inset * 512) / LOGO.reach, p.hip.y]
  const bg = round ? `<circle cx="512" cy="512" r="512" fill="${BLUE}"/>` : `<rect width="1024" height="1024" fill="${BLUE}"/>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${bg}` +
    `<g transform="translate(512 512) scale(${k.toFixed(4)}) translate(${-CX} ${-cy})">${scott('#fff')}</g></svg>`
  )
}

const browser = await chromium.launch({ channel: 'chrome' }) // as the e2e tests do
async function png(svg: string, size: number, file: string, transparent = false) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`)
  await page.screenshot({ path: file, omitBackground: transparent })
  await page.close()
}
// An existing PNG's width, from its header.
const width = (file: string) => readFileSync(file).readUInt32BE(16)

const square = icon({ frame: 'square' })
const roundIcon = icon({ frame: 'circle', round: true })

// Vector sources.
const box = `${LOGO.left.toFixed(1)} ${LOGO.top.toFixed(1)} ${(LOGO.right - LOGO.left).toFixed(1)} ${(LOGO.bottom - LOGO.top).toFixed(1)}`
writeFileSync(`${ROOT}resources/scott.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">${scott('currentColor')}</svg>\n`)
writeFileSync(`${ROOT}resources/icon.svg`, `${square}\n`)
writeFileSync(`${ROOT}web/public/img/favicon.svg`, `${roundIcon}\n`)

// Web: the favicon is round; the touch and manifest icons are square, except
// the maskable one, which keeps him inside its safe circle (80% across).
await png(roundIcon, 96, `${ROOT}web/public/img/favicon.png`, true)
for (const [file, size] of [
  ['web/public/img/touchicon.png', 256],
  ['web/public/img/icon-512x512.png', 512],
  ['web/public/img/icon-1024.png', 1024],
  ['resources/icon.png', 1024],
  ['resources/icon-512x512.png', 512],
] as const)
  await png(square, size, `${ROOT}${file}`)
await png(icon({ frame: 'circle', inset: 0.8 }), 512, `${ROOT}web/public/img/icon-maskable-512.png`)

// iOS: every icon in the set, at its own size (iOS rounds the corners).
const ios = `${ROOT}ios/App/App/Assets.xcassets/AppIcon.appiconset`
for (const f of readdirSync(ios).filter((n) => n.endsWith('.png'))) await png(square, width(`${ios}/${f}`), `${ios}/${f}`)

// Android: the legacy square and round icons, and the adaptive foreground
// (shown whole, inset in the adaptive icon; launchers mask it, usually to a
// circle, so it's framed like one).
const res = `${ROOT}android/app/src/main/res`
for (const d of readdirSync(res).filter((n) => n.startsWith('mipmap-') && !n.includes('anydpi'))) {
  const dir = `${res}/${d}`
  await png(square, width(`${dir}/ic_launcher.png`), `${dir}/ic_launcher.png`)
  await png(roundIcon, width(`${dir}/ic_launcher_round.png`), `${dir}/ic_launcher_round.png`, true)
  await png(icon({ frame: 'circle' }), width(`${dir}/ic_launcher_foreground.png`), `${dir}/ic_launcher_foreground.png`)
}

// The Play Store feature graphic: Scott and the name, white on the blue.
const font = readFileSync(
  `${ROOT}web/node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2`,
).toString('base64')
const feature = await browser.newPage({ viewport: { width: 1024, height: 500 } })
await feature.setContent(
  `<style>@font-face{font-family:A;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:200 800}</style>` +
    `<body style="margin:0;height:500px;background:${BLUE};display:flex;align-items:center;justify-content:center;gap:34px;font-family:A;color:#fff">` +
    `<svg viewBox="${box}" width="210" style="flex:none">${scott('#fff')}</svg>` +
    `<span style="font-size:84px;font-weight:700;letter-spacing:-0.015em;padding-bottom:6px">ScotDance.app</span></body>`,
)
await feature.evaluate('document.fonts.ready')
await feature.screenshot({ path: `${ROOT}resources/feature-graphic.png` })

await browser.close()
console.log('Brand assets rendered.')
