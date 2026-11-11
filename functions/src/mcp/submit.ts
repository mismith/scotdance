import { z } from 'zod';
import { ISO_COUNTRIES, storedCountry, UK_NATIONS } from '../../../shared/countries';
import { addDays, inCountry, near, sameCompetition } from '../../../shared/knownCompetitions';
import { tidyRegistration, yearOf } from '../registration';
import { reviewReasons } from '../review';
import { venueKey } from '../utility/entityConfigs';
import { issuer } from './config';
import { ToolError } from './errors';
import { pushId } from './ids';
import type { Session } from './session';
import { defineTool, type Json, type Tool } from './toolkit';
import { isoDate, pick } from './view';

/**
 * add_competition (ADR 0018): files the same submission the Add a competition form files, as the person, through the
 * rules. The submission trigger (functions/src/submissions.ts) sees their uid as the submitter, approves a tidy one on
 * arrival (creating the competition and making them its admin) or holds it for review.
 */

type Rec = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const text = (v: string | undefined) => v?.trim() || undefined;

/** The wording the form asks them to accept */
export const AS_IS = 'I accept ScotDance.app comes as is, with no guarantees';

export interface AddCompetitionInput {
  country: string;
  date: string;
  name: string;
  town: string;
  venue?: string;
  space?: string;
  address?: string;
  registrationNumber?: string;
  organisations?: string[];
  yourName?: string;
  message?: string;
  acceptsAsIs: true;
  notTheOneAlreadyHere?: boolean;
  sameWeekendAs?: string;
}

export interface Timing {
  /** How long to wait for the submission to be approved as it arrives */
  waitMs: number;
  intervalMs: number;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  newId: () => string;
}

const REAL: Timing = { waitMs: 30_000, intervalMs: 1_500, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), now: Date.now, newId: pushId };

/** A country the way the form picks it: its code (`CA`, `GB-SCT`), or its name in English */
export function countryOf(given: string): { code: string; iso: string; region: string | null; name: string } {
  const want = given.trim();
  const upper = want.toUpperCase();
  const names = new Intl.DisplayNames('en', { type: 'region' });
  const direct = storedCountry(upper);
  if (direct) return { code: upper, ...direct, name: UK_NATIONS[upper] ?? names.of(upper) ?? upper };
  const folded = want.toLowerCase();
  const nation = Object.entries(UK_NATIONS).find(([, n]) => n.toLowerCase() === folded);
  if (nation) return { code: nation[0], iso: 'GB', region: nation[1], name: nation[1] };
  const byName = ISO_COUNTRIES.find((c) => (names.of(c) ?? '').toLowerCase() === folded || (folded === 'usa' && c === 'US') || (folded === 'uk' && c === 'GB'));
  if (byName) return { code: byName, iso: byName, region: null, name: names.of(byName) ?? byName };
  throw new ToolError(
    `“${want}” isn’t a country it knows. Use its two-letter code (CA, US, AU, NZ, ZA), or GB-SCT, GB-ENG, GB-WLS or GB-NIR for the UK’s nations.`,
  );
}

const realDay = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
};

const rows = (value: unknown): Array<Rec & { id: string }> =>
  Object.entries((value ?? {}) as Record<string, Rec>)
    .filter(([, v]) => v && typeof v === 'object' && typeof v.name === 'string' && v.name)
    .map(([id, v]) => ({ ...v, id }));

/** The first part of "Calgary, AB" */
const townName = (town: string) => town.split(',')[0].trim();

async function organisationIds(session: Session, given: string[]): Promise<string[]> {
  const all = rows(await session.read('organisations'));
  return [...new Set(given.map((g) => pick(all.map((o) => ({ id: o.id, label: str(o.name) })), g, (o) => o.label, 'organisation').id))];
}

/** A venue the app already knows (same name, same town): its map position, so the competition joins it as the form does for a known one */
async function knownPlace(session: Session, venue: string, town: string, country: { iso: string }) {
  const key = venueKey(venue, null, town);
  if (!key) return null;
  const entry = await session.read(`venues:index/${key}`).catch(() => null);
  const id = typeof entry === 'string' ? entry : str((entry as Rec | null)?.id);
  if (!id) return null;
  const v = (await session.read(`venues/${id}`).catch(() => null)) as Rec | null;
  if (!v || typeof v.lat !== 'number' || typeof v.lng !== 'number') return null;
  if (v.country && v.country !== country.iso) return null;
  return Object.fromEntries(
    Object.entries({ lat: v.lat, lng: v.lng, country: str(v.country) || undefined, region: str(v.region) || undefined, locality: str(v.locality) || undefined }).filter(([, x]) => x !== undefined),
  );
}

/** Add a competition: see the module comment */
export async function addCompetition(session: Session, input: AddCompetitionInput, timing: Partial<Timing> = {}): Promise<Json> {
  const t = { ...REAL, ...timing };
  const name = text(input.name);
  const town = text(input.town);
  const date = input.date.trim();
  if (!name) throw new ToolError('A competition needs a name.');
  if (!realDay(date)) throw new ToolError(`“${date}” is not a date. Use YYYY-MM-DD, like 2026-11-14.`);
  if (!town) throw new ToolError('A competition needs a town or city, like “Calgary, AB”.');
  if (input.acceptsAsIs !== true) throw new ToolError(`The organiser has to accept “${AS_IS}”. Show them that and pass acceptsAsIs: true once they do.`);
  const where = countryOf(input.country);
  if (input.sameWeekendAs !== undefined && !/^[^.#$/[\]]{1,128}$/.test(input.sameWeekendAs)) throw new ToolError('sameWeekendAs is the id of a submission add_competition just filed.');

  const account = (await session.read(`users/${session.uid}`)) as Rec | null;
  const email = str(account?.email).trim();
  if (!email) throw new ToolError('This account has no email address, which the submission needs to tell them it was approved.');
  const contactName = text(input.yourName) ?? text(str(account?.displayName));
  if (!contactName) throw new ToolError('Whose name should it carry? Ask the organiser for their name and pass it as yourName.');

  // What is already here on that day, and what the governing bodies list: the questions the form asks after the date
  const [here, known] = await Promise.all([
    session.read('competitions', { orderBy: 'date', startAt: addDays(date, -1), endAt: `${addDays(date, 1)}` }),
    session.read('knownCompetitions', { orderBy: 'date', startAt: addDays(date, -15), endAt: addDays(date, 1) }).catch(() => null),
  ]);
  const likeness = { name, venue: text(input.venue), locality: townName(town) };
  const onTheDay = rows(here)
    .map((c) => ({ ...c, day: isoDate(c.date) }) as Rec & { id: string; day: string | null })
    .filter((c): c is Rec & { id: string; day: string } => !!c.day && near(date, c.day as string) && inCountry(where, { country: str(c.country), region: str(c.region) }));
  const alike = onTheDay.filter((c) => sameCompetition(likeness, { name: str(c.name), venue: str(c.venue), location: str(c.location), locality: str(c.locality) }));
  if (alike.length && !input.notTheOneAlreadyHere) {
    const list = alike.slice(0, 3).map((c) => `“${str(c.name)}” (${c.day}, ${str(c.location) || 'no town'}, id ${c.id})`).join('; ');
    throw new ToolError(
      `That looks like a competition already on ScotDance.app: ${list}. Ask the organiser whether it is the same one: if it is, it doesn’t need adding `
      + '(its organisers manage it from their account), and if it really is a different one, call again with notTheOneAlreadyHere: true.',
    );
  }
  const likeListed = (k: Rec) => ({ name: str(k.name), venue: str(k.venue), locality: str(k.locality) });
  const match = rows(known)
    .filter((k) => typeof k.date === 'string' && near(date, k.date, str(k.end) || k.date) && inCountry(where, { country: str(k.country), region: str(k.region) }))
    // (Not one that is already here: that is the question above)
    .filter((k) => !onTheDay.some((c) => sameCompetition(likeListed(k), { name: str(c.name), venue: str(c.venue), location: str(c.location) })))
    .find((k) => sameCompetition(likeListed(k), likeness));

  // Fill what was left out from the listed one, as picking it on the form would; never replace what was given
  const filled: string[] = [];
  let venue = text(input.venue);
  let address = text(input.address);
  let organisations = input.organisations?.length ? await organisationIds(session, input.organisations) : [];
  if (match) {
    if (!venue && str(match.venue)) { venue = str(match.venue); filled.push('venue'); }
    if (!address && str(match.address)) { address = str(match.address); filled.push('address'); }
    if (!organisations.length && match.organisations && typeof match.organisations === 'object') {
      organisations = Object.keys(match.organisations as Rec).filter((id) => (match.organisations as Rec)[id] === true);
      if (organisations.length) filled.push('organisations');
    }
  }
  const place = venue ? await knownPlace(session, venue, town, where) : null;

  const registration = tidyRegistration(input.registrationNumber ?? '', yearOf(date));
  const registrationSaved = registration.value || undefined;
  const competition = Object.fromEntries(Object.entries({
    name,
    date,
    venue,
    space: text(input.space),
    address,
    location: town,
    sobhd: registrationSaved,
    // The country asked, as the venue search would put it, unless the venue was one the app knows
    country: where.iso,
    ...(where.region ? { region: where.region } : {}),
    ...(place ?? {}),
  }).filter(([, v]) => v !== undefined && v !== ''));
  const submission = {
    competition,
    contact: { name: contactName, email, ...(text(input.message) ? { message: text(input.message) } : {}), disclaimer: true },
    ...(organisations.length ? { organisations: Object.fromEntries(organisations.map((id) => [id, true])) } : {}),
    ...(input.sameWeekendAs ? { linkedTo: input.sameWeekendAs } : {}),
    submitted: new Date(t.now()).toISOString(),
    origin: issuer(),
  };

  const before = await managed(session);
  const id = t.newId();
  try {
    await session.write(`competitions:submissions/${id}`, submission);
  } catch {
    throw new ToolError('ScotDance.app didn’t take that submission. Check the name, date and town, and try again.');
  }

  // Approved as it arrives, the trigger makes the competition and the person its admin: wait for that to show
  const start = t.now();
  let added: string | null = null;
  for (;;) {
    await t.sleep(t.intervalMs);
    const now = await managed(session);
    for (const cid of [...now].filter((c) => !before.has(c))) {
      if ((await session.read(`competitions/${cid}/submissionId`)) === id) added = cid;
    }
    if (added || t.now() - start >= t.waitMs) break;
  }

  const common = {
    submission: id,
    saved: {
      ...competition,
      organisations: organisations.length ? organisations : undefined,
      contact: contactName,
    },
    ...(registration.unread.length ? { registrationWarning: `The registration number “${registration.unread.join(', ')}” isn’t in a format it knows, so it is saved as typed and will get a look before it is approved.` } : {}),
    ...(input.registrationNumber?.trim() && registrationSaved !== input.registrationNumber.trim() ? { registrationNote: registrationSaved ? `The registration number is saved as ${registrationSaved}.` : 'The registration number was left blank until there is one.' } : {}),
    ...(match ? { matchedListed: { name: str(match.name), source: str(match.source), filledIn: filled } } : {}),
    pin: place ? 'on the map (the venue is one ScotDance.app already knows)' : 'missing: the map pin comes from the venue search in the app. Open Details on the competition and choose the venue from the suggestions to add it.',
    ...(onTheDay.length && !alike.length ? { alsoThatDay: onTheDay.slice(0, 5).map((c) => `${str(c.name)} (${c.day}, ${str(c.location) || 'no town'})`) } : {}),
  };
  if (added) {
    return {
      summary: `Added. “${name}” is approved and they manage it now. They get an email at ${email} with a link to start adding the details.`,
      competition: added,
      next: `${issuer()}/competitions/${added}/manage`,
      ...common,
    };
  }
  const reasons = reviewReasons({ competition, contact: { email }, organisations: submission.organisations, submittedBy: session.uid }, {
    today: new Date(t.now()).toISOString().slice(0, 10),
    competitions: onTheDay.map((c) => str(c.name)),
    submissions: [],
    unclaimed: [],
  });
  return {
    summary: `Sent. “${name}” isn’t approved yet. It’s usually approved overnight, and they get an email at ${email} with a link to start adding the details.`,
    ...common,
    ...(reasons.length ? { likelyWaitingBecause: reasons, note: 'These are the checks a person looks at; the competition does not exist (and cannot be edited here) until it is approved.' } : { note: 'Nothing looked wrong, so it may just be slow: get_competitions will show it once approved.' }),
  };
}

async function managed(session: Session): Promise<Set<string>> {
  const permissions = (await session.read(`users:permissions/${session.uid}/competitions`)) as Record<string, unknown> | null;
  return new Set(Object.entries(permissions ?? {}).filter(([, on]) => on === true).map(([id]) => id));
}

export const submitTools = [
  defineTool({
    name: 'add_competition',
    title: 'Add a competition',
    description:
      'Add a new competition by submitting it, exactly as the app’s Add a competition form does. A tidy one is approved at once (it appears in '
      + 'get_competitions and the person manages it); otherwise it waits for a person to look, usually overnight, and the person is emailed either way. '
      + 'NOT UNDOABLE and not editable until approved: confirm every detail with the organiser first, and show them the line they must accept: '
      + `“${AS_IS}”, then pass acceptsAsIs: true. Needs country (two-letter code like CA, US, AU, NZ, ZA, or GB-SCT, GB-ENG, GB-WLS, GB-NIR), date (YYYY-MM-DD), `
      + 'name (as it should be shown: capitals and spelling are saved as given, and a name in capitals or lowercase, or a date that has passed, is held for review), '
      + 'and town (like “Calgary, AB”). Optional: venue, space (the hall within it), address, registrationNumber (saved in the association’s format, which the reply states), '
      + 'organisations (existing ones, by id or name, from get_organisations or the app), yourName (otherwise their account name), and a message only the reviewer sees. '
      + 'It checks what is already on ScotDance.app that day: if it looks like the same competition it is refused with that one’s id; if the organiser says it is a different one, pass '
      + 'notTheOneAlreadyHere: true. A competition a governing body already lists fills any venue, address or organisations you leave out. The map pin comes from the '
      + 'app’s venue search, which this cannot do: it is on the map only when the venue is one ScotDance.app already knows, and the reply says which. '
      + 'The reply says whether it was added straight away (with the competition id) or is waiting for review.',
    input: {
      country: z.string().min(1).describe('Two-letter country code (CA, US, AU, NZ, ZA, IE…) or GB-SCT, GB-ENG, GB-WLS, GB-NIR; a country’s English name also works'),
      date: z.string().describe('The first day, YYYY-MM-DD'),
      name: z.string().min(1).describe('The competition’s name'),
      town: z.string().min(1).describe('Town or city, with the province or state, like “Calgary, AB”'),
      venue: z.string().optional().describe('The venue’s name'),
      space: z.string().optional().describe('The hall or stage within the venue'),
      address: z.string().optional().describe('The street address'),
      registrationNumber: z.string().optional().describe('The association’s registration number, if it has one'),
      organisations: z.array(z.string()).max(10).optional().describe('Organisations it is run by or part of: ids or names of ones already on ScotDance.app'),
      yourName: z.string().optional().describe('The organiser’s name for the submission (default: their account’s name)'),
      message: z.string().optional().describe('Anything to ask or mention: only the reviewer sees it'),
      acceptsAsIs: z.literal(true).describe(`The organiser accepted: “${AS_IS}”`),
      notTheOneAlreadyHere: z.boolean().optional().describe('Only when the organiser says it is not the competition already on ScotDance.app that day'),
      sameWeekendAs: z.string().optional().describe('The submission id from an add_competition just sent, for the next day of the same event: the two are linked once both are approved'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    run: (input, session) => addCompetition(session, input as AddCompetitionInput),
  }),
] as unknown as Array<Tool<z.ZodRawShape>>;
