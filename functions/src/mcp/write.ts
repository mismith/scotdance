import { isChampionshipName } from '../../../shared/labels';
import { looksLikeLink, LINK_PROBLEM } from '../../../shared/links';
import {
  entriesOf,
  KINDS,
  planAdd,
  planAddLink,
  planHideTab,
  planListed,
  planPublished,
  planRemove,
  planRemoveLink,
  planReorder,
  planSetDanceGroup,
  planSetDancerName,
  planSetDancers,
  planSetDetail,
  planSetField,
  planSetLinkName,
  planSetLinkUrl,
  planSetNotChampionship,
  planSetTrophyEventGroup,
  tabHasContent,
  dancerRecord,
  titleOf,
  type CollectionKind,
  type CompetitionState,
  type Plan,
  type RawData,
  type RawInfo,
} from '../../../shared/plans';
import type { MemberDraft } from '../../../shared/teamMembers';
import { clean, commitChange, setAt, type Committed, type Updates } from './changes';
import { ToolError } from './errors';
import { pushId } from './ids';
import { assertManages, loadParts, readLinkLocks, type Part } from './read';
import type { Session } from './session';
import { fold, pick, SYNC_PARTS } from './view';

type Rec = Record<string, unknown>;

/** The sections of a competition's data the planners read */
export const WRITE_PARTS = ['categories', 'groups', 'dances', 'trophyEvents', 'dancers', 'staff', 'platforms'] as const satisfies readonly Part[];
/** Everything a removal may take with it */
export const REMOVE_PARTS = [...WRITE_PARTS, 'schedule', 'results', 'points', 'sheets', 'draws'] as const;

export interface Created {
  kind: string;
  id: string;
  name: string;
}

// ---------- the working copy

const isAncestor = (a: string, b: string) => b.startsWith(`${a}/`);

/** Add one write to an update, folding it into a place written higher up, or replacing writes inside it */
function put(target: Updates, path: string, value: unknown) {
  for (const key of Object.keys(target)) {
    if (isAncestor(key, path)) {
      const whole = target[key];
      if (whole && typeof whole === 'object') {
        target[key] = structuredClone(whole);
        setAt(target[key] as Rec, path.slice(key.length + 1), clean(value));
        return;
      }
      throw new Error(`cannot write ${path} inside ${key}`);
    }
  }
  for (const key of Object.keys(target)) if (isAncestor(path, key)) delete target[key];
  target[path] = value;
}

/**
 * A change being put together: the sub-plans of one tool call, applied one after another to a copy of the
 * competition so each sees the ones before it (an age group added, then dances switched on for it).
 */
export class Work {
  readonly state: CompetitionState;
  readonly data: Updates = {};
  readonly info: Updates = {};
  readonly created: Created[] = [];
  readonly warnings: string[] = [];

  constructor(original: CompetitionState, readonly newId: () => string = pushId) {
    this.state = structuredClone(original);
    this.state.data ??= {};
  }

  /** Apply a plan from `shared/plans`: its paths and its warnings */
  apply(p: Plan): void {
    if (Object.keys(p.lasting).length) {
      throw new ToolError(
        'That would also delete judges’ sheets (the scans), for good: their files go with them and it can’t be undone. '
        + 'Remove it in the app (Manage), which asks first.',
      );
    }
    for (const [path, value] of Object.entries(p.data)) {
      put(this.data, path, value);
      setAt(this.state.data as Rec, path, clean(value));
    }
    for (const [path, value] of Object.entries(p.info)) {
      put(this.info, path, value);
      this.state.info ??= {};
      setAt(this.state.info as Rec, path, clean(value));
    }
    for (const w of p.warnings) if (!this.warnings.includes(w)) this.warnings.push(w);
  }

  get empty() {
    return !Object.keys(this.data).length && !Object.keys(this.info).length;
  }

  made(kind: string, id: string, name: string) {
    this.created.push({ kind, id, name });
  }
}

// ---------- reading and committing

export interface Loaded {
  state: CompetitionState;
  /** Parts of a linked competition that follow the primary, by name */
  locks: { sync: Record<string, boolean>; primary: string };
}

/** The competition as the planners need it, read as the person (and checked to be one they manage) */
export async function loadState(session: Session, competition: string, sections: readonly string[]): Promise<Loaded> {
  await assertManages(session, competition);
  const [parts, info, locks] = await Promise.all([
    loadParts(session, competition, [...sections] as Part[]),
    session.read(`competitions/${competition}`),
    readLinkLocks(session, competition),
  ]);
  if (!info || typeof info !== 'object') throw new ToolError(`There is no competition ${competition}.`);
  return { state: { info: info as RawInfo, data: parts as RawData }, locks };
}

/** Which linked part (ADR 0007) each field of the competition's record belongs to */
const FIELD_PART: Record<string, string> = {
  description: 'about', image: 'about',
  venue: 'venue', space: 'venue', address: 'venue', location: 'venue', lat: 'venue', lng: 'venue', country: 'venue', region: 'venue', locality: 'venue',
  registrationURL: 'registration', registrationStart: 'registration', registrationEnd: 'registration',
  listed: 'visibility', published: 'visibility', links: 'links', organisations: 'organisations',
};

/** A sentence for a path that belongs to a part shared from the primary competition, else null */
export function lockGuard(competition: string, locks: Loaded['locks']) {
  return (path: string): string | null => {
    let part: string | undefined;
    const info = `competitions/${competition}/`;
    if (path.startsWith(info)) part = FIELD_PART[path.slice(info.length).split('/')[0]];
    else if (path.startsWith(`competitions:data/${competition}/staff`)) part = 'staff';
    if (!part || !locks.sync[part]) return null;
    return (
      `The ${SYNC_PARTS[part] ?? part} of this competition is shared from ${locks.primary}, so it can only be changed there. `
      + 'Change it on the primary competition and it follows.'
    );
  };
}

export interface Done {
  summary: string;
  created: Created[];
  warnings: string[];
  /** For undo_change; absent when nothing needed changing */
  change?: string;
  /** Said when nothing was changed */
  note?: string;
}

/** Write what a tool worked out, with its log entry, and say what happened */
export async function finish(session: Session, competition: string, tool: string, loaded: Loaded, work: Work, summary: string): Promise<Done> {
  const committed: Committed | null = await commitChange(
    session,
    {
      competition,
      tool,
      summary,
      data: work.data,
      info: work.info,
      current: { data: loaded.state.data, info: loaded.state.info },
      guard: lockGuard(competition, loaded.locks),
    },
    work.newId,
  );
  if (!committed) return { summary: 'Nothing needed changing: it is already as asked.', created: [], warnings: work.warnings, note: 'unchanged' };
  return { summary, created: work.created, warnings: work.warnings, change: committed.id };
}

// ---------- checks the app's forms make

const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

/** A field's value as the app saves it: trimmed text, or null to clear */
const text = (v: string | number | null | undefined): string | null | undefined => (v === undefined ? undefined : v === null ? null : trim(v) || null);

function must(value: string | null | undefined, what: string): string {
  const v = text(value);
  if (!v) throw new ToolError(`${what} can’t be empty.`);
  return v;
}

function realDate(v: string, withTime: boolean): boolean {
  const m = (withTime ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/ : /^(\d{4})-(\d{2})-(\d{2})$/).exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return false;
  return !withTime || (Number(m[4]) < 24 && Number(m[5]) < 60);
}

const linkOk = (v: string) => {
  if (!looksLikeLink(v)) throw new ToolError(`“${v}”: ${LINK_PROBLEM}`);
  return v;
};

// ---------- update_competition

export interface DetailsInput {
  name?: string;
  date?: string;
  venue?: string | null;
  space?: string | null;
  address?: string | null;
  location?: string | null;
  description?: string | null;
  registrationUrl?: string | null;
  registrationOpens?: string | null;
  registrationCloses?: string | null;
  links?: Array<{ id?: string; label?: string | null; url?: string }>;
  removeLinks?: string[];
}

const DETAIL_FIELDS = [
  ['name', 'Name'], ['date', 'Date'], ['venue', 'Venue'], ['space', 'Space'], ['address', 'Address'], ['location', 'Town or city'],
  ['description', 'Description'], ['registrationUrl', 'Registration link'], ['registrationOpens', 'Registration opens'], ['registrationCloses', 'Registration closes'],
] as const;
const STORED_AS: Record<string, string> = { registrationUrl: 'registrationURL', registrationOpens: 'registrationStart', registrationCloses: 'registrationEnd' };

export function planDetails(work: Work, input: DetailsInput): string[] {
  const said: string[] = [];
  for (const [key, label] of DETAIL_FIELDS) {
    const raw = input[key];
    if (raw === undefined) continue;
    let value = text(raw);
    if (key === 'name') value = must(raw, 'The name');
    if (key === 'date') {
      value = must(raw, 'The date');
      if (!realDate(value, false)) throw new ToolError(`“${value}” is not a date. Use YYYY-MM-DD, like 2026-11-14.`);
    }
    if ((key === 'registrationOpens' || key === 'registrationCloses') && value && !realDate(value, true)) {
      throw new ToolError(`“${value}” is not a date and time. Use YYYY-MM-DDTHH:mm, like 2026-09-01T09:00.`);
    }
    if (key === 'registrationUrl' && value) linkOk(value);
    work.apply(planSetDetail(STORED_AS[key] ?? key, value ?? null, label));
    said.push(`changed ${label.toLowerCase()}`);
  }

  const links = entriesOf((work.state.info?.links ?? {}) as Record<string, { name?: string; url?: string; _order?: number }>);
  for (const link of input.links ?? []) {
    if (link.id) {
      const have = links.find((l) => l.id === link.id);
      if (!have) throw new ToolError(`There is no link ${link.id} on this competition. Leave the id out to add a link.`);
      if (link.label !== undefined) work.apply(planSetLinkName(link.id, text(link.label) ?? null));
      if (link.url !== undefined) work.apply(planSetLinkUrl(link.id, linkOk(must(link.url, 'The link'))));
      said.push(`changed link ${have.name || have.url}`);
    } else {
      const url = linkOk(must(link.url, 'A new link needs its address, and it'));
      const id = work.newId();
      work.apply(planAddLink(work.state, id, text(link.label) ?? '', url));
      work.made('link', id, text(link.label) ?? url);
      said.push('added a link');
    }
  }
  for (const id of input.removeLinks ?? []) {
    const have = links.find((l) => l.id === id);
    if (!have) throw new ToolError(`There is no link ${id} on this competition.`);
    work.apply(planRemoveLink(id, have.name));
    said.push(`removed link ${have.name || have.url}`);
  }

  // The map pin comes from a place search in the app, which this can't do: say so when the place moves
  const moved = ['venue', 'address', 'location'].some((k) => input[k as keyof DetailsInput] !== undefined);
  const info = work.state.info as Rec | undefined;
  if (moved && Number.isFinite(info?.lat) && Number.isFinite(info?.lng)) {
    work.warnings.push(
      'The map pin was not moved: it still marks the earlier place. Open Details in the app and choose the venue from the suggestions to move it.',
    );
  }
  return said;
}

// ---------- set_visibility

export interface VisibilityInput {
  listed?: boolean;
  published?: boolean;
  schedule?: 'show' | 'hide';
  results?: 'show' | 'hide';
  deleteContent?: boolean;
}

export function planVisibility(work: Work, input: VisibilityInput): string[] {
  const said: string[] = [];
  if (input.published === true && input.listed === false) throw new ToolError('A competition can’t be published but not listed: publishing lists it too.');
  if (input.listed !== undefined) {
    work.apply(planListed(input.listed));
    said.push(input.listed ? 'listed it' : 'unlisted it (and so unpublished it)');
  }
  if (input.published !== undefined) {
    work.apply(planPublished(input.published));
    said.push(input.published ? 'published it (and listed it)' : 'unpublished it');
  }
  for (const tab of ['schedule', 'results'] as const) {
    const want = input[tab];
    if (!want) continue;
    const hide = want === 'hide';
    const tabHasContentBefore = tabHasContent(work.state, tab);
    if (hide && tabHasContentBefore && !input.deleteContent) {
      throw new ToolError(
        `Hiding the ${tab === 'schedule' ? 'Schedule' : 'Results'} tab deletes ${tab === 'schedule' ? 'the schedule built so far' : 'all the results entered so far'}. `
        + 'Ask the organiser whether they want that, and if they do, call again with deleteContent: true. It can be undone with undo_change.',
      );
    }
    work.apply(planHideTab(tab, hide));
    said.push(`${hide ? 'hid' : 'showed'} the ${tab} tab${hide && tabHasContentBefore ? ' and deleted what was in it' : ''}`);
  }
  return said;
}

// ---------- save_dances

type Ref = string;
const refList = (v: 'all' | Ref[] | undefined) => v;

export interface DancesInput {
  categories?: Array<{ id?: string; name?: string }>;
  ageGroups?: Array<{ id?: string; category?: Ref; name?: string | null; trophy?: string | null; sponsor?: Ref | null; notChampionship?: boolean }>;
  dances?: Array<{ id?: string; name?: string; steps?: string | number | null; shortName?: string | null; ageGroups?: 'all' | Ref[] }>;
  trophyEvents?: Array<{ id?: string; name?: string; trophy?: string | null; sponsor?: Ref | null; dance?: Ref | null; ageGroups?: 'all' | Ref[] }>;
  order?: { categories?: Ref[]; ageGroups?: Ref[]; dances?: Ref[]; trophyEvents?: Ref[] };
}

const list = (work: Work, kind: CollectionKind) => entriesOf(work.state.data[kind] as Record<string, Rec> | undefined) as Array<Rec & { id: string }>;
const labelOf = (work: Work, kind: CollectionKind, item: Rec & { id: string }) => titleOf(work.state.data, kind, item);
const items = (work: Work, kind: CollectionKind) => list(work, kind).map((i) => ({ id: i.id, label: labelOf(work, kind, i) }));
const find = (work: Work, kind: CollectionKind, given: string, what = KINDS[kind].singular) => pick(items(work, kind), given, (i) => i.label, what);

function existing(work: Work, kind: CollectionKind, id: string) {
  const item = list(work, kind).find((i) => i.id === id);
  if (!item) throw new ToolError(`There is no ${KINDS[kind].singular} with the id ${id}. Leave the id out to add one.`);
  return item;
}

function refuseTwin(work: Work, kind: CollectionKind, label: string) {
  const twin = items(work, kind).find((i) => fold(i.label) === fold(label));
  if (twin) {
    // A dance's label is its name and steps, so the same dance at other steps is not a twin
    const other = kind === 'dances' ? 'give this one different steps or a different name' : 'give this one a different name';
    throw new ToolError(
      `There is already a ${KINDS[kind].singular} called “${twin.label}” (id ${twin.id}). Pass that id to change it, or ${other}.`,
    );
  }
}

/** A sponsor, by staff id or name; stored by id as the app does */
function sponsorId(work: Work, given: Ref | null): string | null {
  if (given === null || given.trim() === '') return null;
  const sponsors = list(work, 'staff').filter((s) => s.type === 'Sponsor').map((s) => ({ id: s.id, label: labelOf(work, 'staff', s) }));
  const direct = sponsors.find((s) => s.id === given.trim());
  if (direct) return direct.id;
  try {
    return pick(sponsors, given, (s) => s.label, 'sponsor').id;
  } catch {
    throw new ToolError(`No sponsor matches “${given}”. Add them with save_staff (role Sponsor) first, then use their id.`);
  }
}

function groupSet(work: Work, which: 'all' | Ref[] | undefined): Set<string> | undefined {
  if (which === undefined) return undefined;
  const all = items(work, 'groups');
  return new Set(which === 'all' ? all.map((g) => g.id) : which.map((g) => pick(all, g, (x) => x.label, 'age group').id));
}

function saveCategory(work: Work, c: NonNullable<DancesInput['categories']>[number]) {
  if (c.id) {
    existing(work, 'categories', c.id);
    if (c.name !== undefined) work.apply(planSetField(work.state, 'categories', c.id, 'name', must(c.name, 'The name'), 'Name'));
    return;
  }
  const name = must(c.name, 'A category’s name');
  refuseTwin(work, 'categories', name);
  const id = work.newId();
  work.apply(planAdd(work.state, 'categories', id, { name }, { name }));
  work.made('category', id, name);
}

function saveAgeGroup(work: Work, g: NonNullable<DancesInput['ageGroups']>[number]) {
  const categories = items(work, 'categories');
  const categoryId = g.category === undefined ? undefined : pick(categories, g.category, (c) => c.label, 'category').id;
  const sponsor = g.sponsor === undefined ? undefined : sponsorId(work, g.sponsor);
  let id = g.id;
  if (id) {
    existing(work, 'groups', id);
    const fields: Array<[string, unknown, string]> = [];
    if (categoryId !== undefined) fields.push(['categoryId', categoryId, 'Category']);
    if (g.name !== undefined) fields.push(['name', text(g.name), 'Age range']);
    if (g.trophy !== undefined) fields.push(['trophy', text(g.trophy), 'Trophy']);
    if (sponsor !== undefined) fields.push(['sponsor', sponsor, 'Trophy sponsor']);
    for (const [key, value, label] of fields) work.apply(planSetField(work.state, 'groups', id, key, value, label));
  } else {
    if (!categoryId) throw new ToolError('A new age group needs its category (a category’s id or name; add categories first).');
    const name = text(g.name) ?? '';
    const twin = list(work, 'groups').find((x) => x.categoryId === categoryId && fold(String(x.name ?? '')) === fold(name));
    if (twin) throw new ToolError(`There is already an age group “${labelOf(work, 'groups', twin)}” (id ${twin.id}). Pass that id to change it.`);
    id = work.newId();
    const record = Object.fromEntries(Object.entries({ categoryId, name, trophy: text(g.trophy) ?? '', sponsor: sponsor ?? '' }).filter(([, v]) => v));
    work.apply(planAdd(work.state, 'groups', id, record, Object.fromEntries(Object.entries(record).map(([k, v]) => [k, String(v)]))));
    work.made('ageGroup', id, labelOf(work, 'groups', existing(work, 'groups', id)));
  }
  if (g.notChampionship !== undefined) {
    const group = existing(work, 'groups', id);
    const category = list(work, 'categories').find((c) => c.id === group.categoryId);
    if (g.notChampionship && !isChampionshipName(category?.name as string, group.name as string)) {
      throw new ToolError(`${labelOf(work, 'groups', group)} isn’t a championship by its name, so it can’t be marked “not run as a championship”.`);
    }
    work.apply(planSetNotChampionship(work.state, id, g.notChampionship));
  }
}

function saveDance(work: Work, d: NonNullable<DancesInput['dances']>[number]) {
  const wanted = groupSet(work, refList(d.ageGroups));
  const steps = d.steps === undefined ? undefined : text(d.steps);
  let id = d.id;
  if (id) {
    existing(work, 'dances', id);
    if (d.name !== undefined) work.apply(planSetField(work.state, 'dances', id, 'name', must(d.name, 'The name'), 'Name'));
    if (steps !== undefined) work.apply(planSetField(work.state, 'dances', id, 'steps', steps, 'Steps'));
    if (d.shortName !== undefined) work.apply(planSetField(work.state, 'dances', id, 'shortName', text(d.shortName), 'Short name'));
    if (wanted) {
      const dance = existing(work, 'dances', id);
      for (const g of items(work, 'groups')) {
        const has = !!(dance.groupIds as Rec | undefined)?.[g.id];
        if (has !== wanted.has(g.id)) work.apply(planSetDanceGroup(work.state, id, g.id, wanted.has(g.id)));
      }
    }
    return;
  }
  const name = must(d.name, 'A dance’s name');
  const label = steps ? `${name} (${steps})` : name;
  refuseTwin(work, 'dances', label);
  id = work.newId();
  const typed: Record<string, string> = Object.fromEntries(
    Object.entries({ name, steps: steps ?? '', shortName: text(d.shortName) ?? '' }).filter(([, v]) => v) as Array<[string, string]>,
  );
  const record: Rec = { ...typed, ...(wanted?.size ? { groupIds: Object.fromEntries([...wanted].map((g) => [g, true])) } : {}) };
  work.apply(planAdd(work.state, 'dances', id, record, typed));
  work.made('dance', id, label);
}

function saveTrophyEvent(work: Work, t: NonNullable<DancesInput['trophyEvents']>[number]) {
  const wanted = groupSet(work, refList(t.ageGroups));
  const sponsor = t.sponsor === undefined ? undefined : sponsorId(work, t.sponsor);
  const danceId = t.dance === undefined ? undefined : t.dance === null || t.dance.trim() === '' ? null : find(work, 'dances', t.dance).id;
  let id = t.id;
  if (id) {
    existing(work, 'trophyEvents', id);
    if (t.name !== undefined) work.apply(planSetField(work.state, 'trophyEvents', id, 'name', must(t.name, 'The name'), 'Name'));
    if (t.trophy !== undefined) work.apply(planSetField(work.state, 'trophyEvents', id, 'trophy', text(t.trophy), 'Trophy'));
    if (sponsor !== undefined) work.apply(planSetField(work.state, 'trophyEvents', id, 'sponsor', sponsor, 'Trophy sponsor'));
    if (danceId !== undefined) work.apply(planSetField(work.state, 'trophyEvents', id, 'danceId', danceId, 'Dance'));
    if (wanted) {
      const event = existing(work, 'trophyEvents', id);
      for (const g of items(work, 'groups')) {
        const has = !!(event.groupIds as Rec | undefined)?.[g.id];
        if (has !== wanted.has(g.id)) work.apply(planSetTrophyEventGroup(work.state, id, g.id, wanted.has(g.id)));
      }
    }
    return;
  }
  const name = must(t.name, 'A trophy event’s name');
  refuseTwin(work, 'trophyEvents', name);
  id = work.newId();
  const typed: Record<string, string> = Object.fromEntries(
    Object.entries({ name, trophy: text(t.trophy) ?? '', sponsor: sponsor ?? '', danceId: danceId ?? '' }).filter(([, v]) => v) as Array<[string, string]>,
  );
  const record: Rec = { ...typed, ...(wanted?.size ? { groupIds: Object.fromEntries([...wanted].map((g) => [g, true])) } : {}) };
  work.apply(planAdd(work.state, 'trophyEvents', id, record, typed));
  work.made('trophyEvent', id, name);
}

/** The ids given first, in that order, then the rest as they were */
function reorder(work: Work, kind: CollectionKind, given: Ref[]) {
  const all = list(work, kind)
    .map((i) => ({ id: i.id, _order: typeof i._order === 'number' ? i._order : Number.POSITIVE_INFINITY }))
    .sort((a, b) => a._order - b._order || (a.id < b.id ? -1 : 1));
  const first = given.map((g) => find(work, kind, g).id);
  if (new Set(first).size !== first.length) throw new ToolError(`The ${KINDS[kind].plural} to put in order name one more than once.`);
  const ordered = [...first, ...all.map((a) => a.id).filter((id) => !first.includes(id))];
  const byId = new Map(all.map((a) => [a.id, a]));
  work.apply(planReorder(kind, ordered.map((id) => ({ id, _order: Number.isFinite(byId.get(id)!._order) ? byId.get(id)!._order : undefined }))));
}

export function planDances(work: Work, input: DancesInput): string[] {
  const said: string[] = [];
  const n = (what: string, count: number | undefined) => (count ? said.push(`saved ${count} ${what}`) : 0);
  for (const c of input.categories ?? []) saveCategory(work, c);
  n('categories', input.categories?.length);
  for (const g of input.ageGroups ?? []) saveAgeGroup(work, g);
  n('age groups', input.ageGroups?.length);
  for (const d of input.dances ?? []) saveDance(work, d);
  n('dances', input.dances?.length);
  for (const t of input.trophyEvents ?? []) saveTrophyEvent(work, t);
  n('trophy events', input.trophyEvents?.length);
  const order = input.order ?? {};
  for (const [key, kind] of [['categories', 'categories'], ['ageGroups', 'groups'], ['dances', 'dances'], ['trophyEvents', 'trophyEvents']] as const) {
    const given = order[key];
    if (given?.length) {
      reorder(work, kind, given);
      said.push(`put ${KINDS[kind].plural} in order`);
    }
  }
  return said;
}

// ---------- save_dancers

export interface DancerInput {
  id?: string;
  number?: string | number;
  ageGroup?: Ref;
  firstName?: string;
  lastName?: string | null;
  location?: string | null;
  studio?: string | null;
  routine?: string | null;
  members?: Array<{ firstName: string; lastName?: string | null }>;
}

export const NUMBER_PROBLEM = 'Use digits, like 101 or 101A.';

function numberFree(work: Work, number: string, groupId: string, except: string | null) {
  if (!/^\d+[a-z]?$/i.test(number)) throw new ToolError(`“${number}”: ${NUMBER_PROBLEM}`);
  const clash = list(work, 'dancers').find((d) => d.id !== except && trim(d.number) === number && d.groupId === groupId);
  if (clash) {
    throw new ToolError(`${number} is already ${labelOf(work, 'dancers', clash)} in this age group (id ${clash.id}). Numbers are unique within an age group.`);
  }
}

function rows(input: DancerInput): MemberDraft[] | null {
  const list = input.members ?? (input.firstName !== undefined || input.lastName ? [{ firstName: input.firstName ?? '', lastName: input.lastName ?? '' }] : null);
  if (!list) return null;
  const named = list
    .map((r) => ({ firstName: trim(r.firstName), lastName: trim(r.lastName) }))
    .filter((r) => r.firstName || r.lastName);
  if (!named.length) throw new ToolError('First name can’t be empty.');
  if (named.some((r) => !r.firstName)) throw new ToolError('Each dancer needs a first name.');
  return named;
}

export function planDancers(work: Work, input: DancerInput[]): string[] {
  let added = 0;
  let changed = 0;
  for (const d of input) {
    const group = d.ageGroup === undefined ? undefined : pick(items(work, 'groups'), d.ageGroup, (g) => g.label, 'age group').id;
    const number = d.number === undefined ? undefined : trim(d.number);
    if (d.members && (d.firstName !== undefined || d.lastName)) throw new ToolError('Give either members or firstName and lastName, not both.');
    if (!d.id) {
      if (!number) throw new ToolError('A new entry needs its number.');
      if (!group) throw new ToolError(`Entry ${number} needs its age group (an id or name).`);
      numberFree(work, number, group, null);
      const named = rows(d);
      if (!named) throw new ToolError(`Entry ${number} needs a first name.`);
      const id = work.newId();
      const common = { number, groupId: group, title: trim(d.routine), studio: trim(d.studio), location: trim(d.location) };
      const record = dancerRecord({ ...common, dancers: named }, work.newId);
      const typed = Object.fromEntries(Object.entries(common).filter(([, v]) => v));
      work.apply(planAdd(work.state, 'dancers', id, record, typed));
      work.made('entry', id, `${number} ${labelOf(work, 'dancers', existing(work, 'dancers', id))}`);
      added++;
      continue;
    }
    const current = existing(work, 'dancers', d.id);
    const groupId = group ?? String(current.groupId ?? '');
    if (number !== undefined || group !== undefined) {
      numberFree(work, number ?? trim(current.number), groupId, d.id);
    }
    if (number !== undefined) work.apply(planSetField(work.state, 'dancers', d.id, 'number', must(number, 'The number'), 'Number'));
    if (group !== undefined) work.apply(planSetField(work.state, 'dancers', d.id, 'groupId', group, 'Age group'));
    if (d.location !== undefined) work.apply(planSetField(work.state, 'dancers', d.id, 'location', text(d.location), 'Location'));
    if (d.routine !== undefined) work.apply(planSetField(work.state, 'dancers', d.id, 'title', text(d.routine), 'Routine'));
    if (d.studio !== undefined) work.apply(planSetField(work.state, 'dancers', d.id, 'studio', text(d.studio), 'Studio'));
    if (d.members) {
      work.apply(planSetDancers(work.state, d.id, rows(d)!, work.newId).plan);
    } else if (d.firstName !== undefined || d.lastName !== undefined) {
      if (current.team === true) throw new ToolError(`Entry ${trim(current.number)} is a duet, trio or group: change its dancers with members, not firstName and lastName.`);
      if (d.firstName !== undefined) work.apply(planSetDancerName(work.state, d.id, 'firstName', must(d.firstName, 'First name')));
      if (d.lastName !== undefined) work.apply(planSetDancerName(work.state, d.id, 'lastName', text(d.lastName) ?? ''));
    }
    changed++;
  }
  return [added ? `added ${added} ${added === 1 ? 'entry' : 'entries'}` : '', changed ? `changed ${changed}` : ''].filter(Boolean);
}

// ---------- save_staff

export const ROLES = ['Judge', 'Piper', 'Volunteer', 'Sponsor'] as const;

export interface StaffInput {
  staff?: Array<{ id?: string; role?: (typeof ROLES)[number]; firstName?: string | null; lastName?: string | null; location?: string | null; description?: string | null; website?: string | null }>;
  platforms?: Array<{ id?: string; name?: string; description?: string | null }>;
}

export function planStaff(work: Work, input: StaffInput): string[] {
  const said: string[] = [];
  for (const s of input.staff ?? []) {
    const web = s.website === undefined ? undefined : text(s.website);
    if (web) linkOk(web);
    if (s.id) {
      existing(work, 'staff', s.id);
      const fields: Array<[string, string | null | undefined, string]> = [
        ['type', s.role, 'Role'], ['firstName', text(s.firstName), 'First name'], ['lastName', text(s.lastName), 'Last name'],
        ['location', text(s.location), 'Location'], ['description', text(s.description), 'About'], ['website', web, 'Website'],
      ];
      for (const [key, value, label] of fields) if (value !== undefined) work.apply(planSetField(work.state, 'staff', s.id, key, value, label));
      continue;
    }
    if (!s.role) throw new ToolError('A new staff member needs a role: Judge, Piper, Volunteer or Sponsor.');
    const record = Object.fromEntries(
      Object.entries({ type: s.role, firstName: text(s.firstName), lastName: text(s.lastName), location: text(s.location), description: text(s.description), website: web }).filter(([, v]) => v),
    ) as Record<string, string>;
    if (!record.firstName && !record.lastName) work.warnings.push(`A ${s.role} was added with no name.`);
    const twin = list(work, 'staff').find((x) => x.type === s.role && fold(labelOf(work, 'staff', x)) === fold(`${record.firstName ?? ''} ${record.lastName ?? ''}`));
    if (twin && (record.firstName || record.lastName)) {
      throw new ToolError(`There is already a ${s.role} called “${labelOf(work, 'staff', twin)}” (id ${twin.id}). Pass that id to change them.`);
    }
    const id = work.newId();
    work.apply(planAdd(work.state, 'staff', id, record, record));
    work.made(s.role.toLowerCase(), id, labelOf(work, 'staff', existing(work, 'staff', id)));
  }
  if (input.staff?.length) said.push(`saved ${input.staff.length} staff`);

  for (const p of input.platforms ?? []) {
    if (p.id) {
      existing(work, 'platforms', p.id);
      if (p.name !== undefined) work.apply(planSetField(work.state, 'platforms', p.id, 'name', must(p.name, 'The name'), 'Name'));
      if (p.description !== undefined) work.apply(planSetField(work.state, 'platforms', p.id, 'description', text(p.description), 'Description'));
      continue;
    }
    const name = must(p.name, 'A platform’s name');
    refuseTwin(work, 'platforms', `Platform ${name}`);
    const record = Object.fromEntries(Object.entries({ name, description: text(p.description) }).filter(([, v]) => v)) as Record<string, string>;
    const id = work.newId();
    work.apply(planAdd(work.state, 'platforms', id, record, record));
    work.made('platform', id, labelOf(work, 'platforms', existing(work, 'platforms', id)));
  }
  if (input.platforms?.length) said.push(`saved ${input.platforms.length} ${input.platforms.length === 1 ? 'platform' : 'platforms'}`);
  return said;
}

// ---------- remove

export const REMOVABLE = {
  category: 'categories',
  ageGroup: 'groups',
  dance: 'dances',
  trophyEvent: 'trophyEvents',
  dancer: 'dancers',
  staff: 'staff',
  platform: 'platforms',
} as const satisfies Record<string, CollectionKind>;

export function planRemoval(work: Work, what: keyof typeof REMOVABLE, ids: string[]): { removed: Created[]; summary: string } {
  const kind = REMOVABLE[what];
  const unique = [...new Set(ids)];
  const have = list(work, kind);
  const unknown = unique.filter((id) => !have.some((i) => i.id === id));
  if (unknown.length) throw new ToolError(`No ${KINDS[kind].singular} has the id ${unknown.slice(0, 5).join(', ')}. get_dances, get_dancers and get_staff list the ids. Nothing was removed.`);
  const removed = unique.map((id) => ({ kind: what, id, name: labelOf(work, kind, have.find((i) => i.id === id)!) }));
  const p = planRemove(work.state, kind, unique);
  work.apply(p);
  return { removed, summary: p.summary };
}
