// Reading a team out of what organisers type (ADR 0012, decisions 7 and 8).
//
// Until teams existed, a team was entered as a dancer, with whatever fitted
// typed into First name, Last name and Location, every way round:
//   "Celtic Sisters" | "Isla Grant & Mairi Shaw" | "Thistle School"
//   "Thea Conley &" | "Keira Wiebe" | "MB"
//   "White Hart Dance Academy - Checkmate" | "" | "SK"
//   "Snowflakes" | "by E. Breeze and C. Meldrum" | ""
// Imports still come in that shape (programs print teams that way), and the
// conversion tool reads the old rows. Both use this, and both show what it
// read, with anything it isn't sure of flagged, before anything is saved.

export interface MemberName {
  firstName: string
  lastName: string
}

export interface ReadTeam {
  title: string
  members: MemberName[]
  studio: string
  location: string
  /** What to check, in plain words ("Title split across two cells"). */
  unsure: string[]
}

/** Quotes around the whole of something, not an apostrophe at its end ("Double 'E'"). */
const unquote = (s: string) => {
  const m = s.match(/^["“”'‘](.*)["“”'’]$/)
  return m ? m[1].trim() : s.replace(/^["“]+|["”]+$/g, '').trim()
}

const clean = (s: unknown) =>
  String(s ?? '')
    .replace(/[ \s]+/g, ' ')
    .trim()

// Words that make a phrase a studio: strong ones on their own, weak ones
// ("Dance to the Music" is a routine) only when nothing stronger is there.
const STRONG_STUDIO = /\b(school|academy|studio|studios|dancers|troupe|company|co\.?|club|society|association|theatre|theater|ensemble|college|highland dance(rs)?|dance (company|centre|center))\b/i
const WEAK_STUDIO = /\b(dance|dancing|highland)\b/i
/** Initials for a studio (WSHD, CSHD, KRSHD), not for a place (PEI, SCO, USA). */
const ACRONYM_WORD = /\b[A-Z]{3,6}\b/g
const PLACE_CODES = new Set(['PEI', 'SCO', 'ENG', 'IRL', 'WAL', 'NSW', 'QLD', 'VIC', 'TAS', 'ACT', 'USA', 'AUS', 'NZL', 'CAN', 'GBR', 'UK'])
const hasAcronym = (s: string) => (s.match(ACRONYM_WORD) ?? []).some((w) => !PLACE_CODES.has(w))
const ACRONYM = { test: hasAcronym }
// Words that put a phrase out of the running as a person's name ("Get Your Ghillies On").
const COMMON = new Set(['the', 'an', 'of', 'in', 'on', 'to', 'my', 'your', 'our', 'me', 'we', 'it', 'is', 'go', 'get', 'up', 'all', 'and', 'with', 'for', 'at', 'by', 'from', 'dance', 'reel', 'jig', 'fling', 'set', 'celtic', 'ceilidh', 'highland', 'sisters'])

/** A person's name: 1–4 words that start with a capital (or an initial), no studio words. */
export function nameLike(s: string, { single = false } = {}): boolean {
  const words = s.split(' ').filter(Boolean)
  if (words.length < (single ? 1 : 2) || words.length > 4) return false
  if (STRONG_STUDIO.test(s) || WEAK_STUDIO.test(s) || ACRONYM.test(s)) return false
  // (Initials aside: "A. Fraser".)
  if (words.some((w) => !w.endsWith('.') && COMMON.has(w.toLowerCase().replace(/[^a-z]/g, '')))) return false
  return words.every((w) => /^[\p{Lu}][\p{L}'’.-]*$/u.test(w) || /^(de|van|von|der|la|le|du|da|di|st\.?|mac|mc)$/i.test(w))
}

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

/**
 * Two or more names in one piece of text: a team's members. Sisters
 * written "Emma & Ava Haight" are Emma Haight and Ava Haight.
 */
function asMembers(text: string, unsure: string[], { alone = false, hints = {} as ReadHints } = {}): (string[] & { alternates?: number }) | null {
  if (!SEPARATORS.test(text) && !/\n/.test(text)) return null
  const { names, alternates } = splitMembers(text)
  if (names.length < 2) return null
  // First names only ("Dakota, Shaila, Josephine") count when every one is.
  // Initials and surnames in capitals ("A. MacDONALD, H. BELLINGHAM") are names too.
  const shouted = names.filter((n) => /^(\p{Lu}\.\s*)+\p{Lu}[\p{L}'’-]+$/u.test(n)).length
  if (shouted >= 2 && names.every((n) => /^[\p{Lu}.][\p{L}'’.\s-]*$/u.test(n))) return Object.assign(names, { alternates })
  const allFull = names.every((n) => nameLike(n))
  const allSingle = names.every((n) => nameLike(n, { single: true }))
  if (!allFull && !allSingle) return null
  // Two first names beside a studio or title are a routine ("Tartan and
  // Thistle"); first names only count as dancers when there are three or
  // more, or nothing else in the row.
  if (!allFull && names.length < 3 && !alone && names.every((n) => n.split(' ').length === 1)) return null
  if (allSingle && !allFull) {
    const lastWords = names.at(-1)!.split(' ')
    if (lastWords.length >= 2 && names.slice(0, -1).every((n) => n.split(' ').length === 1)) {
      const surname = lastWords.slice(1).join(' ')
      return Object.assign([...names.slice(0, -1).map((n) => `${n} ${surname}`), names.at(-1)!], { alternates })
    }
    // First names only: dancers if they're dancers' first names ("Dakota,
    // Shaila, Josephine"), else a routine ("Soldier, Poet, King").
    if (names.every((n) => n.split(' ').length === 1)) {
      if (hints.firstNames && !names.every((n) => hints.firstNames!.has(norm(n)))) return null
      if (!hints.firstNames) unsure.push('First names only')
    }
  }
  return Object.assign(names, { alternates })
}

/** Strongest first: 2 strong word, 1 weak word or initials, 0 none. */
const studioScore = (s: string) => (STRONG_STUDIO.test(s) ? 2 : WEAK_STUDIO.test(s) || ACRONYM.test(s) ? 1 : 0)

export interface ReadHints {
  /** The age group's name (with its category's): a group of three or more never has two dancers. */
  group?: string
  /** Names already entered in the competition, as `normalizeName` makes them. */
  knownNames?: Set<string>
  /** The competition types studios where the town goes: Location is the studio unless it's a place. */
  locationIsStudio?: boolean
  /**
   * Towns as `norm` makes them, from Locations typed with their province
   * ("Red Deer, AB"). A person's name in Location that isn't one is the
   * team's teacher: their studio.
   */
  places?: Set<string>
  /** Everyone dancing anywhere, as `norm` makes their names: "Annika" | "Bruinsma" is a dancer, "Candy" | "Land" a routine. */
  people?: Set<string>
  /** Their first names: "Bagpipe Blues" after a list isn't another dancer. */
  firstNames?: Set<string>
  /** Phrases typed in several rows, by how many ("Kids in Kilts": 22): the most typed is the studio. */
  studios?: Map<string, number>
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')

// Where a team's from: a province or country code, "Town, AB", a province's
// name, or a place followed by its code ("Leduc County AB").
const PROVINCES = /\b(alberta|british columbia|manitoba|saskatchewan|ontario|quebec|qu[ée]bec|new brunswick|nova scotia|prince edward island|newfoundland|yukon|scotland|england|ireland|wales|australia|new zealand|usa|canada)\b/i
export function placeLike(s: string): boolean {
  const t = clean(s)
  return /^[A-Z]{2,3}$/.test(t) || /,/.test(t) || PROVINCES.test(t) || /\s[A-Z]{2}$/.test(t) || /[&/]/.test(t)
}

/** The towns among Locations typed with their province ("Red Deer, AB", "Leduc County AB"), for `places`. */
export function townsIn(locations: string[]): Set<string> {
  const towns = new Set<string>()
  for (const l of locations) {
    const m = clean(l).match(/^(.+?),?\s+[A-Z]{2}$/) ?? clean(l).match(/^([^,]+),/)
    if (m) towns.add(norm(m[1]))
  }
  return towns
}

/** Age groups for two (Winnipeg's "Duo/Trios" too). */
const DUET_GROUP = /\b(duets?|duos?|pairs?|double swords?)\b/i

/**
 * A team from one row of cells, whichever way round they came. `first` and
 * `last` are the name cells, `location` the third.
 */
export function readTeam(cells: { first?: unknown; last?: unknown; location?: unknown }, hints: ReadHints = {}): ReadTeam {
  const unsure: string[] = []
  // Lines in a cell are a list ("Eva Hebbs, Maya Al-Kadri⏎Lily Allan").
  const lines = (v: unknown) => clean(String(v ?? '').replace(/\s*[\r\n]+\s*/g, ', ').replace(/(,\s*){2,}/g, ', '))
  let first = lines(cells.first).replace(/^,\s*|,\s*$/g, (m, i) => (i === 0 ? '' : ','))
  let last = lines(cells.last).replace(/^,\s*/, '').replace(/[,;]\s*$/, '')
  const location = clean(cells.location)

  // A list running across both cells ("Thea Conley &" | "Keira Wiebe", "Chloe Epp" | "& Kenzie Pollock").
  if (first && last && (/(?:,|&|\band|\/)$/i.test(first) || /^(?:&|and\b)/i.test(last))) {
    first = `${first} ${last}`
    last = ''
  }
  // "by E. Breeze and C. Meldrum": choreographed by the dancers themselves.
  // (Not "By the Quayside", a routine.)
  first = first.replace(/^by\s+(?=.*(?:,|&|\band\b))/i, '')
  last = last.replace(/^by\s+(?=.*(?:,|&|\band\b))/i, '')

  // A cell can hold two things: "White Hart Dance Academy - Checkmate",
  // "Celtic Fairy - ", "Anchors Away: Lucy, Holly…".
  const pieces = [first, last]
    .flatMap((c) => c.split(/\s+[-–—:]\s+|\s+[-–—]$|:\s+|^[-–—]\s+/))
    .map((p) => unquote(clean(p).replace(/[•·:]+$/, '').trim()))
    // Placeholders aren't a routine.
    .filter((p) => p && !/^(tbc|tba|tbd|n\/?a|[-–—•.]+)$/i.test(p))
    // A studio cut in two: "Tara Olah" | "School", "Skye" | "Dancers".
    .reduce<string[]>((out, p) => (/^(school|dancers|academy|studios?)$/i.test(p) && out.length ? [...out.slice(0, -1), `${out.at(-1)} ${p}`] : [...out, p]), [])
  // A cell ending in a dash or colon is the routine's ("Green Grow the Rushes -" | "Kids in Kilts").
  const marked = [first, last].filter((c) => /(\s[-–—]|[•:])\s*$/.test(c)).map((c) => unquote(clean(c.replace(/(\s[-–—]|[•:])\s*$/, '').split(/\s+[-–—:]\s+|:\s+/).at(-1) ?? '')))

  // The members: the best list of names among the pieces, full names over
  // first names ("Wednesday & Enid" is a routine beside two full names).
  let members: string[] = []
  let membersAt = -1
  const notes: string[][] = pieces.map(() => [])
  const lists = pieces.map((p, i) => asMembers(p, notes[i], { alone: pieces.length === 1, hints }))
  const score = (l: string[] | null) => (l ? (l.every((n) => n.split(' ').length > 1) ? 1000 : 0) + l.length : -1)
  lists.forEach((l, i) => {
    if (l && score(l) > score(membersAt < 0 ? null : lists[membersAt])) membersAt = i
  })
  if (membersAt >= 0) {
    members = lists[membersAt]!
    unsure.push(...notes[membersAt])
  }
  // A list carried on in the other cell: "Ava Reid/Mia Lee" | "Isla Grant/Skye Bell".
  const more = lists.findIndex((l, i) => i !== membersAt && membersAt >= 0 && l?.every((n) => nameLike(n)) && members.every((n) => nameLike(n)))
  if (more >= 0) {
    members = [...members, ...lists[more]!]
    unsure.push(...notes[more])
  }
  const rest: string[] = pieces.filter((_, i) => i !== membersAt && i !== more)
  // A list that ran on into the next cell without a comma: "Parker Swick,
  // Sawyer Crawford" | "Dana Robitaille".
  // But not when the event's full already: that's their teacher ("Eliane
  // Seguin, Tessa Charlton" | "Gillian Macdonald" in a duet), nor a routine
  // ("Bagpipe Blues").
  const most = /\btrios?\b/i.test(hints.group ?? '') ? 3 : DUET_GROUP.test(hints.group ?? '') ? 2 : null
  const dancers = () => members.length - (membersAt >= 0 ? (lists[membersAt]!.alternates ?? 0) : 0)
  let teacherInCell = ''
  const after = membersAt >= 0 ? pieces[membersAt + 1] : undefined
  const firstNameOf = (n: string) => !hints.firstNames || hints.firstNames.has(norm(n.split(' ')[0]))
  if (after && nameLike(after) && rest.length === 1 && rest[0] === after && firstNameOf(after)) {
    rest.length = 0
    if (most && dancers() >= most) teacherInCell = after
    else {
      members.push(after)
      if (!hints.firstNames) unsure.push(`Added ${after} as a dancer`)
    }
  }

  // A duet typed one dancer per cell: "Ainslie Bungay" | "Jordan Chisholm".
  // Only where the age group says duets: elsewhere two names side by side are
  // as likely a solo's routine and its dancer ("Home Again" | "Ella Sul").
  // Anywhere, two who dance elsewhere ("Lyla Coghlan" | "Charlotte Lugtigheid"),
  // or in capitals ("Morgan Caruana" | "CIERA MacDONALD").
  const person = (p: string) => nameLike(p) || (!!hints.firstNames && /^[\p{Lu}][\p{L}'’-]*( [\p{Lu}][\p{L}'’-]*){1,2}$/u.test(p) && firstNameOf(p))
  const known = (p: string) => !!hints.people?.has(norm(p))
  if (
    !members.length &&
    rest.length === 2 &&
    !pieces.some((p) => / - /.test(p)) &&
    ((DUET_GROUP.test(hints.group ?? '') && rest.every(person)) || (rest.every(person) && rest.some(known) && rest.every((p) => known(p) || !hints.studios?.has(norm(p)))))
  ) {
    members = [...rest]
    rest.length = 0
  }
  // One phrase cut in two ("Kids in" | "Kilts", "Beltane" | "Fire"), but
  // not a studio and its routine ("MacArthur Dancers" | "Wonderland").
  if (
    rest.length === 2 &&
    !members.length &&
    !rest.some((p) => STRONG_STUDIO.test(p) || (/^[A-Z]{3,6}$/.test(p) && !PLACE_CODES.has(p))) &&
    // Both one word ("Beltane" | "Fire"), or cut off mid-phrase ("Kids in" |
    // "Kilts"). Not "Gillie Callum" | "Sláinte": a studio, then its routine.
    ((rest[0].split(' ').length === 1 && rest[1].split(' ').length === 1) || /\b(in|of|the|and|to|a|on|at|for|your|my|our|is|it)$/i.test(rest[0]))
  ) {
    const joined = `${rest[0]} ${rest[1]}`
    rest.length = 0
    rest.push(joined)
    if (!hints.people) unsure.push(`Read as one name: “${joined}”`)
  }
  // One dancer's name, alone: a dancer if they dance anywhere ("Annika
  // Bruinsma"), else the routine ("Ripple Effect").
  if (hints.people && !members.length && rest.length === 1 && nameLike(rest[0]) && hints.people.has(norm(rest[0]))) {
    members = [rest[0]]
    rest.length = 0
  }

  // The studio: the most studio-like piece, or the location if that reads as one.
  let studio = ''
  let loc = location
  // (Not the one marked as the routine when another could be: "Swing, Swing, Highland Fling •" | "Aspects of Dance".)
  const otherStudio = rest.some((p) => !marked.includes(p) && studioScore(p) > 0)
  const best = rest
    .map((p, i) => ({ p, i, score: otherStudio && marked.includes(p) ? 0 : studioScore(p) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)[0]
  const locScore = studioScore(location)
  // (With nothing else to name the team by, it's more likely the routine: "Lil’ Elves".)
  const teacher = !!hints.places && rest.length > 0 && nameLike(location) && !placeLike(location) && !hints.places.has(norm(location))
  if (
    (teacher && (!best || best.score < 2)) ||
    locScore === 2 ||
    (locScore === 1 && (!best || best.score < 2) && (!/,/.test(location) || /^[A-Z]{3,6}\b/.test(location)) && location.split(' ').length > 1) ||
    (hints.locationIsStudio && location && !placeLike(location) && (!best || best.score < 2))
  ) {
    studio = location
    loc = ''
  } else if (rest.length === 2 && (!best || best.score < 2) && rest.some((p) => hints.studios?.has(norm(p)))) {
    // Typed in many rows: the most typed is the studio ("Kids in Kilts" | "Highland Heathers").
    const typed = rest.map((p) => hints.studios?.get(norm(p)) ?? 0)
    studio = rest.splice(typed.indexOf(Math.max(...typed)), 1)[0]
  } else if (best && (best.score === 2 || rest.length > 1)) {
    studio = best.p
    rest.splice(best.i, 1)
  } else if (rest.length === 2 && !studio) {
    // Two names and no studio word: the one typed in many rows, or not
    // marked as the routine; else studio first, then the routine, as
    // programs print them ("Kids in Kilts" | "Scottish Primrose").
    // A teacher's name is the studio too ("Alive" | "Eleanor Belton").
    const typed = rest.map((p) => hints.studios?.get(norm(p)) ?? 0)
    const known = Math.max(...typed) > 0 ? typed.indexOf(Math.max(...typed)) : -1
    const teacherHere = hints.firstNames ? rest.findIndex((p) => nameLike(p) && firstNameOf(p)) : -1
    const notMarked = marked.length === 1 && rest.includes(marked[0]) ? rest.findIndex((p) => p !== marked[0]) : -1
    // Else a routine cut in two: "Seven" | "Wicked Reels", "Touch" | "the Sky", "Go With" | "The Flow".
    // (Short, not "Highlandin6" | "Flowers of Spadina".)
    const words = rest.join(' ').split(' ').length
    const cut = !!hints.studios && (/^\p{Ll}/u.test(rest[1]) || (words <= 3 && rest.some((p) => !p.includes(' '))) || COMMON.has(rest[0].split(' ').at(-1)!.toLowerCase()))
    const at = known >= 0 ? known : notMarked >= 0 ? notMarked : teacherHere >= 0 && rest.filter((p) => nameLike(p) && firstNameOf(p)).length === 1 ? teacherHere : -1
    if (at >= 0) studio = rest.splice(at, 1)[0]
    else if (cut) rest.splice(0, 2, `${rest[0]} ${rest[1]}`)
    else {
      studio = rest.shift()!
      unsure.push(`Read “${studio}” as the studio`)
    }
  }
  if (teacherInCell && !studio) studio = teacherInCell
  else if (teacherInCell) unsure.push(`${teacherInCell}: a dancer, or the teacher?`)

  // A teacher's name already in the studio's: "Susan Bell School of Dance -" | "Susan Bell".
  if (studio) {
    for (let i = rest.length - 1; i >= 0; i -= 1) if (studio.toLowerCase().includes(rest[i].toLowerCase())) rest.splice(i, 1)
  }

  // A teacher beside the studio: "KMSD - Kelly McGregor" | "From Now On",
  // "Highland Hoppers -" | "Kathy Hopper".
  if (studio && (rest.length === 2 || (rest.length === 1 && (!members.length || /^[A-Z]{3,6}$/.test(studio))))) {
    const teacher = rest.findIndex((p) => nameLike(p) && !known(p) && firstNameOf(p))
    if (teacher >= 0 && hints.firstNames) studio = `${studio} - ${rest.splice(teacher, 1)[0]}`
  }
  let title = rest.join(' ')
  if (rest.length > 1) unsure.push(`More than one name: ${rest.map((r) => `“${r}”`).join(', ')}`)
  // Names it couldn't read as names ("A. MACDONALD, H. BELL & F. TOLLEY")
  // aren't a title; "1, 2, 3, 4" and "Dancer, Dreamer, Doer" are.
  const parts = title.split(SEPARATORS).filter(Boolean)
  if (parts.length >= 2 && parts.filter((p) => /^\p{Lu}\.\s*\S/u.test(p) || (hints.firstNames ? hints.firstNames.has(norm(p.split(' ')[0])) && p.includes(' ') : false)).length >= 2)
    unsure.push(`“${title}” reads like a list of names`)
  else if (!hints.firstNames && /,.*[,&]|\//.test(title)) unsure.push(`“${title}” reads like a list of names`)

  // A partner's first name where the town goes: "Evelyn" | "Bray" | "Charlotte".
  if (members.length && !title && hints.firstNames?.has(norm(loc)) && !loc.includes(' ') && !hints.places?.has(norm(loc))) {
    members.push(loc)
    loc = ''
  }
  // The routine typed where the town goes: "Isla Grant & Mairi Shaw" | "" | "Better Place".
  if (!title && members.length && loc && !placeLike(loc) && !hints.places?.has(norm(loc))) {
    title = loc
    loc = ''
    if (!hints.places) unsure.push(`Read “${title}” as the routine`)
  }

  // More dancers than the event has room for: a teacher or an alternate, say.
  // ("Duo/Trios" has room for three.)
  // A name beside a duet or trio that's already full is their teacher's ("Mya Beers, Vera Beers" | "Lorena Harrison").
  if (hints.firstNames && most && dancers() >= most && !studio && rest.length === 1 && title === rest[0] && nameLike(title) && !known(title)) {
    studio = title
    title = ''
  }
  if (most && dancers() > most) unsure.push(`${dancers()} dancers for a ${most === 2 ? 'duet' : 'trio'}`)

  // A lone person's name isn't a team: a team has at least two.
  if (!members.length && !studio && nameLike(title) && title.split(' ').length <= 3) {
    if (!hints.people) unsure.push(`“${title}” looks like one dancer`)
  } else if (title && members.length && nameLike(title) && hints.knownNames?.has(norm(title))) {
    // A dancer here, typed where the routine goes: one of them too.
    if (hints.people) {
      members.unshift(title)
      title = ''
    } else unsure.push(`“${title}” is a dancer here too`)
  }
  if (members.length === 1 && !hints.people) unsure.push('Only one dancer')
  if (!title && !members.length && !studio) unsure.push('Nothing to name it by')

  return { title, members: members.map(splitName), studio, location: loc, unsure }
}

// Age groups whose entries are teams. "Group A" alone isn't one (Primary
// 6 Years Group A), nor is "Opening Ceremonies Dance Group" a team event:
// the organiser can switch either way in the plan.
const TEAM_GROUP = /\b(duets?|duos?|trios?|quartets?|teams?|troupes?|double swords?|broadsword (teams?|groups?)|reel teams?|(small|large|open) groups?|group choreo\w*|choreo\w* groups?|groups? choreo\w*|groups|group dances?)\b/i
const NOT_TEAM_GROUP = /\b(solo|ceremon\w*|primary)\b/i

/** Whether an age group's name (with its category's) says its entries are teams. */
export function looksLikeTeamGroup(name: string): boolean {
  const n = clean(name)
  return TEAM_GROUP.test(n) && !NOT_TEAM_GROUP.test(n)
}

/**
 * A solo routine typed into a dancer's row: "Celtic Fairy - " | "Lila
 * St-Onge" | "Ellen Cameron", or "Brianna Dakin" | "“Shake That Bagpipe”".
 * Null when the row is just a dancer.
 */
export function readSoloRoutine(
  cells: { first?: unknown; last?: unknown; location?: unknown },
  /** The age group types the routine first and the dancer after: "Home Again" | "Ella Sul" | "House of Bruce". */
  { titleFirst = false, locationIsStudio = false } = {},
): {
  firstName: string
  lastName: string
  title: string
  studio: string
  location: string
} | null {
  const first = clean(cells.first)
  const last = clean(cells.last)
  const location = clean(cells.location)
  const studioFromLocation = (studioScore(location) > 0 && location.split(' ').length > 1 && !/,/.test(location)) || (locationIsStudio && !!location && !placeLike(location))
  // Title first: "Celtic Fairy - " | "Lila St-Onge"
  const dashed = first.match(/^(.*\S)\s*[-–—:]$/)
  if (dashed && nameLike(last)) {
    return { ...splitName(last), title: clean(dashed[1]), studio: studioFromLocation ? location : '', location: studioFromLocation ? '' : location }
  }
  // The age group's way: routine, then the dancer's full name.
  if (titleFirst && first && !/([&,/]|\band)\s*$/i.test(first) && last.split(' ').length >= 2 && nameLike(last)) {
    return { ...splitName(last), title: unquote(first.replace(/\s*[-–—:]$/, '')), studio: studioFromLocation ? location : '', location: studioFromLocation ? '' : location }
  }
  // Name first, routine in quotes: "Brianna Dakin" | "“Shake That Bagpipe”"
  const quoted = last.match(/^["“](.*)["”]$/)
  if (quoted && nameLike(first)) {
    return { ...splitName(first), title: clean(quoted[1]), studio: studioFromLocation ? location : '', location: studioFromLocation ? '' : location }
  }
  return null
}
