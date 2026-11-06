// A team's dancers, from names typed into one box (ADR 0012): the dancer
// form's "Add another dancer" and imports, where programs print a team's
// dancers together ("Isla Grant & Mairi Shaw (Alt. Ava Ross)").

export interface MemberName {
  firstName: string
  lastName: string
}

const clean = (s: unknown) =>
  String(s ?? '')
    .replace(/[ \s]+/g, ' ')
    .trim()

/** A dancer's name, as the import splits it: first word, then the rest. "Smith, Isla" too. */
export function splitName(full: string): MemberName {
  const name = clean(full)
  const comma = name.indexOf(',')
  if (comma > 0) return { firstName: clean(name.slice(comma + 1)), lastName: clean(name.slice(0, comma)) }
  const [firstName = '', ...rest] = name.split(' ')
  return { firstName, lastName: rest.join(' ') }
}

const ALT = /\balt(?:ernate)?\b/i
const ALT_MARK = /\balt(?:ernate)?\b\.?\s*[:,]?/gi
const SEPARATORS = /\s*(?:,|;|&|\+|\/|\n|\band\b|\bwith\b)\s*/i

/**
 * Names typed into one box: one per line, or separated by commas, "&",
 * "and", "/" or ";". Alternates ("(Alt. Kira Evans)", "Alt: Kira") are
 * dancers too, last; ages after a name ("Jessica Nash 17") are left out,
 * and said.
 */
export function splitMembers(text: string): { names: string[]; leftOut: string[]; alternates: number } {
  const leftOut: string[] = []
  const alternates: string[] = []
  let t = String(text ?? '').replace(/\r/g, '')
  const alternate = (who: string) => (clean(who) ? alternates.push(clean(who)) : leftOut.push('An alternate'))
  // A mark after a name ("Kira Evans (alt)") means the name before it, back to the last separator.
  const lastName = (before: string) => {
    const [, rest = '', who = ''] = before.match(/^(.*(?:,|;|&|\+|\/|\band\b|\bwith\b))?(.*)$/is) ?? []
    return { rest, who: clean(who) }
  }
  // "(Alt. Kira Evans)", "(Kira Evans alt.)", "Kira Evans (alt)"
  t = t.replace(/([^()\n]*?)\s*\(([^)]*)\)/g, (m, before: string, inside: string) => {
    if (!ALT.test(inside)) return m
    const who = clean(inside.replace(ALT_MARK, ''))
    if (who) return alternate(who), before
    const last = lastName(before)
    return alternate(last.who), last.rest
  })
  // "Kira Evans - alt", "Kira Evans alt." (not "Mia Alt", a surname, nor
  // "Shaw. Alt, …", which names the one after)
  t = t.replace(/([^\n]*?)(?<!\.)(\s*[-–—]\s*|\s+)\balt(?:ernate)?\b\.?(?=\s*(?:$|[,;&+/]))/gim, (m, before: string, mark: string) => {
    const last = lastName(before)
    if (!/[-–—]/.test(mark) && last.who.split(' ').length < 2) return m
    return alternate(last.who), last.rest
  })
  // "Alt. Kira Evans", "…, alt: Kira", "Shaw. Alt, dancer: Kira"
  t = t.replace(/(?:^|(?<=[.;,&+/]\s*))alt(?:ernate)?\b\.?[:,]?\s+(?:dancers?:?\s*)?(.*)$/gim, (_m, who: string) => (alternate(who), ''))
  const names: string[] = []
  for (const raw of t.split(SEPARATORS)) {
    let part = clean(raw).replace(/^by\s+/i, '')
    const age = part.match(/^(.*\S)\s+\d{1,2}$/)
    if (age) {
      leftOut.push(`An age after ${age[1]}`)
      part = age[1]
    }
    if (part) names.push(part)
  }
  return { names: [...names, ...alternates], leftOut, alternates: alternates.length }
}
