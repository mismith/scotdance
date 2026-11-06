// The four kinds of dance a dancer's progress is told in: Highland,
// National, Character (the Jig and Hornpipe) and Choreography. Read from the
// dance names `danceName` groups to, so "FLING" and "Trophy Fling" are both
// Highland; a name it doesn't know (an award, a special) has no kind.

export type DanceKind = 'highland' | 'national' | 'character' | 'choreography'

/** In the wheel's order: Highland at the top, then clockwise. */
export const DANCE_KINDS: DanceKind[] = ['highland', 'character', 'national', 'choreography']

export const KIND_NAMES: Record<DanceKind, string> = {
  highland: 'Highland',
  national: 'National',
  character: 'Character',
  choreography: 'Choreography',
}

/** The dancer colours each kind is drawn in. */
export const KIND_COLORS: Record<DanceKind, string> = {
  highland: 'var(--dancer-5)',
  national: 'var(--dancer-2)',
  character: 'var(--dancer-1)',
  choreography: 'var(--dancer-3)',
}

/** As a sentence says it: "Highland dances improved most". */
export const KIND_PHRASES: Record<DanceKind, string> = {
  highland: 'Highland dances',
  national: 'National dances',
  character: 'Character dances',
  choreography: 'Choreography',
}

const STANDARD_KIND: Record<string, DanceKind> = {
  'Pas de basques': 'highland',
  'Pas de basques & High Cuts': 'highland',
  'Highland Fling': 'highland',
  'Sword Dance': 'highland',
  'Seann Truibhas': 'highland',
  'Strathspey & Highland Reel': 'highland',
  'Strathspey & Highland Reel & Half Tulloch': 'highland',
  'Strathspey & Half Tulloch': 'highland',
  'Half Tulloch': 'highland',
  Broadsword: 'highland',
  'Barracks Johnnie': 'national',
  'Highland Laddie': 'national',
  'Scottish Lilt': 'national',
  'Flora MacDonald’s Fancy': 'national',
  'Village Maid': 'national',
  'Blue Bonnets': 'national',
  'Earl of Errol': 'national',
  'Scotch Measure': 'national',
  'Irish Jig': 'character',
  'Sailors Hornpipe': 'character',
  Choreography: 'choreography',
}

/** The kind of a grouped dance name, or null when it isn't one of the four. */
export function kindOf(name: string): DanceKind | null {
  return STANDARD_KIND[name] ?? (/choreo/i.test(name) ? 'choreography' : null)
}
