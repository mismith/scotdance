import type * as Docx from 'docx'
import { getOrdinalSuffix } from '@/lib/results'
import { PAPER, type DocId, type Paper, type Unit, type UnitOf } from '@/lib/print/model'

// The same units as the preview, written as a Word file to edit, cut up or
// splice into the organiser's own. It uses Word's own styles (Title,
// Heading 1, Heading 2) and the theme's fonts, so Word's Design tab restyles
// all of it, and parts pasted into last year's file take on its look. Word
// lays out its own pages, so they won't break exactly where the PDF does.

export interface DocxOptions {
  doc: DocId
  paper: Paper
  /** The competition's name, as the file's title. */
  title: string
  /** Page numbers at the foot. */
  numbered?: boolean
}

const INK = '15181C'
const MUTED = '50575F'
const RULE = '9AA1A9'
const FILL = 'EEF0F2'
/** CSS pixels (96 to the inch) to twips (1,440 to the inch). */
const tw = (px: number) => Math.round(px * 15)
const INCH = 1440
const MARGIN = INCH / 2

type Block = Docx.Paragraph | Docx.Table

export async function documentDocx(units: Unit[], opts: DocxOptions): Promise<Blob> {
  const d = await import('docx')
  const paper = PAPER[opts.paper]
  const page = { width: tw(paper.width), height: tw(paper.height) }

  // --- Small builders

  const run = (text: string, o: Partial<Docx.IRunOptions> = {}) => new d.TextRun({ text, ...o })
  const muted = (text: string, size = 17) => run(text, { color: MUTED, size })
  const para = (children: Docx.ParagraphChild[], o: Partial<Docx.IParagraphOptions> = {}) => new d.Paragraph({ children, ...o })
  const line = { style: d.BorderStyle.SINGLE, size: 4, color: RULE }
  const grid = { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line }
  const none = { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none }
  const rule = (size: number) => ({ bottom: { style: d.BorderStyle.SINGLE, size, color: INK, space: 2 } })
  const cellMargins = { top: 40, bottom: 40, left: 80, right: 80 }
  const cell = (children: Block[], o: Partial<Docx.ITableCellOptions> = {}) => new d.TableCell({ children, margins: cellMargins, ...o })
  const shaded = { type: d.ShadingType.CLEAR, color: 'auto', fill: FILL }
  /** A table across the content width, its columns in the shares given. */
  function table(rows: Docx.TableRow[], shares: number[], width: number, o: Partial<Docx.ITableOptions> = {}) {
    const total = shares.reduce((a, b) => a + b, 0)
    return new d.Table({
      rows,
      width: { size: width, type: d.WidthType.DXA },
      columnWidths: shares.map((s) => Math.floor((s / total) * width)),
      layout: d.TableLayoutType.FIXED,
      borders: grid,
      ...o,
    })
  }
  /** A heading with something set to the right of it (a time, a count). */
  const headed = (level: (typeof Docx.HeadingLevel)[keyof typeof Docx.HeadingLevel], title: string, aside: Docx.ParagraphChild[], width: number, o: Partial<Docx.IParagraphOptions> = {}) =>
    para([run(title), ...(aside.length ? [run('\t'), ...aside] : [])], {
      heading: level,
      tabStops: [{ type: d.TabStopType.RIGHT, position: width }],
      ...o,
    })

  // --- Each kind of unit

  async function cover(c: UnitOf<'cover'>['cover']): Promise<Block[]> {
    const center = { alignment: d.AlignmentType.CENTER }
    const blocks: Block[] = []
    const image = c.image ? await picture(c.image, 3.5 * 96, 1.8 * 96) : null
    if (image) blocks.push(para([new d.ImageRun(image)], { ...center, spacing: { after: 320 } }))
    blocks.push(para([run(c.name)], { ...center, heading: d.HeadingLevel.TITLE }))
    if (c.dates) blocks.push(para([run(c.dates, { bold: true, size: 30 })], { ...center, spacing: { after: 240 } }))
    if (c.venue) blocks.push(para([run(c.venue, { bold: true, size: 22 })], center))
    if (c.address) blocks.push(para([run(c.address, { size: 22 })], center))
    const times = c.sessions.filter((s) => s.time)
    if (times.length) {
      blocks.push(para([], { spacing: { after: 120 } }))
      for (const s of times) blocks.push(para([run(`${s.label}  `, { size: 22 }), run(s.time!, { bold: true, size: 22 })], center))
    }
    for (const [label, people] of [
      [c.judges.length === 1 ? 'Judge' : 'Judges', c.judges],
      [c.pipers.length === 1 ? 'Piper' : 'Pipers', c.pipers],
    ] as const) {
      if (!people.length) continue
      blocks.push(para([run(label.toUpperCase(), { bold: true, size: 15, color: MUTED, characterSpacing: 16 })], { ...center, spacing: { before: 320, after: 60 } }))
      for (const p of people) blocks.push(para([run(p.name, { size: 21 }), ...(p.from ? [muted(`, ${p.from}`, 21)] : [])], center))
    }
    if (c.registrations.length) blocks.push(para([muted(c.registrations.join(' · '))], { ...center, spacing: { before: 480 } }))
    return blocks
  }

  function schedule(head: UnitOf<'gridHead'>['head'], rows: UnitOf<'gridRow'>['row'][], width: number): Block[] {
    const n = head.platforms.length
    const size = n >= 8 ? 17 : 19
    const first = n >= 8 ? 11 : n >= 6 ? 13 : n >= 4 ? 16 : 20
    const shares = [first, ...head.platforms.map(() => (100 - first) / Math.max(1, n))]
    const text = (t: string, o: Partial<Docx.IRunOptions> = {}) => run(t, { size, ...o })
    const header = new d.TableRow({
      tableHeader: true,
      children: [cell([para([])], { shading: shaded }), ...head.platforms.map((p) => cell([para([text(p, { bold: true })], { alignment: d.AlignmentType.CENTER })], { shading: shaded }))],
    })
    const body = rows.map((r) =>
      r.kind === 'note'
        ? new d.TableRow({ cantSplit: true, children: [cell([para([text(r.text, { italics: true })], { alignment: d.AlignmentType.CENTER })], { columnSpan: n + 1, shading: shaded })] })
        : new d.TableRow({
            cantSplit: true,
            children: [
              cell([para([text(r.name, { bold: true })])]),
              ...r.cells.map((c) =>
                cell(
                  c
                    ? [
                        ...(c.judges ? [para([text(c.judges, { bold: true, italics: true })], { alignment: d.AlignmentType.CENTER })] : []),
                        ...c.lines.map((l) => para(l ? [text(l.group)] : [])),
                        ...(c.judges || c.lines.length ? [] : [para([])]),
                      ]
                    : [para([])],
                ),
              ),
            ],
          }),
    )
    return [
      headed(d.HeadingLevel.HEADING_3, head.title, head.time ? [run(head.time, { bold: true, size: 20 })] : [], width, { keepNext: true }),
      table([header, ...body], shares, width),
      para([], { spacing: { after: 120 } }),
    ]
  }

  function ageGroup(g: UnitOf<'ageGroup'>['group'], width: number): Block[] {
    const keep = { keepNext: true, keepLines: true }
    const count = `${g.dancers.length} ${g.dancers.length === 1 ? 'dancer' : 'dancers'}`
    const blocks: Block[] = [headed(d.HeadingLevel.HEADING_2, g.title, [muted(count, 18)], width, { ...keep, border: rule(12) })]
    // Dancers in two columns, down then across, as the preview has them.
    const half = Math.ceil(g.dancers.length / 2)
    const side = (i: number) => {
      const x = g.dancers[i]
      return [
        cell([para(x?.number != null ? [run(String(x.number), { bold: true })] : [], { ...keep, alignment: d.AlignmentType.RIGHT })]),
        cell([para(x ? [run(x.name)] : [], keep)]),
        cell([para(x?.location ? [muted(x.location, 20)] : [], keep)]),
      ]
    }
    const rows = Array.from({ length: half }, (_, i) => new d.TableRow({ cantSplit: true, children: [...side(i), cell([para([], keep)]), ...side(i + half)] }))
    if (rows.length) blocks.push(table(rows, [6, 25, 16, 4, 6, 25, 16], width, { borders: noBorders }))
    if (g.dances.length && g.places) {
      const places = Array.from({ length: g.places }, (_, i) => i + 1)
      const header = new d.TableRow({
        tableHeader: true,
        children: [
          cell([para([], keep)], { borders: { top: none, left: none, right: none, bottom: line } }),
          ...places.map((p) =>
            cell([para([run(String(p), { bold: true, size: 18 }), run(getOrdinalSuffix(p), { bold: true, size: 18, superScript: true })], { ...keep, alignment: d.AlignmentType.CENTER })], {
              borders: { top: none, left: none, right: none, bottom: line },
            }),
          ),
        ],
      })
      const body = g.dances.map(
        (name) =>
          new d.TableRow({
            cantSplit: true,
            height: { value: 480, rule: d.HeightRule.ATLEAST },
            children: [cell([para([run(name)], keep)], { verticalAlign: d.VerticalAlignTable.CENTER }), ...places.map(() => cell([para([], keep)]))],
          }),
      )
      blocks.push(para([], { ...keep, spacing: { after: 160 } }))
      blocks.push(table([header, ...body], [32, ...places.map(() => 68 / places.length)], width))
    }
    if (g.overall) {
      // A line to write the winner on, as long as a name needs: a cell's
      // foot, which every app draws (not all draw a tab's leader).
      blocks.push(para([], { ...keep, spacing: { after: 240 } }))
      blocks.push(
        new d.Table({
          rows: [
            new d.TableRow({
              cantSplit: true,
              children: [
                new d.TableCell({ children: [para([run('Overall winner', { bold: true })], { keepNext: !!g.trophy })], borders: { top: none, left: none, right: none, bottom: none }, verticalAlign: d.VerticalAlignTable.BOTTOM, margins: { left: 0, right: 120 } }),
                new d.TableCell({ children: [para([], { keepNext: !!g.trophy })], borders: { top: none, left: none, right: none, bottom: { style: d.BorderStyle.SINGLE, size: 6, color: INK } } }),
              ],
            }),
          ],
          width: { size: Math.round(3.9 * INCH), type: d.WidthType.DXA },
          columnWidths: [Math.round(1.3 * INCH), Math.round(2.6 * INCH)],
          layout: d.TableLayoutType.FIXED,
          borders: noBorders,
        }),
      )
    }
    if (g.trophy) blocks.push(para([muted(`${g.trophy}${g.sponsor ? `, sponsored by ${g.sponsor}` : ''}`, 18)], { spacing: { before: g.overall ? 60 : 200 } }))
    blocks.push(para([], { spacing: { after: 360 } }))
    return blocks
  }

  function draw(group: string, chunks: UnitOf<'draw'>['draw'][], width: number): Block[] {
    const dances = chunks[0].dances
    const header = new d.TableRow({
      tableHeader: true,
      children: [cell([para([run('Order', { bold: true })], { alignment: d.AlignmentType.CENTER })], { shading: shaded }), ...dances.map((x) => cell([para([run(x, { bold: true })], { alignment: d.AlignmentType.CENTER })], { shading: shaded }))],
    })
    const rows = chunks.flatMap((c) =>
      c.rows.map(
        (r, i) =>
          new d.TableRow({
            cantSplit: true,
            children: [cell([para([muted(String(c.from + i + 1), 20)], { alignment: d.AlignmentType.CENTER })]), ...r.map((n) => cell([para([run(n, { bold: true })], { alignment: d.AlignmentType.CENTER })]))],
          }),
      ),
    )
    return [headed(d.HeadingLevel.HEADING_2, group, [run('Draw', { bold: true, size: 22 })], width, { keepNext: true, border: rule(12) }), table([header, ...rows], [10, ...dances.map(() => 90 / dances.length)], width), para([], { spacing: { after: 360 } })]
  }

  function platformDance(x: UnitOf<'platformDance'>['dance'], width: number): Block[] {
    const header = new d.TableRow({
      tableHeader: true,
      children: [
        cell([para([run('Age group', { bold: true })])], { shading: shaded }),
        cell([para([run('Dancers', { bold: true })], { alignment: d.AlignmentType.CENTER })], { shading: shaded }),
        cell([para([run('Order', { bold: true })])], { shading: shaded }),
      ],
    })
    const rows = x.rows.map(
      (r) =>
        new d.TableRow({
          cantSplit: true,
          children: [
            cell([para([run(r.group)])]),
            cell([para([run(String(r.count))], { alignment: d.AlignmentType.CENTER })]),
            cell([
              para([run(r.order.join('  '), { bold: true })]),
              ...(!r.drawn && r.order.length ? [para([muted('Number order (not drawn)')])] : []),
              ...(r.late.length ? [para([run('Not in the draw: ', { size: 17 }), run(r.late.join('  '), { bold: true, size: 17 })])] : []),
            ]),
          ],
        }),
    )
    return [
      para([run(x.dance, { bold: true, size: 24 }), ...(x.judges ? [run('\t'), run(x.judges, { bold: true, italics: true })] : [])], { keepNext: true, tabStops: [{ type: d.TabStopType.RIGHT, position: width }], spacing: { after: 80 } }),
      table([header, ...rows], [28, 9, 63], width),
      para([], { spacing: { after: 200 } }),
    ]
  }

  /** The units from `i`, as Word blocks; and how many units they used (a grid's rows, a draw's chunks). */
  async function render(i: number, width: number): Promise<[Block[], number]> {
    const u = units[i]
    switch (u.kind) {
      case 'cover':
        return [await cover(u.cover), 1]
      case 'heading': {
        const level = u.level === 1 ? d.HeadingLevel.HEADING_1 : d.HeadingLevel.HEADING_2
        const blocks: Block[] = [headed(level, u.title, u.aside ? [run(u.aside, { bold: u.level === 1, size: u.level === 1 ? 22 : 18, color: u.level === 1 ? INK : MUTED })] : [], width, { border: rule(u.level === 1 ? 12 : 6) })]
        if (u.note) blocks.push(para([muted(u.note)], { keepNext: true, spacing: { after: 160 } }))
        return [blocks, 1]
      }
      case 'gridHead': {
        let j = i + 1
        while (units[j]?.kind === 'gridRow') j++
        const rows = units.slice(i + 1, j).map((r) => (r as UnitOf<'gridRow'>).row)
        return [schedule(u.head, rows, width), j - i]
      }
      case 'gridRow':
        return [[], 1]
      case 'ageGroup':
        return [ageGroup(u.group, width), 1]
      case 'draw': {
        let j = i + 1
        while (units[j]?.kind === 'draw' && (units[j] as UnitOf<'draw'>).draw.group === u.draw.group && (units[j] as UnitOf<'draw'>).draw.from) j++
        return [draw(u.draw.group, units.slice(i, j).map((x) => (x as UnitOf<'draw'>).draw), width), j - i]
      }
      case 'platformDance':
        return [platformDance(u.dance, width), 1]
    }
  }

  // --- Sections: the cover on its own, centred down the page; a run of
  // sideways units in a landscape one.

  const footers = () =>
    opts.numbered ? { default: new d.Footer({ children: [para([new d.TextRun({ children: [d.PageNumber.CURRENT], size: 18, color: MUTED })], { alignment: d.AlignmentType.CENTER })] }) } : undefined
  const sections: Docx.ISectionOptions[] = []

  let i = 0
  while (i < units.length) {
    const u = units[i]
    if (u.kind === 'cover') {
      sections.push({
        properties: { page: { size: page, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } }, verticalAlign: d.VerticalAlignSection.CENTER },
        children: (await render(i, page.width - 2 * MARGIN))[0],
      })
      i++
      continue
    }
    const sideways = !!u.rotate
    const width = (sideways ? page.height : page.width) - 2 * MARGIN
    const children: Block[] = []
    while (i < units.length && units[i].kind !== 'cover' && !!units[i].rotate === sideways) {
      const [blocks, used] = await render(i, width)
      // A new page where the preview starts one (a section starts its own).
      if (units[i].breakBefore && children.length && blocks[0] instanceof d.Paragraph) children.push(para([new d.PageBreak()]))
      children.push(...blocks)
      i += used
    }
    sections.push({
      properties: { page: { size: sideways ? { ...page, orientation: d.PageOrientation.LANDSCAPE } : page, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, footer: MARGIN / 2 } } },
      footers: footers(),
      children,
    })
  }

  const doc = new d.Document({
    creator: 'ScotDance.app',
    title: opts.title,
    theme: { fonts: { headings: 'Arial', body: 'Arial' } },
    styles: {
      default: {
        document: { run: { font: { theme: 'body' }, size: 20, color: INK }, paragraph: { spacing: { after: 0, line: 276, lineRule: d.LineRuleType.AUTO } } },
        title: { run: { font: { theme: 'headings' }, size: 56, bold: true, color: INK }, paragraph: { spacing: { after: 240 } } },
        heading1: { run: { font: { theme: 'headings' }, size: 36, bold: true, color: INK }, paragraph: { spacing: { before: 0, after: 160 }, keepNext: true } },
        heading2: { run: { font: { theme: 'headings' }, size: 28, bold: true, color: INK }, paragraph: { spacing: { before: 0, after: 120 }, keepNext: true } },
        heading3: { run: { font: { theme: 'headings' }, size: 24, bold: true, color: INK }, paragraph: { spacing: { before: 160, after: 80 }, keepNext: true } },
      },
    },
    sections,
  })
  return d.Packer.toBlob(doc)
}

/** An image from the web, sized to fit, for the cover; none if it can't be had (offline, or not shared with this site). */
async function picture(url: string, maxWidth: number, maxHeight: number): Promise<Docx.IImageOptions | null> {
  try {
    if (typeof createImageBitmap === 'undefined') return null
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const type = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/bmp': 'bmp' } as const)[blob.type as 'image/png']
    if (!type) return null
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height)
    const size = { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) }
    bitmap.close()
    return { type, data: await blob.arrayBuffer(), transformation: size }
  } catch {
    return null
  }
}
