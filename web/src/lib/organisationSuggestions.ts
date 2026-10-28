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

export function organisationSuggestions(name: string, organisations: OrganisationListItem[], chosen: string[] = [], drafts: OrganisationDraft[] = []) {
  const key = ` ${organisationKey(name)} `
  const existing = organisations.filter((o) => !chosen.includes(o.id) && [o.name, o.shortName].some((n) => {
    const word = organisationKey(n)
    return word.length >= 3 && key.includes(` ${word} `)
  }))
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
  return {
    existing,
    fresh: fresh.filter((o) => !known.some((k) => [k.name, k.shortName].some((n) => organisationKey(n) === organisationKey(o.name)))),
  }
}
