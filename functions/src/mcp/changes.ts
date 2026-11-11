import type { Reference } from 'firebase-admin/database';
import { ToolError } from './errors';
import { pushId } from './ids';
import { DatabaseError, type Session } from './session';

/**
 * The change log (ADR 0018). Every write tool records one entry in the SAME multi-path update as the change, so
 * the two stand or fall together. An entry lists each path written with its value before and after (a value that
 * was not there, or is not now, is left out: the database keeps no nulls). Undo puts the "before" values back,
 * and only if every path still holds the "after" it was left with.
 *
 *   competitions:changes/{competitionId}/{changeId}
 *   organisations:changes/{organisationId}/{changeId}   (changes to an organisation, and to which competitions it has)
 *
 * They sit beside `competitions:data`, not inside it, so no data trigger fires for them.
 */

/** Whose log: a competition's, or an organisation's */
export type Scope = { kind: 'competition' | 'organisation'; id: string };
const scopeOf = (x: string | Scope): Scope => (typeof x === 'string' ? { kind: 'competition', id: x } : x);
export const logRoot = (kind: Scope['kind']) => (kind === 'competition' ? 'competitions:changes' : 'organisations:changes');
const logPath = (x: string | Scope) => `${logRoot(scopeOf(x).kind)}/${scopeOf(x).id}`;
export const LOG_ROOTS = ['competitions:changes', 'organisations:changes'] as const;

export type Updates = Record<string, unknown>;

export interface PathChange {
  /** Relative to the data namespace: `competitions:data/{id}/dancers/{dancerId}` or `competitions/{id}/name` */
  path: string;
  before?: unknown;
  after?: unknown;
}

export interface ChangeEntry {
  at: number;
  uid: string;
  connection: string;
  client: string;
  tool: string;
  summary: string;
  paths: PathChange[];
  /** The change this undid, when it is an undo */
  undoOf?: string;
  /** Set once undone: when, by whom, and the change that undid it */
  undone?: { at: number; by: string; change: string };
}

/** One call may change this many records (the app saves 200 at a time: the database refuses a write that sets off over 1,000 functions) */
export const MAX_RECORDS = 200;
/** And its entry, as JSON, may be this big: it holds every value before and after */
export const MAX_ENTRY_BYTES = 500_000;
/** How long entries are kept */
export const KEEP_DAYS = 60;

const SERVER_TIME = { '.sv': 'timestamp' };

// ---------- values as the database keeps them

/** A value as the database stores it: no nulls, no empty lists or records */
export function stored(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    const list = value.map(stored);
    return list.some((x) => x !== undefined) ? list : undefined;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const s = stored(v);
      if (s !== undefined) out[k] = s;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value;
}

/** A canonical form, so a list that came back as an array equals the same list saved as a record */
function canon(value: unknown): unknown {
  const v = stored(value);
  if (Array.isArray(v)) return canon(Object.fromEntries(v.map((x, i) => [String(i), x])));
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, canon(x)]),
    );
  }
  return v;
}

/**
 * Links that functions write onto records after the fact (an entry's profile, a staff member's judge or piper profile).
 * Undo does not count them as someone else's change.
 */
export const SERVER_KEYS = new Set(['dancerId', 'judgeId', 'piperId']);

function withoutServerKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutServerKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !SERVER_KEYS.has(k))
        .map(([k, v]) => [k, withoutServerKeys(v)]),
    );
  }
  return value;
}

export const same = (a: unknown, b: unknown) => JSON.stringify(canon(a) ?? null) === JSON.stringify(canon(b) ?? null);

/** Whether a value is still as a change left it, not counting what functions have added to it since */
export const holds = (now: unknown, after: unknown) => same(withoutServerKeys(now), withoutServerKeys(after));

/** Read the value at a slash path in a nested value */
export function valueAt(root: unknown, path: string): unknown {
  let node = root;
  for (const key of path.split('/').filter(Boolean)) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

/** Set (or, for null, remove) the value at a slash path in a nested value, in place */
export function setAt(root: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('/').filter(Boolean);
  let node = root;
  keys.slice(0, -1).forEach((key) => {
    if (!node[key] || typeof node[key] !== 'object') node[key] = {};
    node = node[key] as Record<string, unknown>;
  });
  const last = keys[keys.length - 1];
  if (value === null || value === undefined) delete node[last];
  else node[last] = value;
}

/** An empty string means "clear this field", as in the app; the database refuses `undefined` */
export const clean = (value: unknown) => (value === undefined || value === '' ? null : value);

// ---------- a change

const isAncestor = (a: string, b: string) => b.startsWith(`${a}/`);

/** Which record a path belongs to: its section and the record in it (`dancers/abc`). That is what the 200 counts. */
const recordOf = (path: string) => {
  const rest = path.split('/');
  // competitions:data/{id}/{section}/{record}/…   or   competitions/{id}/{field}
  return rest.slice(0, rest[0] === 'competitions:data' ? 4 : 3).join('/');
};

export interface Change {
  competition: string;
  tool: string;
  summary: string;
  /** What to write, by path under `competitions:data/{id}` and `competitions/{id}` (null removes) */
  data: Updates;
  info: Updates;
  /** The competition as it is now (its sections and its record): where each "before" comes from */
  current: { data: unknown; info: unknown };
  /** Said when one of the paths is a part shared from a primary competition: stops the write with a sentence */
  guard?: (path: string) => string | null;
}

export interface Committed {
  id: string;
  /** Values changed */
  paths: number;
  /** Records they belong to */
  records: number;
}

/**
 * Writes a change and its log entry in one atomic update. Returns null when nothing would change. Refuses, in a
 * sentence, one that is too big to log (or to undo) safely.
 */
export async function commitChange(session: Session, change: Change, newId: () => string = pushId): Promise<Committed | null> {
  const { competition: cid } = change;
  const writes = new Map<string, unknown>();
  const before = new Map<string, unknown>();
  for (const [p, v] of Object.entries(change.data)) {
    writes.set(`competitions:data/${cid}/${p}`, clean(v));
    before.set(`competitions:data/${cid}/${p}`, valueAt(change.current.data, p));
  }
  for (const [p, v] of Object.entries(change.info)) {
    writes.set(`competitions/${cid}/${p}`, clean(v));
    before.set(`competitions/${cid}/${p}`, valueAt(change.current.info, p));
  }
  return commitPaths(session, { kind: 'competition', id: cid }, { tool: change.tool, summary: change.summary, writes, before, guard: change.guard }, recordOf, newId);
}

/** A change to an organisation: absolute paths (`organisations/{id}/name`, `competitions/{cid}/organisations/{id}`) with the values they held */
export interface OrganisationChange {
  organisation: string;
  tool: string;
  summary: string;
  /** What to write, by path (null removes) */
  writes: Updates;
  /** What each path holds now */
  before: Record<string, unknown>;
  guard?: (path: string) => string | null;
}

/** An organisation's change is logged under `organisations:changes/{id}` in the same update, as a competition's is */
export function commitOrganisationChange(session: Session, change: OrganisationChange, newId: () => string = pushId): Promise<Committed | null> {
  const writes = new Map(Object.entries(change.writes).map(([p, v]) => [p, clean(v)] as const));
  const before = new Map(Object.entries(change.before));
  // Each path is its own record: a competition added is one, a field of the organisation another
  return commitPaths(session, { kind: 'organisation', id: change.organisation }, { tool: change.tool, summary: change.summary, writes, before, guard: change.guard }, (p) => p, newId);
}

interface Prepared {
  tool: string;
  summary: string;
  writes: Map<string, unknown>;
  before: Map<string, unknown>;
  guard?: (path: string) => string | null;
}

async function commitPaths(session: Session, scope: Scope, change: Prepared, record: (path: string) => string, newId: () => string): Promise<Committed | null> {
  const { writes, before } = change;
  const paths: PathChange[] = [];
  for (const [path, value] of writes) {
    const was = stored(before.get(path));
    const now = stored(value);
    if (same(was, now)) continue;
    paths.push({ path, ...(was !== undefined ? { before: was } : {}), ...(now !== undefined ? { after: now } : {}) });
  }
  if (!paths.length) return null;

  // One update can't write a place and something inside it
  for (const a of paths) {
    for (const b of paths) {
      if (a !== b && isAncestor(a.path, b.path)) throw new Error(`overlapping paths ${a.path} and ${b.path}`);
    }
  }
  for (const p of paths) {
    const locked = change.guard?.(p.path);
    if (locked) throw new ToolError(locked);
  }

  const records = new Set(paths.map((p) => record(p.path))).size;
  if (records > MAX_RECORDS) {
    throw new ToolError(
      `That changes ${records} records, and one call can change at most ${MAX_RECORDS} (so it can be logged and undone). `
      + 'Split it into smaller calls.',
    );
  }

  const id = newId();
  const entry = {
    at: SERVER_TIME,
    uid: session.uid,
    connection: session.connection,
    client: session.client,
    tool: change.tool,
    summary: change.summary,
    paths,
  };
  if (Buffer.byteLength(JSON.stringify(entry)) > MAX_ENTRY_BYTES) {
    throw new ToolError(
      'That changes too much text to log and undo in one call. Split it into smaller calls (fewer entries or less in each).',
    );
  }

  const values: Updates = {};
  for (const [path, value] of writes) values[path] = value;
  values[`${logPath(scope)}/${id}`] = entry;
  try {
    await session.update(values);
  } catch (error) {
    throw refusal(error, paths, change.guard);
  }
  return { id, paths: paths.length, records };
}

/** The database saying no, as a sentence */
export function refusal(error: unknown, paths: PathChange[], guard?: Change['guard']): unknown {
  if (!(error instanceof DatabaseError) || error.code !== 'permission-denied') return error;
  for (const p of paths) {
    const locked = guard?.(p.path);
    if (locked) return new ToolError(locked);
  }
  return new ToolError(
    'ScotDance.app didn’t allow that change. You can only change the competitions you are an admin of, and a part shared '
    + 'from a primary competition can only be changed there.',
  );
}

// ---------- undo

export interface Undone {
  change: string;
  undoneBy: string;
  restored: number;
}

const PATH_OK = (scope: Scope) => {
  const id = scope.id.replace(/[^\w-]/g, '');
  // An organisation's change: its own record, or the place it holds on a competition
  if (scope.kind === 'organisation') return new RegExp(`^(organisations/${id}/[^.#$\\[\\]]+|competitions/[\\w-]+/organisations/${id})$`);
  return new RegExp(`^(competitions:data|competitions)/${id}/[^.#$\\[\\]]+$`);
};

/** The sentence for paths that changed since: where, and what is there now */
function changedSince(entry: ChangeEntry, now: Map<string, unknown>, cid: string): string {
  const differs = entry.paths.filter((p) => !holds(now.get(p.path), p.after));
  const short = (p: string) => p.replace(`competitions:data/${cid}/`, '').replace(`competitions/${cid}/`, 'competition ').replace(/^organisations\/[^/]+\//, '');
  const show = (v: unknown) => {
    const s = JSON.stringify(stored(v) ?? null);
    return s.length > 60 ? `${s.slice(0, 57)}…` : s;
  };
  const list = differs.slice(0, 4).map((p) => `${short(p.path)} is now ${show(now.get(p.path))}`).join('; ');
  const more = differs.length > 4 ? ` and ${differs.length - 4} more` : '';
  return (
    `That can’t be undone: ${differs.length} of the ${entry.paths.length} values it changed have been changed again since `
    + `(${list}${more}). Undoing it would overwrite the newer changes. Change them back by hand if that is what you want.`
  );
}

/**
 * Puts back what a change changed, if every value it changed is still as it left it. The undo is logged as a
 * change of its own, and the original is marked undone, in the same update.
 */
export async function undoChange(
  session: Session,
  whose: string | Scope,
  changeId: string,
  newId: () => string = pushId,
): Promise<Undone> {
  const scope = scopeOf(whose);
  const entry = (await session.read(`${logPath(scope)}/${changeId}`)) as ChangeEntry | null;
  if (!entry || typeof entry !== 'object') throw new ToolError(`There is no change ${changeId} for this ${scope.kind}. get_changes lists the recent ones.`);
  if (entry.undone) throw new ToolError('That change has already been undone.');
  if (entry.undoOf) throw new ToolError('That change was itself an undo. To bring the original back, make the change again.');
  const paths = (Array.isArray(entry.paths) ? entry.paths : Object.values(entry.paths ?? {})) as PathChange[];
  if (!paths.length || paths.some((p) => !PATH_OK(scope).test(String(p?.path)))) {
    throw new ToolError('That change can’t be undone from here.');
  }
  const log = { ...entry, paths };

  // Where each value is now: a competition's, one read for each section the change touched; an organisation's, each path
  const roots = new Map<string, Promise<unknown>>();
  const rootOf = (path: string) => (scope.kind === 'organisation' ? path : path.split('/').slice(0, path.startsWith('competitions:data/') ? 3 : 2).join('/'));
  for (const p of paths) {
    const root = rootOf(p.path);
    if (!roots.has(root)) roots.set(root, session.read(root));
  }
  const loaded = new Map(await Promise.all([...roots].map(async ([k, v]) => [k, await v] as const)));
  const now = new Map(paths.map((p) => [p.path, scope.kind === 'organisation' ? loaded.get(p.path) : valueAt(loaded.get(rootOf(p.path)), p.path.slice(rootOf(p.path).length + 1))] as const));

  if (!paths.every((p) => holds(now.get(p.path), p.after))) throw new ToolError(changedSince(log, now, scope.id));

  const id = newId();
  const values: Updates = {};
  for (const p of paths) values[p.path] = p.before === undefined ? null : p.before;
  const undo = {
    at: SERVER_TIME,
    uid: session.uid,
    connection: session.connection,
    client: session.client,
    tool: 'undo_change',
    summary: `Undid: ${entry.summary}`,
    undoOf: changeId,
    paths: paths.map((p) => ({ path: p.path, ...(p.after !== undefined ? { before: p.after } : {}), ...(p.before !== undefined ? { after: p.before } : {}) })),
  };
  values[`${logPath(scope)}/${id}`] = undo;
  values[`${logPath(scope)}/${changeId}/undone`] = { at: SERVER_TIME, by: session.uid, change: id };
  try {
    await session.update(values);
  } catch (error) {
    throw refusal(error, paths);
  }
  return { change: entry.summary, undoneBy: id, restored: paths.length };
}

// ---------- reading the log

export interface ChangeRow {
  id: string;
  when: string | null;
  tool: string;
  summary: string;
  assistant: string;
  values: number;
  undone?: true;
  undoOf?: string;
}

/** The latest entries, newest first */
export async function recentChanges(session: Session, whose: string | Scope, limit: number): Promise<ChangeRow[]> {
  const found = (await session.read(logPath(whose), { orderBy: 'at', limitToLast: limit })) as Record<string, ChangeEntry> | null;
  return Object.entries(found ?? {})
    .filter(([, e]) => e && typeof e === 'object')
    .map(([id, e]) => ({
      id,
      at: typeof e.at === 'number' ? e.at : 0,
      row: {
        id,
        when: typeof e.at === 'number' ? new Date(e.at).toISOString() : null,
        tool: String(e.tool ?? ''),
        summary: String(e.summary ?? ''),
        assistant: String(e.client ?? ''),
        values: Array.isArray(e.paths) ? e.paths.length : Object.keys(e.paths ?? {}).length,
        ...(e.undone ? { undone: true as const } : {}),
        ...(e.undoOf ? { undoOf: e.undoOf } : {}),
      } satisfies ChangeRow,
    }))
    .sort((a, b) => b.at - a.at)
    .map((x) => x.row);
}

// ---------- tidying up

/** Which entries are older than the cutoff, among the competitions' entries as read */
export function expiredEntries(all: Record<string, Record<string, { at?: unknown }> | null>, cutoff: number, root: string = LOG_ROOTS[0]): string[] {
  const out: string[] = [];
  for (const [competition, entries] of Object.entries(all)) {
    for (const [id, entry] of Object.entries(entries ?? {})) {
      if (typeof entry?.at === 'number' && entry.at < cutoff) out.push(`${root}/${competition}/${id}`);
    }
  }
  return out;
}

/** Deletes entries older than KEEP_DAYS from every log, a few competitions (or organisations) at a time. Returns how many. */
export async function sweepChanges(root: Reference, now: number = Date.now(), pageSize = 20): Promise<number> {
  const cutoff = now - KEEP_DAYS * 24 * 60 * 60 * 1000;
  let swept = 0;
  for (const logs of LOG_ROOTS) {
    const base = root.child(logs);
    let after: string | undefined;
    for (;;) {
      let query = base.orderByKey().limitToFirst(pageSize);
      if (after !== undefined) query = query.startAfter(after);
      const snap = await query.get();
      const page = (snap.val() as Record<string, Record<string, { at?: unknown }>> | null) ?? {};
      const keys = Object.keys(page);
      if (!keys.length) break;
      const old = expiredEntries(page, cutoff, logs);
      for (let i = 0; i < old.length; i += 400) {
        await root.update(Object.fromEntries(old.slice(i, i + 400).map((p) => [p, null])));
      }
      swept += old.length;
      after = keys[keys.length - 1];
      if (keys.length < pageSize) break;
    }
  }
  return swept;
}
