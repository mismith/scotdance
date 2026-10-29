// What Manage › Print lays out: each document is a list of units (a heading,
// one row of a platform grid, an age group's page block…) that the print view
// packs into pages by measuring them. Builders (program.ts, day.ts) turn a competition into units; nothing here knows about the
// screen, so the same units are also written as a Word file (docx.ts).

export type DocId = 'program' | 'day'
export type PartId = 'cover' | 'schedule' | 'groups' | 'platforms'
export type Paper = 'letter' | 'a4'

/** A person as printed: "Isla Gilchrist", "Scotland". */
export interface Person {
  name: string
  from?: string
}

export interface CoverSheet {
  name: string
  dates: string
  venue?: string
  address?: string
  registrations: string[]
  image?: string
  sessions: Array<{ label: string; time?: string }>
  judges: Person[]
  pipers: Person[]
}

export interface GridHead {
  title: string
  time?: string
  platforms: string[]
}
/** One age group on a platform; null is a gap the organiser left. */
export type GridLine = { group: string } | null
export interface GridCell {
  judges: string
  lines: GridLine[]
}
export type GridRow =
  | { kind: 'dance'; name: string; cells: Array<GridCell | null> }
  /** A line across every platform: "Primary awards", "Lunch". */
  | { kind: 'note'; text: string }

export interface AgeGroupSheet {
  title: string
  /** In the order they dance, where every dance has the same draw; else by number. */
  dancers: Array<{ number?: number; name: string; location?: string }>
  dances: string[]
  places: number
  overall: boolean
  trophy?: string
  sponsor?: string
}

/** A draw that differs dance by dance (a championship's): who dances when in each. */
export interface DrawSheet {
  group: string
  dances: string[]
  /** Row i: who dances i+1th in each dance. */
  rows: string[][]
  /** The first row's place in the whole draw (a long one continues). */
  from: number
}

export interface PlatformDance {
  dance: string
  judges: string
  /** `order`: numbers in dancing order; `late`: in the age group but not in its draw (entered since). */
  rows: Array<{ group: string; count: number; order: string[]; drawn: boolean; late: string[] }>
}

interface Base {
  /** Unique within a document. */
  key: string
  part: PartId
  /** Starts a new page. */
  breakBefore?: boolean
  /** Never left alone at the foot of a page (a heading). */
  keepWithNext?: boolean
  /** Fills a page by itself. */
  fullPage?: boolean
  /** Shown again at the top of a page this unit starts (a table's header, "continued"). */
  repeat?: Unit
  /** Printed sideways (a platform grid too wide to stand up), as the SDCCS prints its nine platforms. */
  rotate?: boolean
}

export type Unit = Base &
  (
    | { kind: 'cover'; cover: CoverSheet }
    | { kind: 'heading'; title: string; aside?: string; note?: string; level: 1 | 2 }
    | { kind: 'gridHead'; head: GridHead; continued?: boolean }
    | { kind: 'gridRow'; row: GridRow; columns: number }
    | { kind: 'ageGroup'; group: AgeGroupSheet }
    | { kind: 'draw'; draw: DrawSheet }
    | { kind: 'platformDance'; dance: PlatformDance }
  )

export type UnitOf<K extends Unit['kind']> = Extract<Unit, { kind: K }>

/**
 * Print type: Helvetica, or Arial where there's no Helvetica (Windows), as
 * the Word file opens in. Classic on paper, and plain zeros (the app's own
 * typeface slashes them).
 */
export const PRINT_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif'

/** Paper sizes in CSS pixels (96 to the inch), upright, and the margin all round. */
export const PAPER: Record<Paper, { width: number; height: number; label: string; css: string }> = {
  letter: { width: 816, height: 1056, label: 'Letter', css: 'letter' },
  a4: { width: 793.7, height: 1122.5, label: 'A4', css: 'A4' },
}
export const MARGIN = 48
/** The page number at the foot of a page, where they're switched on. */
export const FOOTER = 28


/** A grid with this many platforms or more goes sideways. */
export const WIDE_GRID = 6

/** The space for units on a page: across and down, upright or sideways; less a page number's. */
export function contentBox(paper: Paper, rotate = false, numbered = true) {
  const width = PAPER[paper].width - 2 * MARGIN
  const height = PAPER[paper].height - 2 * MARGIN - (numbered ? FOOTER : 0)
  return rotate ? { width: height, height: width } : { width, height }
}
