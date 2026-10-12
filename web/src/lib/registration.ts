// A competition's registration numbers, each with the association that issued
// it where the number says so. The server keeps them tidied into each
// association's own format, joined with ", " (functions/src/registration.ts),
// so the form alone tells them apart.

export interface Registration {
  number: string
  /** Who issued it, or null when the number doesn't say. */
  association: string | null
}

// Australia's by the names they go by on competitions' own pages. The ACT's
// and Eastern Goldfields' numbers say who they're from already.
const ASSOCIATIONS: ReadonlyArray<[RegExp, string]> = [
  [/^C-[A-Z]{2}-CO-\d{2}-\d{3,4}$/, 'ScotDance Canada'],
  [/^US[A-Z]{1,2}-\d{4}$/, 'ScotDance USA'],
  [/^(?:C|SNDP)\d{2}\/\d{4}$/, 'ABHDI'],
  [/^NSW \d{2}\/\d{4}$/, 'NSWSCHDI'],
  [/^SQC \d{4}\/\d{2}$/, 'SQRCHDI'],
  [/^FNQ \d{2}\/\d{4}$/, 'FNQRCHDI'],
  [/^V\d{2}\/\d{4}$/, 'VSCHDI'],
  [/^T\d{2}\/\d{4}$/, 'TSCHDI'],
  [/^SA \d{2}\/\d{4}$/, 'SASCHDI'],
  [/^WAM \d{2}\/\d{4}$/, 'WAMRCHDI'],
]

/** What a number is, beside it: who it's registered with, when the number says. */
export const registrationLabel = (r: Registration) => (r.association ? `Registered with ${r.association}` : 'Registration number')

export function registrations(value: string | null | undefined): Registration[] {
  return (value ?? '')
    .split(/\s*,\s*/)
    .filter(Boolean)
    .map((number) => ({ number, association: ASSOCIATIONS.find(([re]) => re.test(number))?.[1] ?? null }))
}

// --- Tidying, as the server does

// Numbers are tidied here, as they're typed, with what they'll be saved as
// shown beside them (registrationPreview): nothing changes a number without
// its preview. The server reads them the same way, to hold one it can't read
// for a look (functions/src/registration.ts, which says what each format is).
// registrationMirror.test.ts keeps the two in step: change both together.

const PROVINCES = 'AB|BC|MB|NB|NL|NS|ON|PE|QC|SK|NT|YT|NU'
const CANADA = [
  // C-AB-CO-26-1234, and C0 for CO, CSK-…, CA-AB-…, spaces for dashes, no CO.
  new RegExp(`^(?:CA?)?[-\\s]*(${PROVINCES})[-\\s]*(?:C[O0])?[-\\s]*(\\d{2})[-\\s]*(\\d{3,4})$`),
  // CO before the province: CO-QC-23-1008, C-CO-QC-23-1009.
  new RegExp(`^C?[-\\s]*C[O0][-\\s]*(${PROVINCES})[-\\s]*(\\d{2})[-\\s]*(\\d{3,4})$`),
]
const US_REGIONS = 'NW|SW|NE|SE|MW|E|W'
const USA = new RegExp(`^(?:US[-\\s]*)?(${US_REGIONS})[-\\s]*(\\d{1,4})$`)
// Number then year; NSW, FNQ, SA and WAM write a space after theirs.
const AUSTRALIA = /^(C|SNDP|V|T|NSW|FNQ|SA|WAM)[-\s]*0*(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/
const SPACED = new Set(['NSW', 'FNQ', 'SA', 'WAM'])
const SOUTH_QUEENSLAND = /^SQC[-\s]*(\d{1,4})\s*\/\s*(\d{1,4})$/
const ACT = /^ACT[-\s]*(\d{1,4})$/
const EASTERN_GOLDFIELDS = /^EGHD\s*\/\s*C\s*(\d{1,4})$/

// Words people put around numbers: who issued them, or what they're for.
const LABELS = /(?:\b(?:ABHDI|NSWSCHDI|SQRCHDI|FNQRCHDI|VSCHDI|TSCHDI|SASCHDI|WAMRCHDI|VSDMAI|LLHDA|RSOBHD|SCOTDANCE(?:\s+(?:CANADA|USA))?|REG(?:ISTRATION|ISTERED)?\.?(?:\s*(?:NO\.?|NUMBER|#))?|SANCTION(?:ED)?(?:\s*(?:NO\.?|NUMBER|#))?|CHAMPIONSHIPS?\s+NO\.?|COMP\.?\s*NO\.?|COMPETITION|WORKSHOP)(?=[\s:#]|$)|#)[\s:#]*/gi
const PLACEHOLDER = /^(?:TBA|TBC|TBD|N\/?A|NONE|PENDING|-+)$/i
// Between numbers: commas, ampersands, "and", or just space before the next
// one (but not after a slash: that's EGHD/ C203).
const BETWEEN = /\s*(?:[,;&@+]|\band\b)\s*|(?<![/\s])\s+(?=(?:C|SNDP|V|T|NSW|FNQ|SA|WAM|SQC|ACT|US)[-\s]*\d|EGHD\s*\/)/i

const pad = (n: string | number, width: number) => String(Number(n)).padStart(width, '0')
const fullYear = (y: string) => (y.length === 4 ? y : `20${y}`)

/** One number in its association's format; '' for a placeholder (TBA…); null if it can't be read. */
function tidyOne(part: string, year?: number | null): string | null {
  const s = part.replace(/\s+/g, ' ').trim().toUpperCase()
  if (!s || PLACEHOLDER.test(s)) return ''
  for (const re of CANADA) {
    const m = s.match(re)
    if (m) return `C-${m[1]}-CO-${m[2]}-${m[3]}`
  }
  let m = s.match(USA)
  if (m && (s.startsWith('US') || /-\d{4}$/.test(s))) return `US${m[1]}-${pad(m[2], 4)}`
  m = s.match(AUSTRALIA)
  if (m) return `${m[1]}${SPACED.has(m[1]) ? ' ' : ''}${pad(m[2], 2)}/${fullYear(m[3])}`
  m = s.match(SOUTH_QUEENSLAND)
  if (m) {
    // Year first, as South Queensland writes it; typed number-first, or with
    // a two-digit year, the competition's year says which is which.
    const [a, b] = [m[1], m[2]]
    const yy = year ? String(year).slice(2) : null
    if (a.length === 4 && b.length <= 2) return `SQC ${a}/${pad(b, 2)}`
    if (b.length === 4 && a.length <= 2) return `SQC ${b}/${pad(a, 2)}`
    if (a.length === 2 && b.length === 2 && yy) {
      if (a === yy) return `SQC 20${a}/${b}`
      if (b === yy) return `SQC 20${b}/${a}`
    }
  }
  m = s.match(ACT)
  if (m) return `ACT ${Number(m[1])}`
  m = s.match(EASTERN_GOLDFIELDS)
  if (m) return `EGHD/C${Number(m[1])}`
  return null
}

/**
 * A registration number (or several) in each association's format. `year` is
 * the competition's, for the rare number that needs it to be read. With
 * anything that can't be read (listed in `unread`), it all stays as typed.
 */
export function tidyRegistration(raw: unknown, year?: number | null): { value: string; unread: string[] } {
  if (typeof raw !== 'string' || !raw.trim()) return { value: '', unread: [] }
  const parts = raw.replace(LABELS, ' ').split(BETWEEN).map((p) => p?.trim()).filter(Boolean) as string[]
  const out: string[] = []
  const unread: string[] = []
  for (const part of parts) {
    const tidy = tidyOne(part, year)
    if (tidy === null) unread.push(part)
    else if (tidy) out.push(tidy)
  }
  if (unread.length) return { value: raw.replace(/\s+/g, ' ').trim(), unread }
  return { value: [...new Set(out)].join(', '), unread }
}

/**
 * What a typed number (or several) will be saved as, and the line that says
 * so beside the box: "Registered with ScotDance Canada: C-AB-CO-26-1234". One
 * it can't read is saved as typed, with no line (the caller says it); TBA and
 * the like are saved as nothing, and say so.
 */
export function registrationPreview(raw: string, year?: number | null): { saved: string; unread: boolean; lines: string[] } {
  const { value, unread } = tidyRegistration(raw, year)
  if (unread.length) return { saved: raw.replace(/\s+/g, ' ').trim(), unread: true, lines: [] }
  // TBA, N/A and the like: nothing to save yet, and it says so.
  if (!value && raw.trim()) return { saved: '', unread: false, lines: ['Left blank until you have one.'] }
  return {
    saved: value,
    unread: false,
    lines: registrations(value).map((r) => (r.association ? `${registrationLabel(r)}: ${r.number}` : `Saved as ${r.number}`)),
  }
}

/** The line under a registration number's box while it's typed (null: the box's own hint). */
export function registrationNote(draft: string, year?: number | null): string | null {
  if (!draft.trim()) return null
  const preview = registrationPreview(draft, year)
  return preview.unread ? 'Not a format ScotDance.app knows, so it’s saved as typed.' : preview.lines.join(', ')
}

/** What a registration number's box saves: as its note said. */
export const registrationToSave = (typed: string, year?: number | null) => registrationPreview(typed, year).saved || null
