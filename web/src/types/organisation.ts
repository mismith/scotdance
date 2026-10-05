import type { CompetitionLink } from '@/types/competition'

// An organisation: an association, a games society or a championship series
// that runs competitions or brings them together. Stored at
// /organisations/{id}; competitions list theirs at
// /competitions/{id}/organisations/{organisationId} = true.
export interface Organisation {
  name?: string
  /** What people call it, e.g. "FHDA". */
  shortName?: string | null
  /** Its logo. */
  image?: string | null
  description?: string | null
  website?: string | null
  /** Where it's based, e.g. "Calgary, AB". */
  location?: string | null
  /** Keyed by push id, as a competition's are. */
  links?: Record<string, CompetitionLink>
  created?: string
  createdBy?: string
}

export interface OrganisationListItem extends Organisation {
  id: string
}

/** Its short name, else its name: for chips and tight spots. */
export const organisationLabel = (o: Pick<Organisation, 'name' | 'shortName'>) => o.shortName?.trim() || o.name?.trim() || 'Organisation'

/** Up to four letters for a logo's stand-in: the short name if it's short, else the name's initials. */
export function organisationMark(o: Pick<Organisation, 'name' | 'shortName'>): string {
  const short = o.shortName?.trim()
  if (short && short.length <= 4) return short.toUpperCase()
  const words = (o.name ?? '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w && !/^(of|the|and|for|de|du|la)$/i.test(w))
  return (words.slice(0, 3).map((w) => w[0]).join('') || '?').toUpperCase()
}
