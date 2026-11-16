// Ported from Entries: card formatting and category inference.
/**
 * Registration numbers, shared by the app and the functions (no dependencies). Canada's look like C-AB-26-2007P:
 * country, province, year, number, and the dancer's category letter. Other countries' numbers are kept as typed,
 * tidied, and not checked further.
 */
const CANADIAN = /^C-[A-Z]{2}-(\d{2})-\d{4}([A-Z])$/

// Each card letter and the categories it allows: Restricted Premier dancers carry a Premier (X) card
const LETTERS: Record<string, string[]> = {
  P: ['Primary'],
  B: ['Beginner'],
  N: ['Novice'],
  I: ['Intermediate'],
  X: ['Premier', 'Restricted Premier'],
}

/** Spaces collapsed and capitals; a Canadian number typed without (or with odd) dashes gets them back. */
export function tidyRegistration(text: string): string {
  const value = text.trim().replace(/\s+/g, ' ').toUpperCase()
  const parts = /^C[\s-]*([A-Z]{2})[\s-]*(\d{2})[\s-]*(\d{4})[\s-]*([A-Z])$/.exec(value)
  return parts ? `C-${parts[1]}-${parts[2]}-${parts[3]}${parts[4]}` : value
}

/** A recognized Canadian card determines the dancer's category, not the event division. */
export function registrationCategory(value: string): string | undefined {
  const parts = CANADIAN.exec(tidyRegistration(value))
  return parts ? LETTERS[parts[2]!]?.[0] : undefined
}

/** An example number for the competition's year (or this year), for the empty field. */
export const registrationExample = (date = new Date().toISOString().slice(0, 10)) =>
  `C-AB-${date.slice(2, 4)}-0000P`

const an = (word: string) => `${/^[AEIOU]/i.test(word) ? 'an' : 'a'} ${word}`
const capital = (text: string) => text[0]!.toUpperCase() + text.slice(1)

/**
 * What is wrong with a tidied number, or '' when nothing is. With a category, a Canadian number's letter must match
 * it; with a competition date, its year must be that competition's (a 2027 competition needs a 2027 card).
 */
export function registrationProblem(value: string, category = '', date = ''): string {
  if (!value) return 'Add the registration number.'
  if (!value.startsWith('C-')) return ''
  const parts = CANADIAN.exec(value)
  if (!parts) return 'Canadian numbers look like C-AB-26-0000P.'
  const letter = parts[2]!
  const known = LETTERS[letter]
  const expected = Object.keys(LETTERS).find((key) => LETTERS[key]!.includes(category))
  if (category && known && !known.includes(category)) return `This is ${an(known[0]!)} number.`
  if (expected && expected !== letter) return `${capital(an(category))} number ends in ${expected}.`
  if (date && parts[1] !== date.slice(2, 4)) return `This is a 20${parts[1]} number.`
  return ''
}
