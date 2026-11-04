// The standard dances, as competition setup offers them (Manage › Dances ›
// Add common dances), and the other ways organisers type them: "FLING",
// "S.T", "Half Hullachan (4)". One list for everything that needs to know a
// dance is a standard one: setup's presets, System admin › Cleanup › Dances,
// and grouping a dancer's results by dance.
//
// A name only matches when it's the whole dance, nothing else: "Trophy
// Fling", "Special Jig" and "Highland Fling Championship" are events of
// their own and stay as typed, as do choreographies and awards.

export interface StandardDance {
  name: string
  shortName?: string
  /** Each preset's usual steps (a dance can have more than one). */
  steps?: string[]
  /** Other ways it's typed, beyond its short name, as `key` makes them. */
  aka?: string[]
}

export const STANDARD_DANCES: StandardDance[] = [
  {
    name: 'Pas de basques',
    shortName: 'PDB',
    aka: ['pas de basque', 'pas de bas', 'pas de baques', 'pdbs', 'pdbas', '16 pas de basques', '16 pas de basque', '16 pdb', '16 pdbs'],
  },
  { name: 'Pas de basques & High Cuts', shortName: 'PDB/HC' },
  { name: 'Highland Fling', shortName: 'Fling', steps: ['4', '6'] },
  { name: 'Sword Dance', shortName: 'Sword', steps: ['2+1', '3+1'] },
  { name: 'Seann Truibhas', shortName: 'ST', steps: ['3+1', '4+2'], aka: ['truibhas'] },
  {
    name: 'Strathspey & Highland Reel',
    shortName: 'Reel',
    steps: ['2+2'],
    aka: ['highland reel', 'strathspey & reel'],
  },
  {
    name: 'Strathspey & Highland Reel & Half Tulloch',
    shortName: 'Reel & ½ Tulloch',
    steps: ['2+4'],
  },
  {
    name: 'Strathspey & Half Tulloch',
    shortName: '½ Tulloch',
    aka: ['strathspey & half reel of tulloch'],
  },
  // Without the strathspey: programmes run both. "Hullachan" alone and the
  // Reel of Tulloch could be the half or the full one, so they stay as typed.
  {
    name: 'Half Tulloch',
    aka: ['half tulloch reel', 'half reel of tulloch', 'half r of tulloch'],
  },
  {
    name: 'Barracks Johnnie',
    shortName: 'Johnnie',
    steps: ['4'],
    aka: ['barracks', 'wilt thou go to barracks johnnie', 'wilt thou go to the barracks johnnie'],
  },
  { name: 'Highland Laddie', shortName: 'Laddie', steps: ['4'] },
  { name: 'Scottish Lilt', shortName: 'Lilt', steps: ['4'] },
  {
    name: 'Flora MacDonald’s Fancy',
    shortName: 'Flora',
    steps: ['4'],
    aka: ['flora macdonald fancy', 'flora macdonald'],
  },
  { name: 'Village Maid', steps: ['4'] },
  { name: 'Blue Bonnets', steps: ['4'] },
  { name: 'Earl of Errol', shortName: 'Earl', steps: ['4'], aka: ['earl or errol'] },
  { name: 'Scotch Measure', steps: ['4'] },
  { name: 'Irish Jig', shortName: 'Jig', steps: ['3+1', '4+1'] },
  { name: 'Sailors Hornpipe', shortName: 'Hornpipe', steps: ['4'] },
  { name: 'Broadsword' },
  { name: 'Choreography' },
]

// Misspellings and other spellings, word by word, after `key` lowers the case.
const WORDS: Record<string, string> = {
  triubhas: 'truibhas',
  tribuhas: 'truibhas',
  sean: 'seann',
  hullachan: 'tulloch',
  hulluchan: 'tulloch',
  hullochan: 'tulloch',
  hullchan: 'tulloch',
  johnny: 'johnnie',
  johhnie: 'johnnie',
  ladddie: 'laddie',
  bonnetts: 'bonnets',
  villiage: 'village',
  mcdonalds: 'macdonalds',
  macdonalds: 'macdonalds',
  stathepsy: 'strathspey',
  highcuts: 'high cuts',
  hicuts: 'high cuts',
  hc: 'high cuts',
  hcs: 'high cuts',
}

/**
 * A name reduced to what tells dances apart: lower case, no apostrophes or
 * full stops, "and"/"+"/"w/" as "&", "1/2" as "half", the usual misspellings
 * fixed. "PDB'S & HIGHCUTS" and "Pas de Basques and High cuts" both key as
 * "pdbs & high cuts".
 */
export function key(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’‘`.]/g, '')
    .replace(/h\/c/g, 'hc')
    .replace(/\s*(?:\band\b|\+|w\/|\/)\s*/g, ' & ')
    .replace(/(?:^|\s)(?:1\s*&\s*2|½)\s*/g, ' half ')
    .replace(/&/g, ' & ')
    .split(/[\s,?]+/)
    .filter(Boolean)
    .map((w) => WORDS[w] ?? w)
    .join(' ')
    .replace(/^pdbs? & /, 'pas de basques & ')
    .replace(/^pas de bas(?:ques?)? & /, 'pas de basques & ')
    .replace(/^pdbas & /, 'pas de basques & ')
}

// A dance's name before anything else's other names, so "Half Tulloch" is
// that dance and not the short name of Strathspey & Half Tulloch.
const BY_KEY = new Map<string, StandardDance>()
for (const names of [(d: StandardDance) => [d.name], (d: StandardDance) => d.aka ?? [], (d: StandardDance) => [d.shortName ?? '']])
  for (const d of STANDARD_DANCES) for (const k of names(d)) if (k && !BY_KEY.has(key(k))) BY_KEY.set(key(k), d)

/** Steps written into a name: "Fling (4)", "Sword (2&1)", "S.T (3&1)". */
const STEPS_IN_NAME = /\s*\((\d+(?:\s*[&+]\s*\d+)?)\)\s*$/

/**
 * The standard dance a name is, with any steps it carries ("Fling (4)" is the
 * Highland Fling in 4 steps), or null for anything else.
 */
export function standardDance(name: unknown): { dance: StandardDance; steps?: string } | null {
  const raw = typeof name === 'string' ? name.trim() : ''
  if (!raw) return null
  const steps = raw.match(STEPS_IN_NAME)?.[1]
  const dance = BY_KEY.get(key(steps ? raw.replace(STEPS_IN_NAME, '') : raw))
  return dance ? { dance, ...(steps ? { steps } : {}) } : null
}
