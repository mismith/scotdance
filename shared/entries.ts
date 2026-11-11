// A competition's `dancers` list holds entries: a number in an age group,
// danced by one person (a dancer) or by several (a team, ADR 0012). A team
// has `team: true`, an optional title and studio, and its members by key.
//
// Mirrors functions/src/utility/entries.ts: keep the names and the rules the same.
// (web/src/lib/entries.ts re-exports this.)

export interface TeamMember {
  firstName?: string;
  lastName?: string;
  /** Back-pointer to their profile, written by the aggregator. */
  dancerId?: string;
  _order?: number;
}

export interface EntryLike {
  team?: unknown;
  title?: unknown;
  studio?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  number?: unknown;
  location?: unknown;
  members?: Record<string, TeamMember | null> | null;
}

// Legacy records can hold numbers (or worse) where text belongs.
const text = (v: unknown) =>
  typeof v === "string" || typeof v === "number" ? String(v).trim() : "";

export const isTeam = (r: unknown): boolean => (r as EntryLike | null)?.team === true;

export function memberName(
  m: Pick<TeamMember, "firstName" | "lastName"> | null | undefined,
): string {
  return `${text(m?.firstName)} ${text(m?.lastName)}`.trim();
}

/** A team's members with a name, in their order: [key, member]. */
export function teamMembers(r: EntryLike | null | undefined): Array<[string, TeamMember]> {
  const all = r?.members && typeof r.members === "object" ? Object.entries(r.members) : [];
  const order = (m: TeamMember) =>
    typeof m._order === "number" ? m._order : Number.POSITIVE_INFINITY;
  return all
    .filter(
      (e): e is [string, TeamMember] => !!e[1] && typeof e[1] === "object" && !!memberName(e[1]),
    )
    .sort(([ak, a], [bk, b]) => order(a) - order(b) || (ak < bk ? -1 : ak > bk ? 1 : 0));
}

/** "Isla Grant & Mairi Shaw", "Ava, Skye & Isla", "Ava, Skye, Isla & 5 more". */
export function namesList(names: string[], most = 3): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length <= most) return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
  return `${names.slice(0, most).join(", ")} & ${names.length - most} more`;
}

/**
 * Several dancers in one entry, as Highland dancing says it: a duet, a trio,
 * or a group. (The code calls it a team; the app never says so.)
 */
export function ensemble(count: number): string {
  return count === 2 ? "duet" : count === 3 ? "trio" : "group";
}

/**
 * What an entry is called: a dancer's name, or a team's title, else its
 * members, else its studio, else "Entry 205".
 */
export function entryName(r: EntryLike | null | undefined): string {
  if (!isTeam(r)) return `${text(r?.firstName)} ${text(r?.lastName)}`.trim();
  const title = text(r?.title);
  if (title) return title;
  const members = teamMembers(r).map(([, m]) => memberName(m));
  if (members.length) return namesList(members);
  const studio = text(r?.studio);
  if (studio) return studio;
  const number = text(r?.number);
  return number ? `Entry ${number}` : "Entry";
}

/**
 * The line under an entry's name, where a dancer's town goes: for a dancer,
 * their routine, town and studio; for a team, whoever its name doesn't
 * already say (its members, then studio), and where it's from.
 */
export function entryLine(r: EntryLike | null | undefined, { location = true } = {}): string {
  const parts: string[] = [];
  if (isTeam(r)) {
    const members = teamMembers(r).map(([, m]) => memberName(m));
    const name = entryName(r);
    if (text(r?.title) && members.length) parts.push(namesList(members));
    if (text(r?.studio) && text(r?.studio) !== name) parts.push(text(r?.studio));
  } else {
    if (text(r?.title)) parts.push(`“${text(r?.title)}”`);
    if (text(r?.studio)) parts.push(text(r?.studio));
  }
  if (location && text(r?.location))
    parts.splice(isTeam(r) ? parts.length : Math.min(parts.length, 1), 0, text(r?.location));
  return parts.join(" · ");
}

/**
 * What v3 shows for a team, as `firstName lastName` (ADR 0012 decision 3):
 * its name, and its studio when its name is its title. v3 reads nothing else.
 */
export function legacyNames(r: EntryLike): { firstName: string | null; lastName: string | null } {
  const name = entryName(r);
  const studio = text(r.studio);
  return {
    firstName: name || null,
    lastName: text(r.title) && studio && studio !== name ? studio : null,
  };
}

/**
 * An entry in a word or two, where a followed dancer is marked by name
 * (schedule, draws, results): a dancer's first name, or a team's name. A
 * team's first and last name are only v3's copy, so never read them.
 */
export function shortName(r: (EntryLike & { fullName?: string }) | null | undefined): string {
  if (!r) return "";
  if (isTeam(r)) return r.fullName || entryName(r);
  return text(r.firstName) || r.fullName || entryName(r);
}
