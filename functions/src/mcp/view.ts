import { ToolError } from './errors';
import { parsePlacings } from '../notifications';
import { entryName, isTeam, memberName, teamMembers, type EntryRecord } from '../utility/entries';

/**
 * What the read tools say about a competition, as pure functions over the plain records the database holds (the
 * shapes in web/src/types/competition.ts). Nothing here touches the database, so each is tested on its own. Ids are
 * kept in every answer so a later write tool can use them; lists are in Manage's order (`_order`).
 */

type Rec = Record<string, unknown>;
type Json = Record<string, unknown>;

/** The competition's parts, as stored under competitions:data/{id}; any may be missing */
export interface Parts {
  categories?: unknown;
  groups?: unknown;
  dances?: unknown;
  trophyEvents?: unknown;
  dancers?: unknown;
  staff?: unknown;
  platforms?: unknown;
  schedule?: unknown;
  results?: unknown;
  draws?: unknown;
}

/** A stored value as a plain object (a list that came back as an array is one keyed by position) */
const rec = (v: unknown): Rec => {
  if (!v || typeof v !== 'object') return {};
  return Array.isArray(v) ? Object.fromEntries(v.map((x, i) => [String(i), x]).filter(([, x]) => x != null)) : (v as Rec);
};
const str = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
const compareKeys = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Drop what is empty, so answers stay short */
export function compact<T>(value: T): T {
  if (Array.isArray(value)) return value.map(compact) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Rec)
        .map(([k, v]) => [k, compact(v)] as const)
        .filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)),
    ) as T;
  }
  return value;
}

/** Records with their ids, in the order Manage shows them */
function ordered(list: unknown, key: '_order' | 'order' = '_order'): Array<Rec & { id: string }> {
  return Object.entries(rec(list))
    .filter(([, v]) => v && typeof v === 'object')
    .map(([id, v]) => ({ ...(v as Rec), id }))
    .sort((a, b) => {
      const ao = typeof a[key] === 'number' ? (a[key] as number) : Number.POSITIVE_INFINITY;
      const bo = typeof b[key] === 'number' ? (b[key] as number) : Number.POSITIVE_INFINITY;
      return ao !== bo ? ao - bo : compareKeys(a.id, b.id);
    });
}

/** "9" before "10", and numbers before words */
function compareNumbers(a: string, b: string) {
  const na = Number.parseInt(a, 10);
  const nb = Number.parseInt(b, 10);
  const fa = Number.isFinite(na);
  const fb = Number.isFinite(nb);
  if (fa && fb && na !== nb) return na - nb;
  if (fa !== fb) return fa ? -1 : 1;
  return a.localeCompare(b, undefined, { numeric: true });
}

/** Lower case, no accents or apostrophes, for matching what someone typed */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’`]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** A date as YYYY-MM-DD, whichever way it was stored (text, or milliseconds from the old admin) */
export function isoDate(v: unknown): string | null {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = typeof v === 'number' || (typeof v === 'string' && /^\d{10,}$/.test(v)) ? new Date(Number(v)) : typeof v === 'string' && v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

const clip = (s: string, max = 600) => (s.length > max ? `${s.slice(0, max)}… (${s.length - max} more characters)` : s);

// ---------- the model: Manage's lists, with names resolved

export interface Model {
  categories: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; label: string; name: string; categoryId: string; raw: Rec }>;
  dances: Array<{ id: string; label: string; raw: Rec }>;
  trophyEvents: Array<{ id: string; name: string; raw: Rec }>;
  dancers: Array<{ id: string; number: string; name: string; groupId: string; raw: Rec }>;
  staff: Array<{ id: string; name: string; type: string; raw: Rec }>;
  platforms: Array<{ id: string; name: string; raw: Rec }>;
  parts: Parts;
}

export function model(parts: Parts): Model {
  const categories = ordered(parts.categories).map((c) => ({ id: c.id, name: str(c.name) || 'Untitled category' }));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const groups = ordered(parts.groups).map((g) => {
    const category = catName.get(str(g.categoryId)) ?? '';
    return { id: g.id, name: str(g.name), categoryId: str(g.categoryId), label: `${category} ${str(g.name)}`.trim() || 'Untitled age group', raw: g };
  });
  const dances = ordered(parts.dances).map((d) => {
    const steps = str(d.steps);
    const name = str(d.name);
    return { id: d.id, label: (steps ? `${name} (${steps})` : name) || 'Untitled dance', raw: d };
  });
  const trophyEvents = ordered(parts.trophyEvents).map((t) => ({ id: t.id, name: str(t.name) || 'Untitled trophy event', raw: t }));
  const dancers = ordered(parts.dancers)
    .map((d) => ({
      id: d.id,
      number: str(d.number),
      name: isTeam(d) ? entryName(d as EntryRecord) : `${str(d.firstName)} ${str(d.lastName)}`.trim() || 'Unnamed dancer',
      groupId: str(d.groupId),
      raw: d,
    }))
    .sort((a, b) => compareNumbers(a.number, b.number) || a.name.localeCompare(b.name));
  const staff = ordered(parts.staff).map((s) => ({ id: s.id, name: `${str(s.firstName)} ${str(s.lastName)}`.trim() || 'Unnamed', type: str(s.type), raw: s }));
  const platforms = ordered(parts.platforms).map((p) => ({ id: p.id, name: str(p.name) || 'Untitled platform', raw: p }));
  return { categories, groups, dances, trophyEvents, dancers, staff, platforms, parts };
}

const named = (items: Array<{ id: string }>, label: (i: any) => string) => new Map(items.map((i) => [i.id, label(i)]));
const ref = (id: string, names: Map<string, string>) => ({ id, name: names.get(id) ?? null });

// ---------- finding what the assistant named

/** An id, or else a name that picks out exactly one; otherwise a sentence that says what to do */
export function pick<T extends { id: string }>(items: T[], given: string, label: (i: T) => string, what: string): T {
  const want = given.trim();
  const byId = items.find((i) => i.id === want);
  if (byId) return byId;
  const f = fold(want);
  const exact = items.filter((i) => fold(label(i)) === f);
  const near = exact.length ? exact : items.filter((i) => fold(label(i)).includes(f));
  if (near.length === 1) return near[0];
  if (!near.length) throw new NotFound(`No ${what} matches “${want}”. ${listOf(items.map(label))}`);
  throw new NotFound(`“${want}” fits ${near.length} ${what}s: ${near.slice(0, 8).map((i) => `${label(i)} (${i.id})`).join('; ')}. Use the id.`);
}
const listOf = (names: string[]) => (names.length ? `They are: ${names.slice(0, 12).join('; ')}${names.length > 12 ? `; and ${names.length - 12} more` : ''}.` : 'There are none yet.');

/** A reference that does not fit; said as it is */
export class NotFound extends ToolError {}

// ---------- get_competition

/** What each part of a linked competition covers, as the app words it (ADR 0007) */
const SYNC_PARTS: Record<string, string> = {
  about: 'description and logo',
  venue: 'venue, address and place',
  registration: 'registration address and dates',
  links: 'links and files',
  visibility: 'listed and published',
  organisations: 'organisations',
  staff: 'the whole staff list',
};

export interface CompetitionContext {
  id: string;
  today: string;
  info: Rec;
  /** Names of the organisations it belongs to, by id */
  organisations: Record<string, string>;
  link: { primary: string; competitions: Record<string, string> } | null;
  sync: Record<string, unknown>;
}

export function competitionSummary(ctx: CompetitionContext, parts: Parts): Json {
  const m = model(parts);
  const { info } = ctx;
  const staffOf = (type: string) => m.staff.filter((s) => s.type === type).length;
  const days = ordered(rec(parts.schedule).days, 'order');
  const results = rec(parts.results);
  let dancesWithResults = 0;
  for (const byDance of Object.values(results)) {
    for (const [danceId, raw] of Object.entries(rec(byDance))) {
      if (danceId !== 'callbacks' && danceId !== 'overall' && (Array.isArray(raw) || raw === false)) dancesWithResults += 1;
    }
  }
  const synced = Object.entries(ctx.sync).filter(([, on]) => on === true).map(([part]) => SYNC_PARTS[part] ?? part);
  const links = ordered(info.links).map((l) => ({ name: str(l.name), url: str(l.url) }));
  return compact({
    today: ctx.today,
    id: ctx.id,
    name: str(info.name),
    date: isoDate(info.date),
    venue: str(info.venue),
    space: str(info.space),
    address: str(info.address),
    place: [str(info.locality), str(info.region), str(info.country)].filter(Boolean).join(', ') || str(info.location),
    description: clip(str(info.description)),
    listed: info.listed === true,
    published: info.published === true,
    registration: { url: str(info.registrationURL), opens: isoDate(info.registrationStart), closes: isoDate(info.registrationEnd) },
    links,
    organisations: Object.keys(rec(info.organisations)).map((id) => ({ id, name: ctx.organisations[id] ?? null })),
    resultsTabHidden: parts.results === false ? true : undefined,
    scheduleTabHidden: parts.schedule === false ? true : undefined,
    linked: ctx.link
      ? {
          primary: ctx.link.primary === ctx.id ? 'this one' : ctx.link.primary,
          competitions: Object.entries(ctx.link.competitions).map(([id, name]) => ({ id, name })),
          takenFromPrimary: synced.length ? synced : undefined,
          note: synced.length
            ? `These parts follow the primary competition (${ctx.link.primary}) and cannot be changed here; change them there.`
            : undefined,
        }
      : undefined,
    counts: {
      categories: m.categories.length,
      ageGroups: m.groups.length,
      dances: m.dances.length,
      trophyEvents: m.trophyEvents.length,
      entries: m.dancers.length,
      teams: m.dancers.filter((d) => isTeam(d.raw)).length,
      judges: staffOf('Judge'),
      pipers: staffOf('Piper'),
      volunteers: staffOf('Volunteer'),
      sponsors: staffOf('Sponsor'),
      platforms: m.platforms.length,
      scheduleDays: days.length,
      danceResultsEntered: dancesWithResults,
      ageGroupsWithDraws: Object.keys(rec(parts.draws)).length,
    },
  });
}

// ---------- get_dances

export function dancesView(parts: Parts): Json {
  const m = model(parts);
  const staffNames = named(m.staff, (s) => s.name);
  const entriesIn = new Map<string, number>();
  for (const d of m.dancers) entriesIn.set(d.groupId, (entriesIn.get(d.groupId) ?? 0) + 1);
  const sponsor = (v: unknown) => {
    const s = str(v);
    if (!s) return undefined;
    return staffNames.has(s) ? { id: s, name: staffNames.get(s) } : { name: s };
  };
  const groupNames = named(m.groups, (g) => g.label);
  const groupIdsOf = (raw: Rec) => m.groups.filter((g) => rec(raw.groupIds)[g.id] === true).map((g) => g.id);
  return compact({
    categories: m.categories,
    ageGroups: m.groups.map((g) => ({
      id: g.id,
      name: g.label,
      category: g.categoryId ? ref(g.categoryId, named(m.categories, (c) => c.name)) : undefined,
      trophy: str(g.raw.trophy),
      sponsor: sponsor(g.raw.sponsor),
      notRunAsChampionship: g.raw.notChampionship === true ? true : undefined,
      teams: g.raw.teams === true ? true : undefined,
      entries: entriesIn.get(g.id) ?? 0,
      dances: m.dances.filter((d) => rec(d.raw.groupIds)[g.id] === true).map((d) => d.id),
    })),
    dances: m.dances.map((d) => {
      const on = groupIdsOf(d.raw);
      return {
        id: d.id,
        name: d.label,
        shortName: str(d.raw.shortName),
        steps: str(d.raw.steps),
        ageGroups: on.length === m.groups.length && on.length ? 'all' : on,
      };
    }),
    trophyEvents: m.trophyEvents.map((t) => ({
      id: t.id,
      name: t.name,
      trophy: str(t.raw.trophy),
      sponsor: sponsor(t.raw.sponsor),
      openTo: groupIdsOf(t.raw).map((id) => groupNames.get(id)),
      ageGroups: groupIdsOf(t.raw),
      dancedAs: t.raw.danceId ? ref(str(t.raw.danceId), named(m.dances, (d) => d.label)) : undefined,
    })),
  });
}

// ---------- get_dancers

/** How many entries are listed at once */
export const DANCER_CAP = 200;

export function dancersView(parts: Parts, ageGroup: string | undefined, offset = 0): Json {
  const m = model(parts);
  let list = m.dancers;
  let group: Model['groups'][number] | undefined;
  if (ageGroup) {
    group = pick(m.groups, ageGroup, (g) => g.label, 'age group');
    list = list.filter((d) => d.groupId === group!.id);
  }
  const groupNames = named(m.groups, (g) => g.label);
  const page = list.slice(offset, offset + DANCER_CAP);
  const left = list.length - offset - page.length;
  return compact({
    ageGroup: group ? { id: group.id, name: group.label } : undefined,
    total: list.length,
    entries: page.map((d) => {
      const team = isTeam(d.raw);
      return {
        id: d.id,
        number: d.number,
        name: d.name,
        ageGroup: ref(d.groupId, groupNames),
        location: str(d.raw.location),
        studio: str(d.raw.studio),
        title: str(d.raw.title),
        team: team ? true : undefined,
        members: team ? teamMembers(d.raw).map(([key, mem]) => ({ key, name: memberName(mem) })) : undefined,
      };
    }),
    more: left > 0 ? left : undefined,
    note: left > 0 ? `${left} more entries. Pass offset ${offset + page.length} for the next ones, or an ageGroup to narrow.` : undefined,
  });
}

// ---------- get_staff

export function staffView(parts: Parts): Json {
  const m = model(parts);
  const person = (s: Model['staff'][number]) => ({
    id: s.id,
    name: s.name,
    location: str(s.raw.location),
    website: str(s.raw.website),
    description: clip(str(s.raw.description), 300),
  });
  const of = (type: string) => m.staff.filter((s) => s.type === type).map(person);
  const known = new Set(['Judge', 'Piper', 'Volunteer', 'Sponsor']);
  return compact({
    judges: of('Judge'),
    pipers: of('Piper'),
    volunteers: of('Volunteer'),
    sponsors: of('Sponsor'),
    other: m.staff.filter((s) => !known.has(s.type)).map((s) => ({ ...person(s), type: s.type })),
    platforms: m.platforms.map((p) => ({ id: p.id, name: p.name, description: str(p.raw.description) })),
  });
}

// ---------- get_schedule

export function scheduleView(parts: Parts, day?: string): Json {
  if (parts.schedule === false) return { scheduleTabHidden: true, note: 'The schedule tab is hidden for this competition.' };
  const m = model(parts);
  const names = new Map<string, string>([
    ...m.groups.map((g) => [g.id, g.label] as [string, string]),
    ...m.trophyEvents.map((t) => [t.id, `${t.name} (trophy event)`] as [string, string]),
  ]);
  const staffNames = named(m.staff, (s) => s.name);
  const platformNames = named(m.platforms, (p) => p.name);
  const danceNames = named(m.dances, (d) => d.label);
  const ids = (v: unknown) => (Array.isArray(v) ? v : Object.values(rec(v))).filter((x) => x != null && x !== '').map(String);
  // Gaps left between age groups on a platform have all-digit ids
  const realIds = (v: unknown) => ids(v).filter((id) => !/^\d+$/.test(id));
  let days = ordered(rec(parts.schedule).days, 'order');
  if (day) days = [pick(days, day, (d) => `${str(d.name)} ${isoDate(d.date) ?? ''}`.trim() || d.id, 'day')];
  return compact({
    days: days.map((d) => ({
      id: d.id,
      name: str(d.name),
      date: isoDate(d.date),
      description: str(d.description),
      blocks: ordered(d.blocks, 'order').map((b) => ({
        id: b.id,
        name: str(b.name),
        description: str(b.description),
        events: ordered(b.events, 'order').map((e) => ({
          id: e.id,
          name: str(e.name),
          description: str(e.description),
          dances: ordered(e.dances, 'order').map((sd) => ({
            id: sd.id,
            name: str(sd.name) || (sd.danceId ? danceNames.get(str(sd.danceId)) : undefined),
            danceId: str(sd.danceId),
            description: str(sd.description),
            platforms: Object.entries(rec(sd.platforms)).map(([pid, p]) => ({
              id: pid,
              name: platformNames.get(pid) ?? null,
              ageGroups: realIds(rec(p).orderedGroupIds).map((id) => ref(id, names)),
              judges: realIds(rec(p).orderedJudgeIds).map((id) => ref(id, staffNames)),
            })),
          })),
        })),
      })),
    })),
  });
}

// ---------- get_results

const CALLBACKS = 'callbacks';
const OVERALL = 'overall';
/** Stand-ins ("?") are a timestamp where a dancer's id would be */
const isPlaceholder = (id: string) => /^\d+$/.test(id);

type Raw = unknown;

/** A list of placings, resolved to numbers and names */
function placed(raw: Raw, byId: Map<string, Model['dancers'][number]>): Json {
  if (raw === false) return { state: 'no results', meaning: 'Marked as having no results (none placed).' };
  if (!Array.isArray(raw) || !raw.length) return { state: 'not entered' };
  const places = parsePlacings(raw);
  const reverse = typeof raw[0] === 'string' && raw[0].startsWith('reverse:') ? Number.parseInt(raw[0].slice(8), 10) : null;
  const counts = new Map<number, number>();
  for (const p of places.values()) counts.set(p, (counts.get(p) ?? 0) + 1);
  const rows = [...places.entries()].map(([id, place]) => {
    const d = byId.get(id);
    return {
      place,
      tied: (counts.get(place) ?? 0) > 1 ? true : undefined,
      number: d?.number,
      name: d?.name,
      entryId: d ? id : undefined,
      standIn: !d && isPlaceholder(id) ? true : undefined,
      missing: !d && !isPlaceholder(id) ? true : undefined,
    };
  });
  return compact({
    state: rows.some((x) => x.standIn) ? 'entered, with a ? to fix' : 'entered',
    reversedFrom: reverse && reverse > 0 ? reverse : undefined,
    placings: rows,
  });
}

/** A list of callbacks (who danced on), by number */
function called(raw: Raw, byId: Map<string, Model['dancers'][number]>): Json {
  if (raw === false) return { state: 'no results', meaning: 'Marked “No callbacks”.' };
  if (!Array.isArray(raw) || !raw.length) return { state: 'not entered' };
  const ids = [...parsePlacings(raw).keys()];
  const rows = ids
    .map((id) => ({ id, d: byId.get(id) }))
    .sort((a, b) => compareNumbers(a.d?.number ?? '~', b.d?.number ?? '~'))
    .map(({ id, d }) => ({ number: d?.number, name: d?.name, entryId: d ? id : undefined, standIn: !d && isPlaceholder(id) ? true : undefined, missing: !d && !isPlaceholder(id) ? true : undefined }));
  return compact({ state: 'entered', called: rows });
}

/** Placings rows listed in one answer before the rest are only summarised */
export const RESULT_ROW_CAP = 400;

export const RESULT_KEY = [
  '“state”: entered, no results (the organiser marked none placed), or not entered yet.',
  '“tied”: shares the place with another. “reversedFrom”: places were announced from that place up to 1st (championships).',
  '“standIn”: a ? the organiser typed for a dancer not yet matched, to fix in Manage; “missing”: the entry has been removed.',
].join(' ');

export function resultsView(parts: Parts, opts: { ageGroup?: string; trophyEvent?: string; draws?: boolean }): Json {
  if (parts.results === false) return { resultsTabHidden: true, note: 'The results tab is hidden for this competition.' };
  const m = model(parts);
  const results = rec(parts.results);
  const draws = rec(parts.draws);
  const byId = new Map(m.dancers.map((d) => [d.id, d]));

  const forGroup = (g: Model['groups'][number]) => {
    const mine = rec(results[g.id]);
    const dances = m.dances.filter((d) => rec(d.raw.groupIds)[g.id] === true);
    const category = m.categories.find((c) => c.id === g.categoryId)?.name;
    const hasOverall = !!category && !/^primary/i.test(category);
    return {
      id: g.id,
      name: g.label,
      callbacks: called(mine[CALLBACKS], byId),
      dances: dances.map((d) => ({
        id: d.id,
        name: d.label,
        ...placed(mine[d.id], byId),
        draw: opts.draws && Array.isArray(rec(draws[g.id])[d.id]) ? (rec(draws[g.id])[d.id] as unknown[]).map(String) : undefined,
      })),
      overall: hasOverall ? placed(mine[OVERALL], byId) : undefined,
    };
  };
  const forTrophy = (t: Model['trophyEvents'][number]) => {
    const mine = rec(results[t.id]);
    return {
      id: t.id,
      name: t.name,
      callbacks: t.raw.danceId ? called(mine[CALLBACKS], byId) : undefined,
      placings: placed(mine[OVERALL], byId),
    };
  };

  if (opts.trophyEvent) {
    const t = pick(m.trophyEvents, opts.trophyEvent, (x) => x.name, 'trophy event');
    return compact({ key: RESULT_KEY, trophyEvents: [forTrophy(t)] });
  }
  if (opts.ageGroup) {
    const g = pick(m.groups, opts.ageGroup, (x) => x.label, 'age group');
    return compact({ key: RESULT_KEY, ageGroups: [forGroup(g)] });
  }

  // Everything: full placings for as many age groups as fit, then one line each for the rest
  let rows = 0;
  const full: Json[] = [];
  const brief: Json[] = [];
  for (const g of m.groups) {
    const out = forGroup(g);
    const size = JSON.stringify(out).match(/"place":/g)?.length ?? 0;
    if (rows + size <= RESULT_ROW_CAP || !full.length) {
      rows += size;
      full.push(out);
    } else {
      const states = [out.callbacks, ...(out.dances as Json[]), out.overall].filter(Boolean).map((x) => (x as Json).state);
      brief.push({ id: g.id, name: g.label, entered: states.filter((s) => String(s).startsWith('entered')).length, of: states.length });
    }
  }
  return compact({
    key: RESULT_KEY,
    ageGroups: full,
    trophyEvents: m.trophyEvents.map(forTrophy),
    moreAgeGroups: brief.length ? brief : undefined,
    note: brief.length ? `${brief.length} more age groups are not shown in full. Pass ageGroup (id or name) to see one.` : undefined,
  });
}

// ---------- find

/** Hits listed per kind */
export const FIND_CAP = 25;

export function findView(parts: Parts, query: string): Json {
  const m = model(parts);
  const q = fold(query);
  if (!q) throw new NotFound('Give a name or number to look for.');
  const words = q.split(' ');
  const matches = (text: string) => {
    const f = fold(text);
    return words.every((w) => f.includes(w));
  };
  const groupNames = named(m.groups, (g) => g.label);
  const cap = <T>(hits: T[]) => ({ items: hits.slice(0, FIND_CAP), more: hits.length > FIND_CAP ? hits.length - FIND_CAP : undefined });
  const byNumber = /^#?\d+$/.test(q) ? q.replace('#', '') : null;
  const entries = cap(
    m.dancers.filter((d) => (byNumber ? d.number === byNumber : matches(`${d.name} ${d.number} ${str(d.raw.studio)} ${str(d.raw.location)} ${teamMembers(d.raw).map(([, x]) => memberName(x)).join(' ')}`))),
  );
  const staff = cap(m.staff.filter((s) => matches(s.name)));
  const groups = cap(m.groups.filter((g) => matches(g.label)));
  const dances = cap(m.dances.filter((d) => matches(d.label)));
  const trophyEvents = cap(m.trophyEvents.filter((t) => matches(`${t.name} ${str(t.raw.trophy)}`)));
  const platforms = cap(m.platforms.filter((p) => matches(p.name)));
  return compact({
    query,
    entries: entries.items.map((d) => ({ id: d.id, number: d.number, name: d.name, ageGroup: ref(d.groupId, groupNames), team: isTeam(d.raw) ? true : undefined })),
    moreEntries: entries.more,
    staff: staff.items.map((s) => ({ id: s.id, name: s.name, type: s.type })),
    ageGroups: groups.items.map((g) => ({ id: g.id, name: g.label })),
    dances: dances.items.map((d) => ({ id: d.id, name: d.label })),
    trophyEvents: trophyEvents.items.map((t) => ({ id: t.id, name: t.name })),
    platforms: platforms.items.map((p) => ({ id: p.id, name: p.name })),
    moreMatches: [entries.more, staff.more, groups.more, dances.more, trophyEvents.more, platforms.more].some(Boolean)
      ? 'Some kinds have more matches than shown. Be more specific.'
      : undefined,
    nothingFound: !(entries.items.length + staff.items.length + groups.items.length + dances.items.length + trophyEvents.items.length + platforms.items.length)
      ? 'Nothing matches. Try part of a name, or an entry number.'
      : undefined,
  });
}
