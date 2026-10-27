// On iOS a page pulled past its top or its end bounces, and beyond it the
// web view shows a flat colour: nothing a page draws reaches there. So the
// page paints a screen of its own paper for each side, as if the sheet went
// on (the light mirrored above its top edge, the grain in step with its
// own), and the app shows them there (ScotDancePlugin.setPaper). style.css
// stays the one place the paper is described: this reads its light from
// there, and its grain from the tiles `npm run paper` renders from there (a
// canvas an SVG is drawn into can't be read back in WebKit).

const TILE = 220 // the grain's size on the page (style.css, html)

function cssValue(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function canvasOf(w: number, h: number) {
  const scale = devicePixelRatio || 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  ctx?.scale(scale, scale)
  return { canvas, ctx }
}

// The grain over the whole canvas, its tiles starting `phase` down from the top.
function fillGrain(ctx: CanvasRenderingContext2D, tile: HTMLImageElement, w: number, h: number, phase: number) {
  const grain = ctx.createPattern(tile, 'repeat')
  if (!grain) return
  grain.setTransform(new DOMMatrix().translate(0, phase).scale(TILE / tile.width))
  ctx.fillStyle = grain
  ctx.fillRect(0, 0, w, h)
}

/**
 * The paper beyond the page's edges, as JPEG data URLs: `above`, a screen
 * tall, meets the page's top; `below`, a screen and a tile tall, starts on
 * one of the grain's tile edges, so the app can line it up with the page's
 * end (wherever that falls) at the last tile edge before it.
 */
export async function paintPaperEdges(dark: boolean) {
  const w = innerWidth
  const h = innerHeight
  const end = cssValue('--page-end')
  const tile = await loadImage(`/paper/grain-${dark ? 'dark' : 'light'}.webp`)

  const above = canvasOf(w, h)
  if (!above.ctx) return null
  above.ctx.fillStyle = end
  above.ctx.fillRect(0, 0, w, h)
  // The light: the page's ellipse, its centre on the bottom edge here.
  const rx = (parseFloat(cssValue('--light-w')) / 100) * w
  const ry = (parseFloat(cssValue('--light-h')) / 100) * h
  const cx = (parseFloat(cssValue('--light-x')) / 100) * w
  above.ctx.save()
  above.ctx.translate(cx, h)
  above.ctx.scale(1, ry / rx)
  const light = above.ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  light.addColorStop(0, cssValue('--light-1'))
  light.addColorStop(0.55, cssValue('--light-2'))
  light.addColorStop(1, end)
  above.ctx.fillStyle = light
  above.ctx.fillRect(-cx, (-h * rx) / ry, w, (h * rx) / ry)
  above.ctx.restore()
  fillGrain(above.ctx, tile, w, h, h % TILE)

  // Below, the light has long since faded: the end colour and the grain.
  const below = canvasOf(w, h + TILE)
  if (!below.ctx) return null
  below.ctx.fillStyle = end
  below.ctx.fillRect(0, 0, w, h + TILE)
  fillGrain(below.ctx, tile, w, h + TILE, 0)

  return {
    above: above.canvas.toDataURL('image/jpeg', 0.9),
    below: below.canvas.toDataURL('image/jpeg', 0.9),
    tile: TILE,
  }
}
