import type { Reference } from 'firebase-admin/database';

// Text some organisers type all in capitals ("MARY MACKENZIE", "PREMIER",
// "12 & UNDER 14 YEARS"), written as it's spelled instead. Import tidies it
// as it reads a list (web/src/lib/capitals.ts, a copy of the tidying kept in
// step by a test); System admin › Cleanup › Capitals lists what's already
// saved that way, with what each becomes.
//
// Spelling comes from the same words typed properly elsewhere first (so
// "MCLEOD" takes "McLeod", "ECHDA" stays ECHDA), then simple rules: a
// capital to start, Mc and O' names, small joining words, and short words
// (AB, ON), numerals (III) and words with no vowels (PDB) left as they are.
// Mac names can't be guessed (Mackenzie and MacKenzie are both common),
// which is why a list is shown before it's saved.
//
// Also dotted abbreviations in competition names: "E.C.H.D.A." is ECHDA.
// Only competition names: elsewhere dots are mostly a person's initials.

/** Every word of a kind, by its lower case, in the spelling most often typed. */
export type Known = Map<string, string>;

const WORD = /[\p{L}\p{M}']+/gu;

/**
 * All in capitals: no small letters, and a word of 4 or more capitals ("59th"
 * aside), or short words ("MIA LEE") each typed otherwise in `same`, the
 * same kind of thing elsewhere, one of them with a capital.
 */
export function isShouting(s: unknown, same?: Known): s is string {
  if (typeof s !== 'string') return false;
  const letters = s.replace(/\d+(st|nd|rd|th)\b/gi, '');
  if (/\p{Ll}/u.test(letters) || !/\p{Lu}{2}/u.test(letters)) return false;
  if (/\p{Lu}{4,}/u.test(letters)) return true;
  // At least one a name-like word: "ON" is only ever "on" (Niagara-on-the-Lake), so it's Ontario.
  const forms = [...letters.matchAll(WORD)].map(([w]) => [w, same?.get(w.toLowerCase()) ?? w]);
  return forms.every(([w, form]) => form !== w) && forms.some(([, form]) => /^\p{Lu}/u.test(form));
}

/** No small letters ("MIA"): a name in capitals, in a list whose names are (isShouting). */
export function allCapitals(s: unknown): s is string {
  return typeof s === 'string' && !/\p{Ll}/u.test(s) && /\p{Lu}{2}/u.test(s);
}

const SMALL = new Set(['and', 'of', 'the', 'de', 'du', 'des', 'la', 'le', 'van', 'von', 'der', 'den', 'da', 'di']);
const ROMAN = /^(i{2,3}|iv|vi{1,3}|ix|x{2,3})$/i;

/**
 * Learns spellings from text typed with small letters ("ECHDA January
 * Competition" teaches ECHDA and January). Counts, so the most common wins.
 */
export function learn(values: Iterable<unknown>, into: Map<string, Map<string, number>> = new Map()) {
  for (const v of values) {
    if (typeof v !== 'string' || !/\p{Ll}/u.test(v)) continue;
    for (const [w] of v.matchAll(WORD)) {
      if (!/\p{L}/u.test(w)) continue;
      const forms = into.get(w.toLowerCase()) ?? new Map<string, number>();
      forms.set(w, (forms.get(w) ?? 0) + 1);
      into.set(w.toLowerCase(), forms);
    }
  }
  return into;
}

/** The most typed spelling of each word learned. */
export function known(counts: Map<string, Map<string, number>>): Known {
  const out: Known = new Map();
  for (const [key, forms] of counts) out.set(key, [...forms].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]);
  return out;
}

function ruleCase(word: string, first: boolean) {
  const lower = word.toLowerCase();
  if (!first && SMALL.has(lower)) return lower;
  if (ROMAN.test(word) || word.length <= 2 || !/[aeiouy]/i.test(word)) return word;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (/^mc./.test(lower)) return 'Mc' + cap(lower.slice(2));
  if (/^o'./.test(lower)) return "O'" + cap(lower.slice(2));
  return cap(lower);
}

/** Text in capitals as it's spelled; anything else as it is. */
export function tidyCapitals(s: string, ...dictionaries: Known[]): string {
  return isShouting(s, dictionaries[0]) ? spelled(s, ...dictionaries) : s;
}

/** Each word as it's spelled in `dictionaries` (the same kind of thing first), else by the rules. */
export function spelled(s: string, ...dictionaries: Known[]): string {
  let first = true;
  return s.replace(/[\p{L}\p{M}'\d]+/gu, (w) => {
    const isFirst = first;
    first = false;
    if (/^\d+(st|nd|rd|th)$/i.test(w)) return w.toLowerCase();
    if (!/\p{L}/u.test(w)) return w;
    // Short ones (ON, AB, A Left) only as typed in the same kind of thing,
    // and with a capital: Ed and Jo, but not "on" or "s" for ON and S.
    for (const d of w.length <= 2 ? dictionaries.slice(0, 1) : dictionaries) {
      const form = d.get(w.toLowerCase());
      if (form && (w.length > 2 || /\p{Lu}/u.test(form))) return isFirst && SMALL.has(form) ? form.charAt(0).toUpperCase() + form.slice(1) : form;
    }
    return ruleCase(w, isFirst);
  });
}

/** "E.C.H.D.A. Open" is "ECHDA Open"; initials with spaces ("P. F. Steele") stay. */
export function undot(s: string): string {
  return s.replace(DOTTED, (m, letters: string) => letters.replace(/\./g, ''));
}
const DOTTED = /(?<![\p{L}.])((?:\p{Lu}\.){1,}\p{Lu})\.?(?![\p{L}])/gu;

// --- System admin › Cleanup › Capitals

/** What each kind of thing is called in the list. */
const KINDS = {
  name: 'Name',
  location: 'Location',
  category: 'Category',
  group: 'Age group',
  dance: 'Dance',
  platform: 'Platform',
  staff: 'Staff',
  competition: 'Name',
} as const;
type Kind = keyof typeof KINDS;

export interface CapitalsFix {
  /** From competitions:data/{id} (or competitions/{id} for the name). */
  path: string;
  /** "101" for a dancer, else what it is: "Category", "Age group"… */
  what: string;
  /** Each field changed: [now, becomes]. */
  fields: Record<string, [string, string]>;
}

export interface CapitalsCompetition {
  id: string;
  name: string;
  date: string;
  fixes: CapitalsFix[];
}

type Item = Record<string, unknown>;
type CompData = {
  dancers?: Record<string, Item>;
  categories?: Record<string, Item>;
  groups?: Record<string, Item>;
  dances?: Record<string, Item>;
  platforms?: Record<string, Item>;
  staff?: Record<string, Item>;
};

// Where each kind's text is, and which dictionary spells it.
const FIELDS: Array<[keyof CompData, string[], Kind]> = [
  ['categories', ['name'], 'category'],
  ['groups', ['name'], 'group'],
  ['dances', ['name'], 'dance'],
  ['platforms', ['name'], 'platform'],
  ['staff', ['firstName', 'lastName', 'location'], 'staff'],
  ['dancers', ['firstName', 'lastName', 'location'], 'name'],
];
const kindOf = (coll: keyof CompData, field: string): Kind =>
  field === 'location' ? 'location' : coll === 'staff' ? 'name' : FIELDS.find(([c]) => c === coll)![2];

const entries = (o: unknown) => Object.entries((o && typeof o === 'object' ? o : {}) as Record<string, Item>).filter(([, v]) => v && typeof v === 'object');

/** Every competition's spellings, by kind, and of every word anywhere. */
export function dictionaries(all: Record<string, CompData>, names: string[]) {
  const by = new Map<Kind | 'any', Map<string, Map<string, number>>>();
  const add = (kind: Kind, v: unknown) => {
    learn([v], by.get(kind) ?? by.set(kind, new Map()).get(kind));
    learn([v], by.get('any') ?? by.set('any', new Map()).get('any'));
  };
  for (const data of Object.values(all))
    for (const [coll, fields] of FIELDS) for (const [, item] of entries(data?.[coll])) for (const f of fields) add(kindOf(coll, f), item[f]);
  for (const n of names) add('competition', n);
  return new Map([...by].map(([k, counts]) => [k, known(counts)]));
}

/** A competition's text in capitals (and its name's dots), with what each becomes. */
export function capitalsIn(
  data: CompData | null | undefined,
  name: unknown,
  dicts: Map<Kind | 'any', Known>,
): { fixes: CapitalsFix[]; dotted: CapitalsFix | null } {
  const any = dicts.get('any') ?? new Map();
  // Short words in a location are mostly a state or country (VIC, ON, SCO).
  // Once a list's names are in capitals, every name in capitals is (MIA), as import has it.
  const fix = (kind: Kind, v: unknown, loud = false) => {
    if (typeof v !== 'string') return '';
    const same = dicts.get(kind) ?? new Map<string, string>();
    const shouting = loud && kind === 'name' ? allCapitals(v.trim()) : isShouting(v.trim(), kind === 'location' ? undefined : same);
    return shouting ? spelled(v.trim(), same, any) : v.trim();
  };
  const fixes: CapitalsFix[] = [];
  for (const [coll, fields, kind] of FIELDS) {
    const list: CapitalsFix[] = [];
    const loud = entries(data?.[coll]).some(([, item]) => isShouting(item.firstName) || isShouting(item.lastName));
    for (const [id, item] of entries(data?.[coll])) {
      const changed: Record<string, [string, string]> = {};
      for (const f of fields) {
        const v = item[f];
        const to = fix(kindOf(coll, f), v, loud);
        if (typeof v === 'string' && to !== v.trim()) changed[f] = [v, to];
      }
      if (!Object.keys(changed).length) continue;
      const num = item.number ?? item.num;
      list.push({
        path: `${coll}/${id}`,
        what: coll === 'dancers' ? String(num ?? '') : KINDS[kind],
        fields: changed,
      });
    }
    if (coll === 'dancers') list.sort((a, b) => Number(a.what || Infinity) - Number(b.what || Infinity));
    fixes.push(...list);
  }
  // A dotted name is fixed with its dots, capitals and all, and what was
  // dotted stays in capitals (ECHDA).
  let dotted: CapitalsFix | null = null;
  const typed = String(name ?? '').trim();
  const abbreviations: Known = new Map(
    [...typed.matchAll(DOTTED)].map(([, letters]) => [letters.replace(/\./g, '').toLowerCase(), letters.replace(/\./g, '')]),
  );
  const to = isShouting(undot(typed)) ? spelled(undot(typed), abbreviations, dicts.get('competition') ?? new Map(), any) : undot(typed);
  if (typeof name === 'string' && to !== name.trim()) {
    const f: CapitalsFix = { path: 'name', what: KINDS.competition, fields: { name: [name, to] } };
    if (undot(name) !== name) dotted = f;
    else fixes.unshift(f);
  }
  return { fixes, dotted };
}

/** A competition's day, YYYY-MM-DD (dates are mostly that, some ISO strings or ms). */
const dayOf = (date: unknown) => (typeof date === 'number' ? new Date(date).toISOString() : String(date ?? '')).slice(0, 10);

/** Every competition with text in capitals, and those with dots in their name, newest first. */
export function getOnFindCapitals(db: Reference) {
  return async () => {
    const comps = ((await db.child('competitions').get()).val() ?? {}) as Record<string, { name?: string; date?: unknown }>;
    const all = ((await db.child('competitions:data').get()).val() ?? {}) as Record<string, CompData>;
    const dicts = dictionaries(
      all,
      Object.values(comps).map((c) => String(c?.name ?? '')),
    );
    const capitals: CapitalsCompetition[] = [];
    const dots: CapitalsCompetition[] = [];
    for (const [id, c] of Object.entries(comps)) {
      const found = capitalsIn(all[id], c?.name, dicts);
      const base = { id, name: String(c?.name ?? ''), date: dayOf(c?.date) };
      if (found.fixes.length) capitals.push({ ...base, fixes: found.fixes });
      if (found.dotted) dots.push({ ...base, fixes: [found.dotted] });
    }
    const byDate = (a: CapitalsCompetition, b: CapitalsCompetition) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name);
    return { capitals: capitals.sort(byDate), dots: dots.sort(byDate) };
  };
}
