// A competition's `dancers` list holds entries: a number in an age group,
// danced by one person (a dancer) or by several (a team, ADR 0012). A team
// has `team: true`, an optional title and studio, and its members by key.
//
// Mirrored in web/src/lib/entries.ts: keep the names and the rules the same.

export interface TeamMember {
  firstName?: unknown
  lastName?: unknown
  /** Their profile (server-written, as on a dancer's entry). */
  dancerId?: unknown
  _order?: unknown
}

export interface EntryRecord {
  team?: unknown
  title?: unknown
  studio?: unknown
  firstName?: unknown
  lastName?: unknown
  number?: unknown
  members?: Record<string, TeamMember | null> | null
}

// Legacy records can hold numbers (or worse) where text belongs.
const text = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');

export const isTeam = (r: unknown): boolean => (r as EntryRecord | null)?.team === true;

export function memberName(m: TeamMember | null | undefined): string {
  return `${text(m?.firstName)} ${text(m?.lastName)}`.trim();
}

/** A team's members with a name, in their order: [key, member]. */
export function teamMembers(r: EntryRecord | null | undefined): Array<[string, TeamMember]> {
  const all = r?.members && typeof r.members === 'object' ? Object.entries(r.members) : [];
  const order = (m: TeamMember) => (typeof m._order === 'number' ? m._order : Number.POSITIVE_INFINITY);
  return all
    .filter((e): e is [string, TeamMember] => !!e[1] && typeof e[1] === 'object' && !!memberName(e[1]))
    .sort(([ak, a], [bk, b]) => order(a) - order(b) || (ak < bk ? -1 : ak > bk ? 1 : 0));
}

/** "Isla Grant & Mairi Shaw", "Ava, Skye & Isla", "Ava, Skye, Isla & 5 more". */
export function namesList(names: string[], most = 3): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length <= most) return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
  return `${names.slice(0, most).join(', ')} & ${names.length - most} more`;
}

/**
 * Several dancers in one entry, as Highland dancing says it: a duet, a trio,
 * or a group. (The code calls it a team; alerts never say so.)
 */
export function ensemble(count: number): string {
  return count === 2 ? 'duet' : count === 3 ? 'trio' : 'group';
}

/**
 * What an entry is called: a dancer's name, or a team's title, else its
 * members, else its studio, else "Entry 205".
 */
export function entryName(r: EntryRecord | null | undefined): string {
  if (!isTeam(r)) return `${text(r?.firstName)} ${text(r?.lastName)}`.trim();
  const title = text(r?.title);
  if (title) return title;
  const members = teamMembers(r).map(([, m]) => memberName(m));
  if (members.length) return namesList(members);
  const studio = text(r?.studio);
  if (studio) return studio;
  const number = text(r?.number);
  return number ? `Entry ${number}` : 'Entry';
}
