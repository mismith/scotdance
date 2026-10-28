// A PDF's pages as pictures, for judges' sheets: each page then goes the
// same way as a photo (lib/admin/sheetImage), so everyone sees every sheet
// in one viewer and no PDF reader ever loads for them. pdf.js is big (about
// 2 MB with its worker), so it loads here only, when an organiser picks a PDF.

const LONG_SIDE = 2000

export interface PdfPages {
  pages: HTMLCanvasElement[]
  /** How many the PDF has (more than `pages` when it ran past the limit). */
  total: number
}

export async function pdfPages(file: File, max: number): Promise<PdfPages> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  // Sheets come from scrutineering software (or are photos), so pdf.js's
  // extras for scanned pages and missing fonts aren't shipped: a font the
  // PDF names without including is drawn with the device's own.
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  let doc: Awaited<typeof task.promise>
  try {
    doc = await task.promise
  } catch (e) {
    void task.destroy()
    if ((e as { name?: string }).name === 'PasswordException') {
      throw new Error('That PDF is locked with a password. Save a copy without one and try again.')
    }
    throw new Error('That PDF couldn’t be opened. Try exporting it again.')
  }
  try {
    const pages: HTMLCanvasElement[] = []
    for (let n = 1; n <= Math.min(doc.numPages, max); n += 1) {
      const page = await doc.getPage(n)
      const size = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: LONG_SIDE / Math.max(size.width, size.height) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('This device couldn’t prepare that PDF. Try again.')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      page.cleanup()
      pages.push(canvas)
    }
    return { pages, total: doc.numPages }
  } finally {
    void task.destroy()
  }
}
