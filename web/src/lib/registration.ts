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
