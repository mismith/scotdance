// Judges' sheets, made small on the organiser's device before they upload:
// every page becomes a greyscale picture about 2000 px on its long side,
// with the paper lifted to white and the ink to black (a photo taken under a
// gym's lights comes out grey), at most SHEET_LIMIT. That keeps the small
// print readable when zoomed in, and the files cheap to keep and to view.

/** Each page's most, in bytes (the storage rules allow a little more). */
export const SHEET_LIMIT = 320 * 1024
const LONG_SIDE = 2000

export interface PreparedPage {
  blob: Blob
  width: number
  height: number
}

/**
 * Turn RGBA pixels grey in place (Rec. 601 luma) and count how many there are
 * of each shade, for `levels`.
 */
export function toGrey(data: Uint8ClampedArray): Uint32Array {
  const histogram = new Uint32Array(256)
  for (let i = 0; i < data.length; i += 4) {
    const y = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8
    data[i] = data[i + 1] = data[i + 2] = y
    histogram[y] += 1
  }
  return histogram
}

/**
 * Where the ink and the paper are: the shades below which the darkest
 * `ink` share of pixels fall, and above which the brightest `paper` share do.
 * A sheet is mostly paper, so its white sits well inside the top shades; its
 * print can be a sliver of a photo, so black comes from the very darkest
 * (any higher and the wall around the sheet turns black too).
 * Null when the picture is too flat to stretch (a blank page, a dark blur).
 */
export function levels(histogram: Uint32Array, ink = 0.001, paper = 0.25): { black: number; white: number } | null {
  let total = 0
  for (const n of histogram) total += n
  if (!total) return null
  let black = 0
  for (let seen = 0; black < 255; black += 1) {
    seen += histogram[black]
    if (seen > total * ink) break
  }
  let white = 255
  for (let seen = 0; white > 0; white -= 1) {
    seen += histogram[white]
    if (seen > total * paper) break
  }
  return white - black < 48 ? null : { black, white }
}

/** Nearly every pixel is paper white: a blank page (or a scan pdf.js couldn't draw). */
export function isBlank(histogram: Uint32Array): boolean {
  let total = 0
  let white = 0
  for (let v = 0; v < 256; v += 1) {
    total += histogram[v]
    if (v >= 245) white += histogram[v]
  }
  // A line of print is well over 0.05% of a page, so only an empty one is this white.
  return total > 0 && white / total > 0.9995
}

/** Stretch grey pixels in place so `black` reads as black and `white` as white. */
export function stretch(data: Uint8ClampedArray, { black, white }: { black: number; white: number }) {
  const map = new Uint8ClampedArray(256)
  for (let v = 0; v < 256; v += 1) map[v] = ((v - black) * 255) / (white - black)
  for (let i = 0; i < data.length; i += 4) data[i] = data[i + 1] = data[i + 2] = map[data[i]]
}

/** The picture in a file, the right way up (phones note rotation separately). */
async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() }
  } catch {
    // Older engines: an <img> (which also honours the rotation).
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) }
    } catch {
      URL.revokeObjectURL(url)
      throw new Error('That file isn’t a picture this device can read. Try a JPEG or PNG.')
    }
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

// WebP where the browser can make it (one that can't hands back a PNG):
// asked once, so a phone without it doesn't make a big PNG each try.
let webp: Promise<boolean> | null = null
function makesWebp() {
  if (!webp) {
    const probe = document.createElement('canvas')
    probe.width = probe.height = 1
    webp = toBlob(probe, 'image/webp').then((b) => b?.type === 'image/webp')
  }
  return webp
}

async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return toBlob(canvas, (await makesWebp()) ? 'image/webp' : 'image/jpeg', quality)
}

/** One page, from a photo (a File) or a rendered PDF page (a canvas). Null when it's blank. */
export async function preparePage(input: File | HTMLCanvasElement): Promise<PreparedPage | null> {
  const picture =
    input instanceof HTMLCanvasElement
      ? { source: input, width: input.width, height: input.height, done: () => {} }
      : await decode(input)
  try {
    let longSide = LONG_SIDE
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const scale = Math.min(1, longSide / Math.max(picture.width, picture.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(picture.width * scale))
      canvas.height = Math.max(1, Math.round(picture.height * scale))
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('This device couldn’t prepare that page. Try again.')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(picture.source, 0, 0, canvas.width, canvas.height)
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const histogram = toGrey(pixels.data)
      if (isBlank(histogram)) return null
      const range = levels(histogram)
      if (range) stretch(pixels.data, range)
      ctx.putImageData(pixels, 0, 0)
      // Print stays readable at a lower quality far better than at fewer
      // pixels, so quality gives first.
      for (const quality of [0.8, 0.7, 0.6, 0.5]) {
        const blob = await encode(canvas, quality)
        if (blob && blob.size <= SHEET_LIMIT) return { blob, width: canvas.width, height: canvas.height }
      }
      longSide = Math.round(longSide * 0.85)
    }
    throw new Error('That page is too detailed to make small enough. Try a closer photo of just the sheet.')
  } finally {
    picture.done()
  }
}
