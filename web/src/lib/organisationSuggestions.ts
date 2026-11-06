import type { OrganisationListItem } from '@/types/organisation'
import { organisationsInNames } from '@/lib/organisationTagging'

export interface OrganisationDraft {
  name: string
  shortName: string
  location?: string
  website?: string
}

// Whole phrases only: BCHDA must not match CHDA. Punctuation and accents
// don't create a different organisation, and possessives are harmless.
export const organisationKey = (value?: string | null) => (value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[’']s\b/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

// Small words an acronym skips: Manitoba Highland Dancers' Association of
// Canada is MHDAC, not MHDAOC.
const MINOR = new Set(['of', 'and', 'the', 'for', 'in', 'de', 'du', 'des', 'la', 'le', 'et'])

/** A guess at a short name: initials, keeping short capitals whole (BC Highland Dancing Association is BCHDA). */
export function acronym(name: string) {
  const words = name.replace(/[’']/g, '').split(/[^\p{L}\p{N}]+/u).filter((w) => w && !MINOR.has(w.toLowerCase()))
  if (words.length < 2) return ''
  return words.map((w) => (/^\p{Lu}{2,4}$/u.test(w) ? w : w[0].toUpperCase())).join('')
}

export function organisationSuggestions(name: string, organisations: OrganisationListItem[], chosen: string[] = [], drafts: OrganisationDraft[] = []) {
  const key = ` ${organisationKey(name)} `
  // Which of its names the competition's name uses: the short one first.
  const named = (o: OrganisationListItem) => [o.shortName, o.name].find((n) => {
    const word = organisationKey(n)
    return word.length >= 3 && key.includes(` ${word} `)
  })
  const existing = organisations.filter((o) => !chosen.includes(o.id) && named(o))
  const known = [...organisations, ...drafts]
  const fresh: OrganisationDraft[] = organisationsInNames([{ id: 'suggestion', name }], known)
    .map((o) => ({ name: o.name, shortName: o.shortName ?? '' }))
  // Only a complete, explicitly named association/society/club at the start
  // of the title. Never expand an acronym or turn the event itself into an org.
  const full = name.trim().replace(/^(?:20\d{2}\s+|the\s+)/i, '')
    .match(/^([\p{L}][\p{L}\p{N} &'’.,-]*?\b(?:Association|Society|Club|Federation|Council))(?=\s|$|[:–—-])/iu)?.[1].trim()
  if (full && !known.some((o) => [o.name, o.shortName].some((n) => organisationKey(n) === organisationKey(full)))) {
    fresh.unshift({ name: full, shortName: '' })
  }
  const unknown = fresh.filter((o) => !known.some((k) => [k.name, k.shortName].some((n) => organisationKey(n) === organisationKey(o.name))))
  return {
    existing,
    fresh: unknown,
    /** What to search for first, as it's written in the competition's name. */
    term: (existing[0] ? named(existing[0]) : unknown[0] && (unknown[0].shortName || unknown[0].name)) ?? '',
  }
}
