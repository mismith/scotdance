import type { Organisation } from '@/types/organisation'

// A competition as the app names it: led by its organisation's short name, so
// a list of them reads by who runs them ("CHDA Winter Wonderland", the short
// name in another colour: components/CompetitionName). When the
// name already starts with the organisation (its short name or full name),
// that part goes, rather than saying it twice. On an organisation's own page
// (`within`), its competitions say neither: "June Classic", not "CHDA June
// Classic".

export interface CompetitionTitle {
  /** The organisation's short name, or none. */
  prefix: string | null
  /** Whose it is, for a link to its page. */
  organisationId: string | null
  name: string
}

type Named = { name?: string | null; organisations?: Record<string, boolean> | null }
type Org = Pick<Organisation, 'name' | 'shortName'>

/** `text` starts with `lead` as whole words, ignoring case: "CHDA Winter", not "CHDAs". */
function startsWith(text: string, lead: string) {
  if (!lead || text.length < lead.length || text.slice(0, lead.length).toLowerCase() !== lead.toLowerCase()) return false
  return !/[\p{L}\p{N}]/u.test(text.charAt(lead.length))
}

// The leading organisation off a name, with any joining punctuation or "’s".
const strip = (name: string, lead: string) => name.slice(lead.length).replace(/^['’]s\b/i, '').replace(/^[\s\-–—:·•|,/]+/, '').trim()
// Its full or short name that a competition's name starts with (the longer first).
const leadIn = (name: string, o: Org) => [o.name, o.shortName].map((s) => s?.trim() ?? '').filter(Boolean).sort((a, b) => b.length - a.length).find((s) => startsWith(name, s))

export function competitionTitle(
  c: Named,
  organisations: ReadonlyMap<string, Org>,
  { fallback = 'Competition', within }: { fallback?: string; within?: string | null } = {},
): CompetitionTitle {
  const name = c.name?.trim() || fallback
  if (within) {
    const here = organisations.get(within)
    const lead = here ? leadIn(name, here) : undefined
    return { prefix: null, organisationId: null, name: (lead && strip(name, lead)) || name }
  }
  const orgs = Object.entries(c.organisations ?? {})
    .filter(([, on]) => on === true)
    .map(([id]) => ({ id, ...organisations.get(id) }))
    .filter((o): o is Org & { id: string } => !!o.shortName?.trim())
    .sort((a, b) => String(a.shortName).localeCompare(String(b.shortName)))
  if (!orgs.length) return { prefix: null, organisationId: null, name }
  // The one its name starts with; else the first.
  const named = orgs.find((o) => leadIn(name, o))
  const org = named ?? orgs[0]
  const lead = named ? leadIn(name, named) : null
  const rest = lead ? strip(name, lead) : name
  // Nothing but the organisation: the name alone, not "CHDA CHDA".
  if (!rest) return { prefix: null, organisationId: null, name }
  return { prefix: String(org.shortName).trim(), organisationId: org.id, name: rest }
}
