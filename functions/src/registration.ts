// Competition registration numbers, kept in each association's own format so
// they read the same however they were typed: in a submission, in Manage or
// in the old app. Several in one field are kept, joined with ", ". If any
// of it can't be read, it's all left as typed, so nothing said alongside
// (what each number is for, say) is lost; what couldn't be read is reported,
// so a submission with it waits for a person. The app names each association
// from the tidied form (web/src/lib/registration.ts).
//
// - RSOBHD, through ScotDance Canada: C-ON-CO-26-2609 (Manitoba's are three
//   digits). Typed without the CO, it gets one.
// - RSOBHD, through ScotDance USA: USE-0128, USSE-0414, USNW-0304.
// - Australia, as each body's own calendars write them (checked 2026-10):
//   ABHDI's championships C03/2026 and premierships SNDP01/2026; the state
//   and regional committees' NSW 01/2026, FNQ 01/2026, SA 01/2026,
//   WAM 03/2026, and South Queensland's year first, SQC 2026/11. Victoria's
//   and Tasmania's own lists weren't found: V10/2026 and T06/2026 follow
//   ABHDI's. The ACT and Eastern Goldfields count up, with no year: ACT 167,
//   EGHD/C203. Two-digit years are this century's.

const PROVINCES = 'AB|BC|MB|NB|NL|NS|ON|PE|QC|SK|NT|YT|NU';
const CANADA = [
  // C-AB-CO-26-1234, and C0 for CO, CSK-…, CA-AB-…, spaces for dashes, no CO.
  new RegExp(`^(?:CA?)?[-\\s]*(${PROVINCES})[-\\s]*(?:C[O0])?[-\\s]*(\\d{2})[-\\s]*(\\d{3,4})$`),
  // CO before the province: CO-QC-23-1008, C-CO-QC-23-1009.
  new RegExp(`^C?[-\\s]*C[O0][-\\s]*(${PROVINCES})[-\\s]*(\\d{2})[-\\s]*(\\d{3,4})$`),
];
const US_REGIONS = 'NW|SW|NE|SE|MW|E|W';
const USA = new RegExp(`^(?:US[-\\s]*)?(${US_REGIONS})[-\\s]*(\\d{1,4})$`);
// Number then year; NSW, FNQ, SA and WAM write a space after theirs.
const AUSTRALIA = /^(C|SNDP|V|T|NSW|FNQ|SA|WAM)[-\s]*0*(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/;
const SPACED = new Set(['NSW', 'FNQ', 'SA', 'WAM']);
const SOUTH_QUEENSLAND = /^SQC[-\s]*(\d{1,4})\s*\/\s*(\d{1,4})$/;
const ACT = /^ACT[-\s]*(\d{1,4})$/;
const EASTERN_GOLDFIELDS = /^EGHD\s*\/\s*C\s*(\d{1,4})$/;

// Words people put around numbers: who issued them, or what they're for.
const LABELS = /(?:\b(?:ABHDI|NSWSCHDI|SQRCHDI|FNQRCHDI|VSCHDI|TSCHDI|SASCHDI|WAMRCHDI|VSDMAI|LLHDA|RSOBHD|SCOTDANCE(?:\s+(?:CANADA|USA))?|REG(?:ISTRATION|ISTERED)?\.?(?:\s*(?:NO\.?|NUMBER|#))?|SANCTION(?:ED)?(?:\s*(?:NO\.?|NUMBER|#))?|CHAMPIONSHIPS?\s+NO\.?|COMP\.?\s*NO\.?|COMPETITION|WORKSHOP)(?=[\s:#]|$)|#)[\s:#]*/gi;
const PLACEHOLDER = /^(?:TBA|TBC|TBD|N\/?A|NONE|PENDING|-+)$/i;
// Between numbers: commas, ampersands, "and", or just space before the next
// one (but not after a slash: that's EGHD/ C203).
const BETWEEN = /\s*(?:[,;&@+]|\band\b)\s*|(?<![/\s])\s+(?=(?:C|SNDP|V|T|NSW|FNQ|SA|WAM|SQC|ACT|US)[-\s]*\d|EGHD\s*\/)/i;

const pad = (n: string | number, width: number) => String(Number(n)).padStart(width, '0');
const fullYear = (y: string) => (y.length === 4 ? y : `20${y}`);

/** One number in its association's format; '' for a placeholder (TBA…); null if it can't be read. */
function tidyOne(part: string, year?: number | null): string | null {
  const s = part.replace(/\s+/g, ' ').trim().toUpperCase();
  if (!s || PLACEHOLDER.test(s)) return '';
  for (const re of CANADA) {
    const m = s.match(re);
    if (m) return `C-${m[1]}-CO-${m[2]}-${m[3]}`;
  }
  let m = s.match(USA);
  if (m && (s.startsWith('US') || /-\d{4}$/.test(s))) return `US${m[1]}-${pad(m[2], 4)}`;
  m = s.match(AUSTRALIA);
  if (m) return `${m[1]}${SPACED.has(m[1]) ? ' ' : ''}${pad(m[2], 2)}/${fullYear(m[3])}`;
  m = s.match(SOUTH_QUEENSLAND);
  if (m) {
    // Year first, as South Queensland writes it; typed number-first, or with
    // a two-digit year, the competition's year says which is which.
    const [a, b] = [m[1], m[2]];
    const yy = year ? String(year).slice(2) : null;
    if (a.length === 4 && b.length <= 2) return `SQC ${a}/${pad(b, 2)}`;
    if (b.length === 4 && a.length <= 2) return `SQC ${b}/${pad(a, 2)}`;
    if (a.length === 2 && b.length === 2 && yy) {
      if (a === yy) return `SQC 20${a}/${b}`;
      if (b === yy) return `SQC 20${b}/${a}`;
    }
  }
  m = s.match(ACT);
  if (m) return `ACT ${Number(m[1])}`;
  m = s.match(EASTERN_GOLDFIELDS);
  if (m) return `EGHD/C${Number(m[1])}`;
  return null;
}

/**
 * A registration number (or several) in each association's format. `year` is
 * the competition's, for the rare number that needs it to be read. With
 * anything that can't be read (listed in `unread`), it all stays as typed.
 */
export function tidyRegistration(raw: unknown, year?: number | null): { value: string; unread: string[] } {
  if (typeof raw !== 'string' || !raw.trim()) return { value: '', unread: [] };
  const parts = raw.replace(LABELS, ' ').split(BETWEEN).map((p) => p?.trim()).filter(Boolean) as string[];
  const out: string[] = [];
  const unread: string[] = [];
  for (const part of parts) {
    const tidy = tidyOne(part, year);
    if (tidy === null) unread.push(part);
    else if (tidy) out.push(tidy);
  }
  if (unread.length) return { value: raw.replace(/\s+/g, ' ').trim(), unread };
  return { value: [...new Set(out)].join(', '), unread };
}

/**
 * For the trigger on competitions/{competitionId}/sobhd: writes the number
 * back tidied, unless it already is (so the write it makes settles at once).
 */
export function getOnRegistrationWritten(db: any) {
  return async (change: any, ctx: any) => {
    const raw = change.after.val();
    if (typeof raw !== 'string') return;
    const { competitionId } = ctx.params;
    const date = (await db.child(`competitions/${competitionId}/date`).get()).val();
    const { value } = tidyRegistration(raw, yearOf(date));
    if (value !== raw) await db.child(`competitions/${competitionId}/sobhd`).set(value || null);
  };
}

/** The year of a competition's date (YYYY-MM-DD), if it has one. */
export function yearOf(date: unknown): number | null {
  const m = typeof date === 'string' ? date.match(/^(\d{4})-/) : null;
  return m ? Number(m[1]) : null;
}
