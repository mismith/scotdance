// "Is it one of these?" on Add a competition (ADR 0009): the pure parts, shared by the form and by the assistants' add_competition,
// so both ask the same questions of what is already known and what is already here.

const DAY = 86_400_000;
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** On the day, or a day either side (sources disagree), for any of the days it runs. */
export function near(day: string, first: string, last = first) {
  return first <= addDays(day, 1) && last >= addDays(day, -1);
}

/**
 * In the country chosen, as far as anyone can tell: one with no country yet could be anywhere, and a UK one that doesn't
 * say which nation could be in any of them.
 */
export function inCountry(
  choice: { iso: string; region: string | null } | null,
  at: { country?: string | null; region?: string | null },
) {
  if (!choice || !at.country) return true;
  if (at.country !== choice.iso) return false;
  return !choice.region || !at.region || at.region.toLowerCase() === choice.region.toLowerCase();
}

const FILLER = new Set(
  'the and of in at for to on competition competitions highland dance dancing dancers dancer association assoc society annual school'.split(' '),
);
/** The words that tell competitions apart: "W&DHDA 9th Annual Winter" → wdhda, winter. */
export function words(s = '') {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/([A-Z])&([A-Z])/g, '$1$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 1 && !FILLER.has(w) && !/^\d+(st|nd|rd|th)?$/.test(w));
}
/** Shared words over the shorter side's: a long listed title still matches a short name here. */
function overlap(a: string[], b: string[]) {
  if (!a.length || !b.length) return 0;
  const set = new Set(b);
  return new Set(a.filter((w) => set.has(w))).size / Math.min(new Set(a).size, set.size);
}

/** What the likeness looks at: a listed competition, or one here (its town is `locality` or `location`) */
export interface Likeness {
  name?: string;
  venue?: string;
  locality?: string;
}

/** The same competition, near enough: its name, venue and town alike (from the 2026 SDC list against what's here). */
export function sameCompetition(known: Likeness, here: Likeness & { location?: string }) {
  const town = words(known.locality);
  const score =
    overlap(words(known.name), words(here.name)) * 2 +
    overlap(words(known.venue), words(here.venue)) * 1.5 +
    (town.length && overlap(town, words(here.location ?? here.locality)) === 1 ? 0.5 : 0);
  return score >= 1.5;
}

/** "Calgary, AB", as the app writes a town (a UK one's nation isn't added); nothing without a town. */
export const townOf = (k: { locality?: string; region?: string }) =>
  k.locality ? [k.locality, k.region && /^[A-Z]{2,3}$/.test(k.region) ? k.region : null].filter(Boolean).join(', ') : '';
