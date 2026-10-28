import type { Reference } from 'firebase-admin/database';

// Dancer entries in past competitions that are nobody: no name, or neither a
// number nor an age group. Most are left over from an import (a list read in
// twice, or a sheet's empty rows); none can show in results, so they only
// clutter the Dancers tab. System admin › Dancer cleanup lists them to remove.
// An entry any result or point names is never one, whatever it's missing.
// Checked against production (2026-10): about 280 entries in 16 competitions.

export interface StrayDancer {
  id: string;
  number?: string | number;
  firstName?: string;
  lastName?: string;
  /** Why it's listed, as the page says it. */
  why: string;
  /** The number it's properly entered under, for a leftover copy. */
  copyOf?: string | number;
}

export interface StrayCompetition {
  id: string;
  name: string;
  date: string;
  dancers: StrayDancer[];
}

type Dancer = { firstName?: string; lastName?: string; number?: string | number | null; groupId?: string };
type Tree = Record<string, Record<string, unknown> | null | undefined> | null | undefined;

const fullName = (d: Dancer) => `${String(d.firstName ?? '').trim()} ${String(d.lastName ?? '').trim()}`.trim();
const hasNumber = (d: Dancer) => d.number != null && String(d.number).trim() !== '';

/** Every dancer id a result or point names (":tie" taken off). */
function named(results: Tree, points: Tree): Set<string> {
  const ids = new Set<string>();
  const add = (list: unknown) => Array.isArray(list) && list.forEach((e) => typeof e === 'string' && ids.add(e.replace(/:tie$/, '')));
  for (const group of Object.values(results ?? {})) for (const placings of Object.values(group ?? {})) add(placings);
  for (const group of Object.values(points ?? {})) {
    for (const judges of Object.values(group ?? {})) for (const list of Object.values((judges ?? {}) as Record<string, unknown>)) add(list);
  }
  return ids;
}

export function strayDancers(dancers: Record<string, Dancer> | null | undefined, results?: Tree, points?: Tree): StrayDancer[] {
  const all = Object.entries(dancers ?? {}).filter(([, d]) => d && typeof d === 'object');
  const used = named(results, points);
  // Who's properly entered, by name: a leftover copy says which one it copies.
  const entered = new Map<string, Dancer>();
  for (const [, d] of all) if (d.groupId && hasNumber(d) && fullName(d)) entered.set(fullName(d).toLowerCase(), d);

  const out: StrayDancer[] = [];
  for (const [id, d] of all) {
    if (used.has(id)) continue;
    const name = fullName(d);
    const why = !name ? 'No name' : !hasNumber(d) && !d.groupId ? 'No number or age group' : null;
    if (!why) continue;
    const copy = name ? entered.get(name.toLowerCase()) : undefined;
    out.push({
      id,
      ...(hasNumber(d) ? { number: d.number as string | number } : {}),
      ...(d.firstName ? { firstName: d.firstName } : {}),
      ...(d.lastName ? { lastName: d.lastName } : {}),
      why,
      ...(copy ? { copyOf: copy.number as string | number } : {}),
    });
  }
  return out.sort((a, b) => Number(a.number ?? Infinity) - Number(b.number ?? Infinity) || fullName(a).localeCompare(fullName(b)));
}

/** A competition's day, YYYY-MM-DD (dates are mostly that, some ISO strings or ms). */
const dayOf = (date: unknown) => (typeof date === 'number' ? new Date(date).toISOString() : String(date ?? '')).slice(0, 10);

/**
 * Every competition over by a day or more (one still being set up can have
 * half-entered dancers), with its stray dancer entries; newest first.
 */
export function getOnFindStrayDancers(db: Reference, now = () => Date.now()) {
  return async () => {
    const yesterday = new Date(now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const comps = ((await db.child('competitions').get()).val() ?? {}) as Record<string, { name?: string; date?: unknown }>;
    const past = Object.entries(comps).filter(([, c]) => /^\d{4}-\d{2}-\d{2}$/.test(dayOf(c?.date)) && dayOf(c?.date) < yesterday);
    const found = await Promise.all(
      past.map(async ([id, c]) => {
        const data = db.child(`competitions:data/${id}`);
        const [dancers, results, points] = await Promise.all(['dancers', 'results', 'points'].map((k) => data.child(k).get().then((s) => s.val())));
        const stray = strayDancers(dancers, results, points);
        return stray.length ? { id, name: String(c.name ?? ''), date: dayOf(c.date), dancers: stray } : null;
      }),
    );
    return found.filter((c): c is StrayCompetition => !!c).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  };
}
