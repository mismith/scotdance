import { getOrdinalSuffix } from '@/lib/results'
import { formatLongDate } from '@/lib/format'
import type { DancerDay, DanceStatus } from '@/lib/dancerDay'
import type { Competition } from '@/types/competition'

// Draws a shareable result card (1080×1350, the portrait size social apps
// and family chats show uncropped). Canvas, not a DOM screenshot, so it looks
// the same everywhere and needs no library.

const W = 1080
const H = 1350
const INK = '#12161b'
const INK2 = '#454e59'
const MEDAL: Record<number, string> = { 1: '#f2c641', 2: '#d5dbe2', 3: '#e3a777' }

function cssColor(value: string | null | undefined, fallback: string) {
  if (!value) return fallback
  if (!value.startsWith('var(')) return value
  const name = value.slice(4, -1).trim()
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function tartan(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, base: string) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.fillStyle = base
  ctx.fillRect(x, y, w, h)
  const u = 12
  for (let i = -h; i < w + h; i += u * 5) {
    ctx.fillStyle = 'rgba(0,0,0,0.24)'
    ctx.fillRect(x + i, y, u * 1.2, h)
    ctx.fillRect(x, y + i, w, u * 1.2)
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.fillRect(x + i + u * 3, y, u * 0.4, h)
    ctx.fillRect(x, y + i + u * 3, w, u * 0.4)
  }
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t}…`
}

export async function drawShareCard(opts: {
  days: DancerDay[]
  competition: Competition | null
  color: string | null
}): Promise<Blob> {
  await document.fonts?.ready
  const family = getComputedStyle(document.body).fontFamily
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const base = cssColor(opts.color, '#0065bd')
  const day = opts.days[0]

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  tartan(ctx, 0, 0, W, 220, base)

  // Number card, pinned over the band.
  const cx = 80
  const cy = 150
  ctx.shadowColor = 'rgba(0,0,0,0.18)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 6
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, cx, cy, 300, 220, 22)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = '#c9d0d8'
  ctx.lineWidth = 3
  ctx.stroke()
  tartan(ctx, cx + 1.5, cy + 1.5, 297, 52, base)
  ctx.fillStyle = INK
  ctx.font = `800 128px ${family}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(String(day?.dancer.number ?? ''), cx + 150, cy + 196)
  for (const [px, rot] of [
    [cx + 40, -0.42],
    [cx + 260, 0.42],
  ] as const) {
    ctx.save()
    ctx.translate(px, cy + 22)
    ctx.rotate(rot)
    ctx.fillStyle = '#b8c0c8'
    roundRect(ctx, -26, -6, 52, 12, 6)
    ctx.fill()
    ctx.restore()
  }

  // Name + where.
  ctx.textAlign = 'left'
  ctx.fillStyle = INK
  ctx.font = `800 84px ${family}`
  ctx.fillText(fitText(ctx, day?.dancer.fullName ?? 'Dancer', W - 160), 80, 490)
  ctx.fillStyle = INK2
  ctx.font = `600 40px ${family}`
  ctx.fillText(fitText(ctx, opts.days.map((d) => d.group?.fullName).filter(Boolean).join(' · '), W - 160), 80, 550)
  ctx.fillText(fitText(ctx, opts.competition?.name ?? '', W - 160), 80, 602)

  // Placings.
  const placed: DanceStatus[] = opts.days.flatMap((d) =>
    [...d.dances, ...(d.overall ? [d.overall] : [])].filter((s) => s.state === 'placed' && s.place != null),
  )
  let y = 690
  if (!placed.length) {
    ctx.fillStyle = INK
    ctx.font = `700 52px ${family}`
    ctx.fillText('Danced today', 80, y + 40)
  }
  for (const s of placed.slice(0, 6)) {
    const p = s.place!
    const fill = MEDAL[p] ?? '#e1ecf8'
    ctx.fillStyle = fill
    roundRect(ctx, 80, y, 150, 84, 18)
    ctx.fill()
    ctx.fillStyle = p <= 3 ? INK : '#00457f'
    ctx.font = `800 50px ${family}`
    ctx.textAlign = 'center'
    ctx.fillText(`${p}${getOrdinalSuffix(p)}`, 155, y + 60)
    ctx.textAlign = 'left'
    ctx.fillStyle = INK
    ctx.font = `700 48px ${family}`
    const name = s.dance.id === 'overall' ? 'Overall' : s.dance.name || s.dance.fullName
    ctx.fillText(fitText(ctx, name, W - 340), 262, y + 58)
    y += 108
  }

  // Footer.
  ctx.strokeStyle = '#d3dae2'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(80, H - 150)
  ctx.lineTo(W - 80, H - 150)
  ctx.stroke()
  ctx.fillStyle = INK2
  ctx.font = `600 36px ${family}`
  ctx.fillText(opts.competition?.date ? formatLongDate(opts.competition.date) : '', 80, H - 88)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#0065bd'
  ctx.font = `800 36px ${family}`
  ctx.fillText('ScotDance.app', W - 80, H - 88)

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the card'))), 'image/png'),
  )
}
