import { getDownloadURL, uploadBytes } from 'firebase/storage'
import { bucketRef } from '@/firebase'

// Uploads for Manage: competition images, judge photos and linked files.
// The storage rules cap images at 244 KB and links at 976 KB, so photos
// are shrunk on the device first (people pick 4 MB phone pictures). Names
// get the competition and a timestamp, so two competitions' "logo.png"
// never overwrite each other.

export type UploadFolder = 'info' | 'staff' | 'links'

const IMAGE_LIMIT = 240 * 1024
const LINK_LIMIT = 970 * 1024

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'file'

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file isn’t an image this device can read.'))
    }
    img.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Shrink an image until it fits under the size limit. Keeps transparency (WebP or PNG). */
export async function shrinkImage(file: File, limit = IMAGE_LIMIT): Promise<Blob> {
  if (file.size <= limit && /^image\/(jpeg|png|webp|gif)$/.test(file.type)) return file
  const img = await loadImage(file)
  let maxSide = 1600
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.86, 0.76, 0.66]) {
      // WebP keeps logos' transparent backgrounds; fall back to JPEG where
      // the browser can't encode WebP (it hands back a PNG instead).
      const webp = await toBlob(canvas, 'image/webp', quality)
      const blob = webp?.type === 'image/webp' ? webp : await toBlob(canvas, 'image/jpeg', quality)
      if (blob && blob.size <= limit) return blob
    }
    maxSide = Math.round(maxSide * 0.75)
  }
  throw new Error('That image is too detailed to shrink enough. Try a smaller one.')
}

async function put(folder: UploadFolder, competitionId: string, name: string, blob: Blob): Promise<string> {
  const ext = blob.type === 'application/pdf' ? 'pdf' : (blob.type.split('/')[1] ?? 'bin').replace('jpeg', 'jpg')
  const path = `competitions/${folder}/${competitionId}-${Date.now()}-${slug(name)}.${ext}`
  const ref = bucketRef(path)
  await uploadBytes(ref, blob, { contentType: blob.type })
  return getDownloadURL(ref)
}

/** Upload an image (shrunk to fit) and return its public URL. */
export async function uploadImage(file: File, folder: UploadFolder, competitionId: string): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image (JPEG, PNG or WebP).')
  const blob = await shrinkImage(file)
  return put(folder, competitionId, file.name, blob)
}

/** Upload a PDF or image for a competition link and return its URL. */
export async function uploadLinkFile(file: File, competitionId: string): Promise<string> {
  if (file.type.startsWith('image/')) {
    const blob = await shrinkImage(file, LINK_LIMIT)
    return put('links', competitionId, file.name, blob)
  }
  if (file.type !== 'application/pdf') throw new Error('Choose a PDF or an image.')
  if (file.size > LINK_LIMIT) throw new Error('That PDF is over 950 KB. Try exporting a smaller one.')
  return put('links', competitionId, file.name, file)
}
