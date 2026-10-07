import { tidyRegistration, yearOf } from './registration';

// Whether a new submission can be approved as it arrives, or needs a person to
// look first, and why. Tried against every submission in production (2026-10):
// 92% of the ones approved would have gone through, and none of the rejected
// or junk ones, bar the first of a double submission (whose second copy gets
// "already submitted"). Each reason is written as the admin screen and the
// email say it.

// Words that say it's a competition (or an association acronym, or a
// registration number, does).
const COMPETITION_WORDS = /\b(?:comps?|competitions?|championships?|champs|games|gathering|festival|premierships?|titles?|open|closed|highland|dance|dancing|cup|trophy|scottish|celtic|feis|fling|show|national|provincial|regional|invitational|indoor|memorial|annual|classic|challenge|jubilee|ceilidh|workshop|fair|day|meet|series)\b/i;
const PLACEHOLDER = /\b(?:test|testing|asdf|wip|tbd|tba|dummy|sample|xxx)\b|[[\]]/i;
// Lowercase words a well-written name can still have.
const JOINERS = new Set(['with', 'from', 'and', 'for', 'the', 'of', 'in', 'at', 'on', 'by', 'to', 'de', 'du', 'des', 'la', 'le', 'et', 'und', 'an', 'or', 'vs', 'memory', 'supporting', 'events', 'incorporating', 'featuring', 'plus', 'day', 'days']);
const DAY = 24 * 60 * 60 * 1000;
const FURTHEST_DAYS = 550; // about 18 months

export function nameProblem(name: string, { hasNumber = false, year = null as number | null } = {}): string | null {
  if (name.length < 6) return 'The name is too short';
  if (name.length > 140) return 'The name is very long';
  if ((name.match(/[A-Za-z0-9]+/g) ?? []).length < 2) return 'The name is one word';
  if (PLACEHOLDER.test(name)) return 'The name looks like a test or placeholder';
  const letters = name.replace(/[^A-Za-z]/g, '');
  if (letters.length > 6 && letters === letters.toUpperCase()) return 'The name is in capitals';
  if (letters && letters === letters.toLowerCase()) return 'The name is in lowercase';
  if (/^[a-z]/.test(name)) return 'The name starts with a lowercase letter';
  const lower = (name.match(/(?<![\w'’])[a-z]{4,}\b/g) ?? []).find((w) => !JOINERS.has(w));
  if (lower) return `“${lower}” in the name is lowercase`;
  const years = name.match(/\b(?:19|20)\d\d\b/g);
  if (year && years && !years.includes(String(year))) return `The name says ${years[0]}, but the date is in ${year}`;
  if (!(COMPETITION_WORDS.test(name) || /\b[A-Z]{3,}\b/.test(name) || hasNumber)) return 'The name doesn’t look like a competition’s';
  return null;
}

const tokens = (name: string) => new Set(
  (name.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !/^(?:19|20)\d\d$/.test(w)),
);
/** The same competition, near enough: most of the longer name's words in common (years aside). */
export function sameName(a: string, b: string) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return false;
  const shared = [...ta].filter((w) => tb.has(w)).length;
  return shared / Math.max(ta.size, tb.size) >= 0.75;
}

export interface ReviewContext {
  /** Today, YYYY-MM-DD (the server's). */
  today: string;
  /** Names of the competitions already here on its date. */
  competitions: string[];
  /** Names of the other submissions for its date, sent before it and not rejected. */
  submissions: string[];
  /** Organisations it asks to be listed under that the submitter doesn't run. */
  unclaimed: string[];
}

export function reviewReasons(submission: any, context: ReviewContext): string[] {
  const c = submission?.competition ?? {};
  const name = String(c.name ?? '').replace(/\s+/g, ' ').trim();
  const date = typeof c.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.date) ? c.date : null;
  const year = yearOf(date);
  const number = tidyRegistration(c.sobhd, year);
  const reasons: string[] = [];

  if (!name) reasons.push('There’s no name');
  else {
    const problem = nameProblem(name, { hasNumber: !!number.value && !number.unread.length, year });
    if (problem) reasons.push(problem);
  }
  if (!date) reasons.push('There’s no date');
  else {
    const days = (Date.parse(date) - Date.parse(context.today)) / DAY;
    if (days < -1) reasons.push('The date has passed');
    else if (days > FURTHEST_DAYS) reasons.push('The date is more than 18 months away');
  }
  if (!String(c.location ?? '').trim()) reasons.push('There’s no town or city');
  for (const part of number.unread) reasons.push(`The registration number “${part}” isn’t in a format it knows`);

  const fresh = Object.values(submission?.newOrganisations ?? {}).map((o: any) => o?.name).filter(Boolean);
  if (fresh.length) reasons.push(`It starts ${fresh.length === 1 ? 'a new organisation' : 'new organisations'}: ${fresh.join(', ')}`);
  for (const org of context.unclaimed) reasons.push(`It lists it under ${org}, though they’re not one of its admins`);

  if (name) {
    const here = context.competitions.find((other) => sameName(name, other));
    if (here) reasons.push(`“${here.trim()}” is already here on the same day`);
    else {
      const sent = context.submissions.find((other) => sameName(name, other));
      if (sent) reasons.push(`“${sent.trim()}” was already submitted for the same day`);
    }
  }
  return reasons;
}
