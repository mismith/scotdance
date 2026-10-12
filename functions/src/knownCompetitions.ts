// Known competitions (docs/adr/0009-known-competitions.md): the ones the
// governing bodies list, read from their public feeds so Add a competition
// can offer them before an organiser types one in. They're never shown as
// competitions, only as suggestions there. No contact details are read.
//
//   knownCompetitions/{source}:{date}:{name} = {
//     source, date, end?, name, venue?, address?, locality?, region?,
//     country, website?, organisations?, fetched,
//   }
//   knownCompetitions:runs/{source} = { at, ok?, count?, from?, error? }
//
// Each run replaces a source's rows wholesale: the sources have no stable
// ids, and nothing points at a row. A run that fails, or finds nothing,
// leaves the last good rows be and says what went wrong.

export const SOURCES = ['sdc', 'scotdance-usa', 'rsobhd'] as const;
export type Source = (typeof SOURCES)[number];
export const isSource = (v: unknown): v is Source => (SOURCES as readonly unknown[]).includes(v);

/** A competition as a source lists it. */
export interface Known {
  /** First day, YYYY-MM-DD. */
  date: string
  /** Last day, when it runs over several. */
  end?: string
  name: string
  venue?: string
  address?: string
  /** The town or city. */
  locality?: string
  /** As the venue search puts it: AB, NC, QLD, or a UK nation (Scotland). */
  region?: string
  /** ISO 3166-1: CA, US, GB… */
  country: string
  website?: string
  /** Who runs it, as the source names it: matched to an organisation here, never stored. */
  organiser?: string
}

// Dates ------------------------------------------------------------------------

const DAY = 86_400_000;
export function addDays(day: string, n: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const isoDay = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);

// Text ---------------------------------------------------------------------------

const text = (value: unknown) => (value == null ? '' : String(value).replace(/\s+/g, ' ').trim());
/** "TBD", "tbc", "." and the like: nothing yet. */
const blank = (value: string) => (/^(?:\.+|-+|tb[acd]\.?|n\/?a|online(?: via zoom)?)$/i.test(value) ? '' : value);

// "Fall Competition and Workshop" is a competition; "Santa's Fling Workshop"
// isn't.
const NOT_COMPETITION = /workshop|practice|lecture|meeting|exam/i;
const COMPETITION = /competition|championship|premiership|festival|games|gathering/i;
export const isCompetition = (name: string) => !NOT_COMPETITION.test(name) || COMPETITION.test(name);

/** The words that tell names apart, for keys: "W&DHDA 9th Annual Winter" → wdhda 9th annual winter. */
const slug = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/([A-Z])&([A-Z])/g, '$1$2')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** A link as given ("www.chda.ab.ca"), as a URL, or nothing if it isn't one. */
export function website(raw: string) {
  const value = text(raw);
  if (!value || value.includes('@') || /\s/.test(value)) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname.includes('.') ? url.href : '';
  } catch {
    return '';
  }
}

// Places ---------------------------------------------------------------------------

const PROVINCES: Record<string, string> = {
  ALBERTA: 'AB', 'BRITISH COLUMBIA': 'BC', MANITOBA: 'MB', 'NEW BRUNSWICK': 'NB', 'NEWFOUNDLAND AND LABRADOR': 'NL',
  'NOVA SCOTIA': 'NS', 'NORTHWEST TERRITORIES': 'NT', NUNAVUT: 'NU', ONTARIO: 'ON', 'PRINCE EDWARD ISLAND': 'PE',
  QUEBEC: 'QC', SASKATCHEWAN: 'SK', YUKON: 'YT',
};
const STATES: Record<string, string> = {
  ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR', CALIFORNIA: 'CA', COLORADO: 'CO', CONNECTICUT: 'CT',
  DELAWARE: 'DE', 'DISTRICT OF COLUMBIA': 'DC', FLORIDA: 'FL', GEORGIA: 'GA', HAWAII: 'HI', IDAHO: 'ID', ILLINOIS: 'IL',
  INDIANA: 'IN', IOWA: 'IA', KANSAS: 'KS', KENTUCKY: 'KY', LOUISIANA: 'LA', MAINE: 'ME', MARYLAND: 'MD',
  MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN', MISSISSIPPI: 'MS', MISSOURI: 'MO', MONTANA: 'MT',
  NEBRASKA: 'NE', NEVADA: 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', OHIO: 'OH', OKLAHOMA: 'OK', OREGON: 'OR', PENNSYLVANIA: 'PA',
  'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT',
  VERMONT: 'VT', VIRGINIA: 'VA', WASHINGTON: 'WA', 'WEST VIRGINIA': 'WV', WISCONSIN: 'WI', WYOMING: 'WY',
};
const AU_STATES: Record<string, string> = {
  'NEW SOUTH WALES': 'NSW', VICTORIA: 'VIC', QUEENSLAND: 'QLD', 'SOUTH AUSTRALIA': 'SA', 'WESTERN AUSTRALIA': 'WA',
  TASMANIA: 'TAS', 'NORTHERN TERRITORY': 'NT', 'AUSTRALIAN CAPITAL TERRITORY': 'ACT',
};
const REGIONS: Record<string, Record<string, string>> = { CA: PROVINCES, US: STATES, AU: AU_STATES };

/** A province, state or territory as the venue search writes it (AB, NC, QLD), by its code or name. */
function regionCode(country: string, part: string) {
  const table = REGIONS[country];
  if (!table) return null;
  const upper = part.toUpperCase();
  return Object.values(table).includes(upper) ? upper : (table[upper] ?? null);
}

const NATIONS: Record<string, string> = { scotland: 'Scotland', england: 'England', wales: 'Wales', 'northern ireland': 'Northern Ireland' };
const COUNTRY_ALIASES: Record<string, string> = { uk: 'GB', 'great britain': 'GB', usa: 'US', 'united states of america': 'US', us: 'US' };
let countryNames: Map<string, string> | null = null;
/** A country's code from its English name ("United Kingdom" → GB), and a UK nation's name as its region. */
export function countryOf(name: string): { country: string; region?: string } | null {
  const key = text(name).toLowerCase().replace(/\./g, '');
  if (NATIONS[key]) return { country: 'GB', region: NATIONS[key] };
  if (COUNTRY_ALIASES[key]) return { country: COUNTRY_ALIASES[key] };
  if (!countryNames) {
    countryNames = new Map();
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    const A = 'A'.charCodeAt(0);
    for (let i = 0; i < 26 * 26; i++) {
      const code = String.fromCharCode(A + Math.floor(i / 26), A + (i % 26));
      const found = names.of(code);
      // (First wins: GB is the United Kingdom, not its alias UK.)
      if (found && found !== code && !/unknown/i.test(found) && !countryNames.has(found.toLowerCase())) countryNames.set(found.toLowerCase(), code);
    }
  }
  const code = countryNames.get(key);
  return code ? { country: code } : null;
}

// A UK postcode's area says which nation (BT is Northern Ireland, and so on).
const SCOTTISH = new Set(['AB', 'DD', 'DG', 'EH', 'FK', 'G', 'HS', 'IV', 'KA', 'KW', 'KY', 'ML', 'PA', 'PH', 'TD', 'ZE']);
const WELSH = new Set(['CF', 'LD', 'LL', 'NP', 'SA']);
const UK_POSTCODE = /^([A-Z]{1,2})\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
function nationOf(postcode: string) {
  const area = postcode.match(UK_POSTCODE)?.[1]?.toUpperCase();
  if (!area) return null;
  if (area === 'BT') return 'Northern Ireland';
  if (SCOTTISH.has(area)) return 'Scotland';
  if (WELSH.has(area)) return 'Wales';
  return 'England';
}
const POSTCODE = /^(?:[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}|[A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{3,5}(?:-\d{4})?)$/i;
// Counties people add after the town ("Corby, Northants"): not the town.
const COUNTY = /shire$|^(?:northants|argyll|fife|angus|moray|lothian|midlothian|co\.? [a-z]+)$/i;

/**
 * An address as the feeds give it, "Venue, 1 Street, Town, ST 12345, Country"
 * with any of them missing, in parts: read from the end (country, postcode,
 * state), so the town is what's left last. With `venueFirst`, the first part
 * is always the venue's name (blank as "."), as RSOBHD's feed has it.
 */
export function readPlace(parts: string[], { venueFirst = false, country: fallback = '' } = {}) {
  let rest = parts.map(text);
  let venue = '';
  if (venueFirst) {
    venue = blank(rest[0] ?? '');
    rest = rest.slice(1);
  }
  rest = rest.map(blank).filter(Boolean);
  let country = fallback;
  let region = '';
  const found = rest.length ? countryOf(rest[rest.length - 1]) : null;
  if (found) {
    country = found.country;
    region = found.region ?? '';
    rest.pop();
  }
  // Postcodes, a state and counties, from the end: "NC 28078", "Utah 84043",
  // "QLD", "4159", "Northants". (One state: before it, "Washington" is the town.)
  let state = false;
  for (;;) {
    const last = rest[rest.length - 1];
    if (!last) break;
    const withZip = last.match(/^(.+?)\s+\d{5}(?:-\d{4})?$/);
    const code = state ? null : regionCode(country, withZip ? withZip[1] : last);
    if (code) {
      region ||= code;
      state = true;
    } else if (POSTCODE.test(last)) {
      if (country === 'GB') region ||= nationOf(last) ?? '';
    } else if (!COUNTY.test(last)) break;
    rest.pop();
  }
  // The town is what's left last, unless that's a street ("12 Main St").
  const locality = rest.length && !/^\d/.test(rest[rest.length - 1]) ? (rest.pop() ?? '') : '';
  // Without a venue of its own, a first part that isn't a street is one.
  if (!venueFirst && rest.length > 1 && !/^\d/.test(rest[0])) venue = rest.shift() ?? '';
  return { venue, address: rest.join(', '), locality, region, country };
}

// ICS (ScotDance USA's and RSOBHD's calendars) --------------------------------------

export interface IcsProperty { params: Record<string, string>; value: string }
export type IcsEvent = Record<string, IcsProperty>;

/** Each VEVENT's properties (the first of each name), lines unfolded, values still escaped. */
export function readIcs(ics: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let event: IcsEvent | null = null;
  for (const line of ics.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n')) {
    if (line === 'BEGIN:VEVENT') event = {};
    else if (line === 'END:VEVENT') {
      if (event) events.push(event);
      event = null;
    } else if (event) {
      const m = line.match(/^([A-Za-z0-9-]+)((?:;[^:]*)?):(.*)$/);
      if (!m || event[m[1].toUpperCase()]) continue;
      const params = Object.fromEntries(m[2].split(';').filter(Boolean).map((p) => {
        const i = p.indexOf('=');
        return [p.slice(0, i).toUpperCase(), p.slice(i + 1).replace(/^"|"$/g, '')];
      }));
      event[m[1].toUpperCase()] = { params, value: m[3] };
    }
  }
  return events;
}

const unescape = (v: string) => v.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
/** A list's values (CATEGORIES: "Championship,Premiership"), unescaped. */
const listOf = (v: string) => v.split(/(?<!\\),/).map(unescape);
/** An address's parts: one value, its commas escaped ("Hall\\, 1 Street\\, Town"). */
const partsOf = (v: string) => unescape(v).split(',');

/**
 * The days an event covers: its first, and its last when there are more. An
 * all-day DTEND is the day after (it's exclusive); a timed one is on its own
 * day. A time in UTC is taken as that day there.
 */
export function icsDays(event: IcsEvent): { date: string; end?: string } | null {
  const day = (p?: IcsProperty) => {
    const m = p?.value.match(/^(\d{4})(\d{2})(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  };
  const date = day(event.DTSTART);
  if (!date) return null;
  const until = day(event.DTEND);
  const allDay = event.DTEND?.params.VALUE === 'DATE' || /^\d{8}$/.test(event.DTEND?.value ?? '');
  const last = until ? (allDay ? addDays(until, -1) : until) : date;
  return last > date ? { date, end: last } : { date };
}

/** The first web address in an event's description that isn't a shared document (entry forms are). */
function linkIn(description: string) {
  for (const m of description.matchAll(/href="([^"]+)"|(https?:\/\/[^\s<>"]+)/gi)) {
    const url = website(m[1] ?? m[2]);
    if (url && !/\/\/(?:drive|docs)\.google\.com\//.test(url)) return url;
  }
  return '';
}

/**
 * ScotDance USA's calendar: every registered competition in the US. Names
 * start with the region they're in, "(SE) ", which comes off.
 */
export function readScotDanceUsa(ics: string): Known[] {
  return readIcs(ics).flatMap((event) => {
    if (/cancel/i.test(event.STATUS?.value ?? '')) return [];
    const name = text(unescape(event.SUMMARY?.value ?? '')).replace(/^\(\s*[A-Z]{1,3}\s*\)\s*/, '').replace(/[\s;,:]+$/, '');
    const days = icsDays(event);
    if (!name || !days || !isCompetition(name)) return [];
    const place = readPlace(partsOf(event.LOCATION?.value ?? ''), { country: 'US' });
    return [{
      ...days,
      name,
      ...place,
      website: linkIn(unescape(event.DESCRIPTION?.value ?? '')),
    }];
  });
}

const RSOBHD_KINDS = /^(?:competition|championship)s?$|premiership/i;
/**
 * RSOBHD's calendar: competitions, championships and premierships around the
 * world (mostly the UK), not its lectures and meetings. Each links to its
 * page there, with the entry form.
 */
export function readRsobhd(ics: string): Known[] {
  return readIcs(ics).flatMap((event) => {
    const kinds = listOf(event.CATEGORIES?.value ?? '').map(text);
    if (!kinds.some((k) => RSOBHD_KINDS.test(k))) return [];
    const name = text(unescape(event.SUMMARY?.value ?? ''));
    const days = icsDays(event);
    const place = readPlace(partsOf(event.LOCATION?.value ?? ''), { venueFirst: true });
    if (!name || !days || !place.country) return [];
    return [{ ...days, name, ...place, website: website(unescape(event.URL?.value ?? '')) }];
  });
}

// ScotDance Canada's event list --------------------------------------------------------
//
// A spreadsheet they update every month or so (scotdance.ca/events). It has
// no ids, mixes real dates with text like "Oct 24-25", splits some events
// into a row per day, and keeps provinces only as section headings on its
// second sheet. Its contact name and email columns are never read.

export type Row = ReadonlyArray<unknown>;
export interface Sheet { sheet: string; data: Row[] }

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Every day from `first` to `last`, both included (two weeks at most). */
function span(first: string, last: string) {
  const days = [first];
  while (days.length < 14 && days[days.length - 1] < last) days.push(addDays(days[days.length - 1], 1));
  return days;
}

/**
 * The days a Date cell or a "Jul 31-Aug 1" cell covers, in the list's year:
 * a date in another year is a slip ("Festival of the Tartans" dated 2025 on
 * the 2026 list). Dates come back from the spreadsheet as UTC midnight.
 */
function cellDays(cell: unknown, year: number): string[] | null {
  if (cell instanceof Date) return [isoDay(year, cell.getUTCMonth(), cell.getUTCDate())];
  const m = text(cell).match(/^([a-z]{3})[a-z]*\.?\s*(\d{1,2})(?:\s*[-–]\s*(?:([a-z]{3})[a-z]*\.?\s*)?(\d{1,2}))?$/i);
  if (!m) return null;
  const month = (name: string) => MONTHS.indexOf(name.toLowerCase());
  if (month(m[1]) < 0 || (m[3] && month(m[3]) < 0)) return null;
  const first = isoDay(year, month(m[1]), Number(m[2]));
  return m[4] ? span(first, isoDay(year, month(m[3] ?? m[1]), Number(m[4]))) : [first];
}

/** Where the columns are, by their headings. The contact ones aren't looked for. */
function columns(rows: Row[]) {
  const at = rows.findIndex((row) => row.some((cell) => text(cell) === 'Date'));
  const headings = (rows[at] ?? []).map(text);
  const find = (re: RegExp) => headings.findIndex((h) => re.test(h));
  return {
    at,
    date: find(/^date$/i),
    name: find(/^title/i),
    venue: find(/^venue$/i),
    address: find(/^venue address/i),
    city: find(/^city/i),
    organiser: find(/organi[sz]er/i),
    website: find(/^website/i),
  };
}

const sameName = (...parts: string[]) => parts.map(slug).join('|');

/** Province codes by event, from the sheet that groups events under each province. */
function provinces(sheet: Sheet | undefined) {
  const found = new Map<string, string>();
  if (!sheet) return found;
  const col = columns(sheet.data);
  let province = '';
  for (const row of sheet.data.slice(col.at + 1)) {
    if (!text(row[col.name])) province = PROVINCES[text(row[col.date]).toUpperCase()] ?? province;
    else found.set(sameName(text(row[col.name]), text(row[col.organiser])), province);
  }
  return found;
}

/** The list's competitions, one per competition however many rows it took. */
export function readSdc(sheets: Sheet[]): Known[] {
  const [byDate, byProvince] = sheets;
  if (!byDate) return [];
  const year = Number(byDate.data.map((row) => row.map(text).join(' ').match(/\b(20\d\d)\b/)?.[1]).find(Boolean));
  const col = columns(byDate.data);
  if (!year || col.at < 0 || col.date < 0 || col.name < 0) return [];
  const provinceOf = provinces(byProvince);
  const events: Array<Known & { days: string[] }> = [];

  byDate.data.forEach((row, i) => {
    if (i <= col.at) return;
    const name = text(row[col.name]);
    const days = cellDays(row[col.date], year);
    // Month headings, blank rows, workshops and practices.
    if (!name || !days || !isCompetition(name)) return;
    const organiser = text(row[col.organiser]);
    events.push({
      days,
      date: days[0],
      name,
      venue: blank(text(row[col.venue])),
      address: blank(text(row[col.address]).replace(/,$/, '')),
      locality: blank(text(row[col.city])),
      region: provinceOf.get(sameName(name, organiser)) ?? '',
      country: 'CA',
      website: website(text(row[col.website])),
      organiser,
    });
  });

  // A row per day ("Canmore Highland Games" twice) becomes one event, even
  // when the rows name different organisers.
  events.sort((a, b) => a.days[0].localeCompare(b.days[0]));
  const merged: typeof events = [];
  for (const event of events) {
    const same = merged.find((e) => slug(e.name) === slug(event.name) && daysBetween(e.days[e.days.length - 1], event.days[0]) <= 1);
    if (!same) merged.push(event);
    else {
      same.days = [...new Set([...same.days, ...event.days])].sort();
      same.venue ||= event.venue;
      same.address ||= event.address;
      same.locality ||= event.locality;
      same.region ||= event.region;
      same.website ||= event.website;
    }
  }
  return merged.map(({ days, ...event }) => ({ ...event, date: days[0], ...(days.length > 1 && { end: days[days.length - 1] }) }));
}

/** The "View 2026 SDC Events List" links on scotdance.ca/events (the file's name changes with every update). */
export function sdcLists(html: string, base: string) {
  const found: Array<{ year: number; url: string }> = [];
  for (const [, attrs, inner] of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const label = text(inner.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' '));
    const year = label.match(/^View\s+(20\d\d)\s+SDC\s+Events?\s+List$/i)?.[1];
    const href = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const url = href?.[1] ?? href?.[2] ?? href?.[3];
    if (year && url && !found.some((f) => f.year === Number(year))) {
      found.push({ year: Number(year), url: new URL(url.replace(/&amp;/g, '&'), base).href });
    }
  }
  return found;
}

// Organisations -------------------------------------------------------------------------

const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** How many single-letter changes turn `a` into `b`, up to `most` (then `most + 1`). */
function distance(a: string, b: string, most: number) {
  if (Math.abs(a.length - b.length) > most) return most + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    if (Math.min(...row) > most) return most + 1;
    previous = row;
  }
  return previous[b.length];
}

/**
 * The organisation here a source's organiser names: by its name (a slip or
 * two allowed in a long one, like "HighIand") or its short name.
 */
export function organisationFor(organiser: string | undefined, organisations: Record<string, any>): string | null {
  const name = plain(organiser ?? '');
  if (name.length < 3) return null;
  let near: string | null = null;
  for (const [id, org] of Object.entries(organisations ?? {})) {
    const theirs = plain(org?.name ?? '');
    if (theirs === name || (org?.shortName && plain(org.shortName) === name)) return id;
    if (!near && theirs.length >= 16 && distance(theirs, name, 2) <= 2) near = id;
  }
  return near;
}

// Running a source ------------------------------------------------------------------------

type Fetch = (url: string, init?: any) => Promise<{ ok: boolean; status: number; text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer> }>;
const HEADERS = { 'User-Agent': 'ScotDance.app (+https://scotdance.app; admin@scotdance.app)' };

async function get(f: Fetch, url: string) {
  const res = await f(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
  return res;
}

export const SDC_PAGE = 'https://scotdance.ca/events/';
export const SCOTDANCE_USA_ICS = 'https://calendar.google.com/calendar/ical/c_irsnqe04r9p6fcnncdiu5q7a04%40group.calendar.google.com/public/basic.ics';
export const RSOBHD_ICS = 'https://www.rsobhd.net/events.ics';

/** Each source: where it's read from, and how. */
export const READERS: Record<Source, (f: Fetch) => Promise<{ rows: Known[]; from: string[] }>> = {
  async sdc(f) {
    const lists = sdcLists(await (await get(f, SDC_PAGE)).text(), SDC_PAGE);
    if (!lists.length) throw new Error('There’s no “View … SDC Events List” link on scotdance.ca/events');
    // (Only loaded here: every function shares this code.)
    const { default: readXlsxFile } = await import('read-excel-file/node');
    const rows: Known[] = [];
    for (const { url } of lists) {
      const file = Buffer.from(await (await get(f, url)).arrayBuffer());
      rows.push(...readSdc((await readXlsxFile(file)) as Sheet[]));
    }
    return { rows, from: lists.map((l) => l.url) };
  },
  async 'scotdance-usa'(f) {
    return { rows: readScotDanceUsa(await (await get(f, SCOTDANCE_USA_ICS)).text()), from: [SCOTDANCE_USA_ICS] };
  },
  async rsobhd(f) {
    return { rows: readRsobhd(await (await get(f, RSOBHD_ICS)).text()), from: [RSOBHD_ICS] };
  },
};

/** How long ago something can have ended and still be offered (it's sometimes added after, for its results). */
const KEEP_DAYS = 90;

/** The rows to store for a source's competitions, by key: no organiser, just the organisation it matched. */
export function rowsFor(source: Source, known: Known[], { fetched, organisations = {} }: { fetched: string; organisations?: Record<string, any> }) {
  const since = addDays(fetched.slice(0, 10), -KEEP_DAYS);
  const rows: Record<string, Record<string, unknown>> = {};
  for (const { organiser, ...k } of known) {
    if ((k.end ?? k.date) < since) continue;
    const organisation = organisationFor(organiser, organisations);
    const base = `${source}:${k.date}:${slug(k.name) || 'competition'}`;
    let key = base;
    for (let n = 2; rows[key]; n++) key = `${base}-${n}`;
    rows[key] = {
      source,
      ...Object.fromEntries(Object.entries(k).filter(([, v]) => v)),
      ...(organisation && { organisations: { [organisation]: true } }),
      fetched,
    };
  }
  return rows;
}

export interface RunResult { count?: number; error?: string }

/** Reads a source and replaces its rows, or says what went wrong and keeps the last ones. */
export async function refreshSource(db: any, source: Source, { fetch: f = fetch as unknown as Fetch, now = new Date() } = {}): Promise<RunResult> {
  const at = now.toISOString();
  const run = db.child(`knownCompetitions:runs/${source}`);
  try {
    const { rows: known, from } = await READERS[source](f);
    const organisations = (await db.child('organisations').get()).val() ?? {};
    const rows = rowsFor(source, known, { fetched: at, organisations });
    const count = Object.keys(rows).length;
    if (!count) throw new Error('It listed no competitions');
    const before = (await db.child('knownCompetitions').orderByKey().startAt(`${source}:`).endAt(`${source}:`).get()).val() ?? {};
    await db.update({
      ...Object.fromEntries(Object.keys(before).map((key) => [`knownCompetitions/${key}`, null])),
      ...Object.fromEntries(Object.entries(rows).map(([key, row]) => [`knownCompetitions/${key}`, row])),
      [`knownCompetitions:runs/${source}`]: { at, ok: at, count, from },
    });
    return { count };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`Known competitions from ${source}:`, err);
    await run.update({ at, error });
    return { error };
  }
}

/** Every source (or the one asked for), one after another. */
export async function refresh(db: any, only?: unknown, options?: Parameters<typeof refreshSource>[2]) {
  const results: Partial<Record<Source, RunResult>> = {};
  for (const source of isSource(only) ? [only] : SOURCES) results[source] = await refreshSource(db, source, options);
  return results;
}
