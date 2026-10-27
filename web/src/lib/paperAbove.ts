// On iOS a page pulled down past its top bounces, and above it the web view
// shows a flat colour: nothing a page draws reaches there. So the page paints
// a screen of its own paper, as if the sheet went on above its top edge (the
// light mirrored there, the grain in step with its own), and the app shows
// that picture above the page (ScotDancePlugin.setPaperAbove). style.css
// stays the one place the paper is described: this reads it from there.

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

/** The paper above the page, a screen of it, as a JPEG data URL. */
export async function paintPaperAbove(): Promise<string | null> {
  const w = innerWidth
  const h = innerHeight
  const scale = devicePixelRatio || 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(scale, scale)

  ctx.fillStyle = cssValue('--page-end')
  ctx.fillRect(0, 0, w, h)

  // The light: the page's ellipse, its centre on the bottom edge here.
  const rx = (parseFloat(cssValue('--light-w')) / 100) * w
  const ry = (parseFloat(cssValue('--light-h')) / 100) * h
  const cx = (parseFloat(cssValue('--light-x')) / 100) * w
  ctx.save()
  ctx.translate(cx, h)
  ctx.scale(1, ry / rx)
  const light = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  light.addColorStop(0, cssValue('--light-1'))
  light.addColorStop(0.55, cssValue('--light-2'))
  light.addColorStop(1, cssValue('--page-end'))
  ctx.fillStyle = light
  ctx.fillRect(-cx, (-h * rx) / ry, w, (h * rx) / ry)
  ctx.restore()

  // The grain, its tiles meeting the page's at the bottom edge.
  const src = /url\(["']?(.*?)["']?\)$/.exec(cssValue('--paper-grain'))?.[1]
  if (src) {
    const tile = await loadImage(src)
    const grain = ctx.createPattern(tile, 'repeat')
    if (grain) {
      grain.setTransform(new DOMMatrix().translate(0, h % TILE).scale(TILE / tile.width))
      ctx.fillStyle = grain
      ctx.fillRect(0, 0, w, h)
    }
  }

  return canvas.toDataURL('image/jpeg', 0.9)
}
