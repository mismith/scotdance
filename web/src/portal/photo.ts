/** Portrait framing shared by the on-screen preview and the exported JPEG. No face recognition. */
export const MAX_PHOTO_ZOOM = 5
export const PHOTO_WIDTH = 800
export const PHOTO_HEIGHT = 1000
export const MAX_PHOTO_FILE = 30 * 1024 * 1024
export function photoFileProblem(file: Pick<File, 'size' | 'type'> & { name?: string }): string {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type) && !((!file.type || file.type === 'application/octet-stream') && /\.hei[cf]$/i.test(file.name || '')))
    return 'Choose a JPG, PNG, WebP or HEIC photo.'
  if (file.size > MAX_PHOTO_FILE) return 'Choose a photo up to 30 MB.'
  if (!file.size) return 'This photo is empty. Choose another file.'
  return ''
}
export function portraitFrame(width: number, height: number, zoom = 1, x = 0, y = 0) {
  const scale =
    Math.max(PHOTO_WIDTH / width, PHOTO_HEIGHT / height) *
    Math.max(1, Math.min(MAX_PHOTO_ZOOM, zoom))
  const w = width * scale,
    h = height * scale
  return {
    width: w,
    height: h,
    left: ((PHOTO_WIDTH - w) * (Math.max(-1, Math.min(1, x)) + 1)) / 2,
    top: ((PHOTO_HEIGHT - h) * (Math.max(-1, Math.min(1, y)) + 1)) / 2,
  }
}

/** HEIC decoding stays on the device; lazy-loaded only for unsupported native decoding. */
export async function decodePhoto(file: File): Promise<{ image: HTMLImageElement; url: string }> {
  let url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    try { await image.decode() }
    catch {
      if (!/hei[cf]/i.test(file.type) && !/\.hei[cf]$/i.test(file.name)) throw new Error('This photo could not be opened.')
      const { heicTo } = await import('heic-to/csp')
      const converted = await heicTo({ blob: file, type: 'image/jpeg', quality: .95 })
      URL.revokeObjectURL(url)
      url = URL.createObjectURL(converted)
      image.src = url
      await image.decode()
    }
    return { image, url }
  } catch { URL.revokeObjectURL(url); throw new Error('This photo could not be opened. Try another photo or export it as JPG.') }
}
