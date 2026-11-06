import type { Reference } from 'firebase-admin/database';

// Competitions that put each dancer's whole name in First name and left Last
// name empty ("Adelyn Dalgleish" + nothing), so their profiles and search
// read oddly. System admin › Dancer cleanup lists them to split, previewed the
// way import splits a combined name column. Only a competition where most
// entries are like that: one "Mary Jane" with no last name is just a name.
// A pair ("Lily Siecker & Grace Thompson") is two names, not one to split, so
// it counts neither way; nor does a duet, trio or group's entry (ADR 0012),
// whose First name is v3's copy of its routine.

export interface CombinedName {
  id: string;
  number?: string | number;
  firstName: string;
}

export interface CombinedCompetition {
  id: string;
  name: string;
  date: string;
  dancers: CombinedName[];
}

type Dancer = { firstName?: unknown; lastName?: unknown; number?: string | number | null; team?: unknown };

const text = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
const isPair = (d: Dancer) => /&|\band\b|\+/i.test(text(d.firstName));
const hasNumber = (d: Dancer) => d.number != null && String(d.number).trim() !== '';

/** Import's bar for a combined name column (importDancers.ts parseProgram). */
const MOSTLY = 0.6;

export function combinedNames(dancers: Record<string, Dancer> | null | undefined): CombinedName[] {
  const named = Object.entries(dancers ?? {}).filter(([, d]) => d && typeof d === 'object' && (text(d.firstName) || text(d.lastName)) && !isPair(d) && d.team !== true);
  const combined = named.filter(([, d]) => !text(d.lastName) && /[ ,]/.test(text(d.firstName)));
  if (combined.length < 3 || combined.length < named.length * MOSTLY) return [];
  return combined
    .map(([id, d]) => ({ id, ...(hasNumber(d) ? { number: d.number as string | number } : {}), firstName: text(d.firstName) }))
    .sort((a, b) => Number(a.number ?? Infinity) - Number(b.number ?? Infinity) || a.firstName.localeCompare(b.firstName));
}

/** A competition's day, YYYY-MM-DD (dates are mostly that, some ISO strings or ms). */
const dayOf = (date: unknown) => (typeof date === 'number' ? new Date(date).toISOString() : String(date ?? '')).slice(0, 10);

/** Every competition with whole names in First name, newest first. */
export function getOnFindCombinedNames(db: Reference) {
  return async () => {
    const comps = ((await db.child('competitions').get()).val() ?? {}) as Record<string, { name?: string; date?: unknown }>;
    const found = await Promise.all(
      Object.entries(comps).map(async ([id, c]) => {
        const dancers = combinedNames((await db.child(`competitions:data/${id}/dancers`).get()).val());
        return dancers.length ? { id, name: String(c?.name ?? ''), date: dayOf(c?.date), dancers } : null;
      }),
    );
    return found.filter((c): c is CombinedCompetition => !!c).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  };
}
