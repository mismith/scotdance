import type { PartPreview } from '@/lib/admin/links'
import { listNames, type LinkPart } from '@/lib/linked'

// What linking, or switching a part on, would replace: the words Manage
// confirms with (ADR 0007 §4).

const NOUN: Record<LinkPart, { noun: string; plural?: boolean }> = {
  about: { noun: 'description and logo', plural: true },
  venue: { noun: 'venue' },
  registration: { noun: 'registration details', plural: true },
  links: { noun: 'links and files', plural: true },
  visibility: { noun: 'listed and published settings', plural: true },
  organisations: { noun: 'organisations', plural: true },
  staff: { noun: 'staff' },
}

/** "venue", "staff": what a part is, in a sentence. */
export const partNoun = (part: LinkPart) => NOUN[part].noun

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const possessive = (name: string) => `${name}’${name.endsWith('s') ? '' : 's'}`

/** What a cleared staff member leaves without them: "2 dances lose a judge". */
function losses(c: { sponsors: number; judging: number }) {
  return [
    c.judging && `${count(c.judging, 'dance')} ${c.judging === 1 ? 'loses' : 'lose'} a judge`,
    c.sponsors && `${count(c.sponsors, 'age group')} ${c.sponsors === 1 ? 'loses its' : 'lose their'} sponsor`,
  ].filter(Boolean).join(' and ')
}

/**
 * One line on what copying `p` into `name` from `from` replaces: "Sunday’s
 * venue is replaced with SDCCS Pre-Premier Open’s." Staff say how many, and
 * who drops out with things still pointing at them.
 */
export function replacesSentence(name: string, p: PartPreview, from: string): string {
  if (p.part === 'staff' && p.staff) {
    const s = p.staff
    const head = `${possessive(name)} ${count(s.replacing, 'staff member')} ${s.replacing === 1 ? 'is' : 'are'} replaced with ${possessive(from)} ${s.count}.`
    const dropped = s.cleared.map((c) => `${c.name} isn’t among them, so ${losses(c)}.`)
    return [head, ...dropped].join(' ')
  }
  const { noun, plural } = NOUN[p.part]
  return `${possessive(name)} ${noun} ${plural ? 'are' : 'is'} replaced with ${possessive(from)}.`
}

const OWN_PLURAL = new Set<LinkPart>(['links', 'organisations'])

/** "Its own venue is replaced.", "Its own venue, links and staff are replaced." */
export function ownReplaced(parts: Array<{ id: LinkPart; own: string }>): string {
  const plural = parts.length > 1 || OWN_PLURAL.has(parts[0].id)
  return `Its own ${listNames(parts.map((p) => p.own))} ${plural ? 'are' : 'is'} replaced.`
}
