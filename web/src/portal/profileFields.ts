// Shared interaction rules ported from Entries. Preserve mixed-case names.
export function tidy(text: string) {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (!/\p{L}/u.test(clean) || (/\p{Ll}/u.test(clean) && /\p{Lu}/u.test(clean))) return clean
  return clean
    .toLowerCase()
    .replace(/(^|[\s\-'’.(])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase())
}

/** A month's number of days (month 1 to 12), leap years included, without parsing a date string. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

