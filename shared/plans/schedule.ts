// The schedule: days › sessions (blocks) › events › dances (rows) › platform cells holding age groups and judges.
// Every action changes a copy of the schedule, and the difference is saved as one change (one undo step).
// Siblings are ordered by `order`, falling back to their key, as on the public pages.
import { isoDate, localWeekday, shiftDate, weekdayName } from "../dates";
import { compareKeys, idList } from "../util";
import {
  plan,
  scheduleOf,
  type CompetitionState,
  type Plan,
  type RawSchedule,
  type RawScheduleBlock,
  type RawScheduleDance,
  type RawScheduleDay,
  type RawScheduleEvent,
  type RawSchedulePlatform,
  type Updates,
} from "./types";

export type SDay = RawScheduleDay;
export type SBlock = RawScheduleBlock;
export type SEvent = RawScheduleEvent;
export type SDance = RawScheduleDance;
export type SSchedule = RawSchedule;
export type Assignment = RawSchedulePlatform;

/** Where an event is, within the day being edited. */
export interface EventLocation {
  blockId: string;
  eventId: string;
}
/** Where a platform cell is, within the day being edited. */
export interface CellLocation extends EventLocation {
  danceId: string;
  platformId: string;
}

/** What the actions need to know: the day being edited, where new ids come from, and the competition's first day. */
export interface ScheduleEnv {
  dayId?: string;
  newId: () => string;
  competitionDate?: unknown;
}

/** Children in schedule order. */
export function ordered<T extends { order?: number }>(
  rec: Record<string, T> | null | undefined,
): Array<[string, T]> {
  return Object.entries(rec ?? {})
    .filter(([, v]) => v && typeof v === "object")
    .sort(([ak, a], [bk, b]) =>
      Number.isInteger(a.order) && Number.isInteger(b.order)
        ? (a.order as number) - (b.order as number)
        : compareKeys(ak, bk),
    );
}

export const ids = idList;

/** Spacers among a platform's age groups have all-digit ids. */
export const isSpacerId = (id: string) => /^\d+$/.test(id);
export const newSpacerId = () => String(Date.now());

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? null));
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Drop what the database doesn't keep (empty lists and objects), so what's
 * saved reads back the same (undo compares the two).
 */
function prune(v: unknown): unknown {
  if (Array.isArray(v)) return v.length ? v : undefined;
  if (!isObj(v)) return v;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    const p = prune(x);
    if (p !== undefined && p !== null) out[k] = p;
  }
  return Object.keys(out).length ? out : undefined;
}

/** The paths that turn `a` into `b`, for one multi-path update. */
function diff(path: string, a: unknown, b: unknown, out: Updates) {
  if (isObj(a) && isObj(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
      diff(`${path}/${k}`, a[k], b[k], out);
  } else if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) {
    out[path] = b === undefined ? null : clone(b);
  }
}

/** The `schedule/…` paths that turn the schedule `before` into `after`. */
export function scheduleUpdates(
  before: RawSchedule | null | undefined,
  after: RawSchedule | null | undefined,
): Updates {
  const updates: Updates = {};
  diff("schedule", prune(before), prune(after), updates);
  return updates;
}

/** Run `fn` on a copy of the schedule and give the difference as a plan (empty when nothing changed). */
export function planScheduleEdit(
  state: CompetitionState,
  summary: string,
  fn: (s: RawSchedule) => void,
): Plan {
  const before = clone(scheduleOf(state.data) ?? {});
  const after = clone(before);
  fn(after);
  return plan(summary, scheduleUpdates(before, after));
}

// --- Order

/** Number siblings 0, 1, 2… in the given order. */
function renumber(rec: Record<string, { order?: number }>, order: string[]) {
  order.forEach((id, i) => {
    if (rec[id] && rec[id].order !== i) rec[id].order = i;
  });
}
export function insertAt<T extends { order?: number }>(
  rec: Record<string, T>,
  id: string,
  value: T,
  index?: number,
) {
  const order = ordered(rec)
    .map(([k]) => k)
    .filter((k) => k !== id);
  rec[id] = value;
  order.splice(index ?? order.length, 0, id);
  renumber(rec, order);
}
export function moveWithin(
  rec: Record<string, { order?: number }> | undefined,
  from: number,
  to: number,
) {
  if (!rec) return;
  const order = ordered(rec).map(([k]) => k);
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return;
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  renumber(rec, order);
}

// --- Days

/**
 * The next day's name and date: the day after the last (or the competition's first day). Older apps
 * head the schedule with each day's name, so days always have one.
 */
export function nextDay(s: RawSchedule, competitionDate: unknown): SDay {
  const list = ordered(s.days);
  const start = isoDate(competitionDate);
  const last = isoDate(list.at(-1)?.[1].date);
  const date = last ? shiftDate(last, 1) : start && shiftDate(start, list.length);
  return date ? { name: weekdayName(date), date } : { name: `Day ${list.length + 1}` };
}

// Lookups within the day being edited, in `s` (a draft).
export function dayIn(s: RawSchedule, env: ScheduleEnv, create = false): SDay | undefined {
  // Before the first save, a day made earlier in the same change.
  const id = env.dayId ?? ordered(s.days)[0]?.[0];
  if (id && s.days?.[id]) return s.days[id];
  if (!create) return undefined;
  s.days ??= {};
  const newId = env.newId();
  s.days[newId] = { order: 0, ...nextDay(s, env.competitionDate) };
  return s.days[newId];
}
export const blockIn = (s: RawSchedule, env: ScheduleEnv, b: string) => dayIn(s, env)?.blocks?.[b];
export const eventIn = (s: RawSchedule, env: ScheduleEnv, b: string, e: string) =>
  blockIn(s, env, b)?.events?.[e];
export const rowIn = (s: RawSchedule, env: ScheduleEnv, b: string, e: string, d: string) =>
  eventIn(s, env, b, e)?.dances?.[d];

export type Kind = "group" | "judge";
const listKey = (kind: Kind) => (kind === "group" ? "orderedGroupIds" : "orderedJudgeIds");

export function cellIn(s: RawSchedule, env: ScheduleEnv, loc: CellLocation, create = false) {
  const row = rowIn(s, env, loc.blockId, loc.eventId, loc.danceId);
  if (!row) return undefined;
  if (!row.platforms?.[loc.platformId]) {
    if (!create) return undefined;
    row.platforms ??= {};
    row.platforms[loc.platformId] = {};
  }
  const cell = row.platforms[loc.platformId];
  cell.orderedGroupIds = ids(cell.orderedGroupIds);
  cell.orderedJudgeIds = ids(cell.orderedJudgeIds);
  return cell as Required<RawSchedulePlatform>;
}

// --- The actions. Each changes the draft `s` it's given.

export const addToCell = (
  s: RawSchedule,
  env: ScheduleEnv,
  kind: Kind,
  loc: CellLocation,
  id: string,
  index?: number,
) => {
  const list = cellIn(s, env, loc, true)?.[listKey(kind)];
  if (!list || list.includes(id)) return;
  list.splice(index ?? list.length, 0, id);
};
export const removeFromCell = (
  s: RawSchedule,
  env: ScheduleEnv,
  kind: Kind,
  loc: CellLocation,
  id: string,
) => {
  const list = cellIn(s, env, loc)?.[listKey(kind)];
  const i = list?.indexOf(id) ?? -1;
  if (list && i >= 0) list.splice(i, 1);
};
export const moveBetweenCells = (
  s: RawSchedule,
  env: ScheduleEnv,
  kind: Kind,
  from: CellLocation,
  to: CellLocation,
  id: string,
  index?: number,
) => {
  const a = cellIn(s, env, from)?.[listKey(kind)];
  const b = cellIn(s, env, to, true)?.[listKey(kind)];
  if (!a || !b || b.includes(id)) return;
  const i = a.indexOf(id);
  if (i >= 0) a.splice(i, 1);
  b.splice(index ?? b.length, 0, id);
};
export const reorderInCell = (
  s: RawSchedule,
  env: ScheduleEnv,
  kind: Kind,
  loc: CellLocation,
  from: number,
  to: number,
) => {
  const list = cellIn(s, env, loc)?.[listKey(kind)];
  if (!list || from === to || from >= list.length) return;
  const [x] = list.splice(from, 1);
  list.splice(to, 0, x);
};
/** Replace a cell's age groups or judges (autofill). */
export const setCell = (
  s: RawSchedule,
  env: ScheduleEnv,
  kind: Kind,
  loc: CellLocation,
  list: string[],
) => {
  const cell = cellIn(s, env, loc, list.length > 0);
  if (cell) cell[listKey(kind)] = list;
};

export const addDay = (s: RawSchedule, id: string, day: SDay) => {
  s.days ??= {};
  insertAt(s.days, id, day);
};
export const renameDay = (s: RawSchedule, d: string, name: string) => {
  const x = s.days?.[d];
  if (x) x.name = name;
};
/** Set a day's date (YYYY-MM-DD, or '' for none). A name that was its weekday follows it. */
export const setDayDate = (s: RawSchedule, d: string, date: string) => {
  const x = s.days?.[d];
  if (!x) return;
  const old = isoDate(x.date);
  const name = x.name?.trim();
  if (date && (!name || (old && (name === weekdayName(old) || name === localWeekday(old)))))
    x.name = weekdayName(date);
  if (date) x.date = date;
  else delete x.date;
};
export const removeDay = (s: RawSchedule, d: string) => {
  delete s.days?.[d];
};

export const addBlock = (s: RawSchedule, env: ScheduleEnv, id: string, name: string) => {
  const d = dayIn(s, env, true)!;
  d.blocks ??= {};
  insertAt(d.blocks, id, { name });
};
export const removeBlock = (s: RawSchedule, env: ScheduleEnv, b: string) => {
  delete dayIn(s, env)?.blocks?.[b];
};
export const clearDay = (s: RawSchedule, env: ScheduleEnv) => {
  const d = dayIn(s, env);
  if (d) delete d.blocks;
};
export const renameBlock = (s: RawSchedule, env: ScheduleEnv, b: string, name: string) => {
  const x = blockIn(s, env, b);
  if (x) x.name = name;
};
export const describeBlock = (s: RawSchedule, env: ScheduleEnv, b: string, description: string) => {
  const x = blockIn(s, env, b);
  if (!x) return;
  if (description) x.description = description;
  else delete x.description;
};
export const reorderBlock = (s: RawSchedule, env: ScheduleEnv, from: number, to: number) =>
  moveWithin(dayIn(s, env)?.blocks, from, to);

export const addEvent = (
  s: RawSchedule,
  env: ScheduleEnv,
  b: string,
  id: string,
  name: string,
  description?: string,
) => {
  const x = blockIn(s, env, b);
  if (!x) return;
  x.events ??= {};
  insertAt(x.events, id, description ? { name, description } : { name });
};
export const removeEvent = (s: RawSchedule, env: ScheduleEnv, b: string, e: string) => {
  delete blockIn(s, env, b)?.events?.[e];
};
export const renameEvent = (
  s: RawSchedule,
  env: ScheduleEnv,
  b: string,
  e: string,
  name: string,
) => {
  const x = eventIn(s, env, b, e);
  if (x) x.name = name;
};
export const describeEvent = (
  s: RawSchedule,
  env: ScheduleEnv,
  b: string,
  e: string,
  description: string,
) => {
  const x = eventIn(s, env, b, e);
  if (!x) return;
  if (description) x.description = description;
  else delete x.description;
};
export const reorderEvent = (
  s: RawSchedule,
  env: ScheduleEnv,
  b: string,
  from: number,
  to: number,
) => moveWithin(blockIn(s, env, b)?.events, from, to);

export const addRow = (
  s: RawSchedule,
  env: ScheduleEnv,
  b: string,
  e: string,
  id: string,
  row: { danceId?: string; name?: string },
  index?: number,
) => {
  const x = eventIn(s, env, b, e);
  if (!x) return;
  x.dances ??= {};
  insertAt(x.dances, id, row.danceId ? { danceId: row.danceId } : { name: row.name ?? "" }, index);
};
export const removeRow = (s: RawSchedule, env: ScheduleEnv, b: string, e: string, d: string) => {
  delete eventIn(s, env, b, e)?.dances?.[d];
};
export const setRowText = (
  s: RawSchedule,
  env: ScheduleEnv,
  b: string,
  e: string,
  d: string,
  key: "name" | "description",
  value: string,
) => {
  const x = rowIn(s, env, b, e, d);
  if (!x) return;
  if (value) x[key] = value;
  else delete x[key];
};
export const reorderRow = (
  s: RawSchedule,
  env: ScheduleEnv,
  b: string,
  e: string,
  from: number,
  to: number,
) => moveWithin(eventIn(s, env, b, e)?.dances, from, to);
export const moveRow = (
  s: RawSchedule,
  env: ScheduleEnv,
  from: EventLocation,
  d: string,
  to: EventLocation,
  index?: number,
) => {
  const a = eventIn(s, env, from.blockId, from.eventId);
  const b = eventIn(s, env, to.blockId, to.eventId);
  const row = a?.dances?.[d];
  if (!a?.dances || !row || !b) return;
  delete a.dances[d];
  b.dances ??= {};
  insertAt(b.dances, d, row, index);
};

// --- Whole days

/**
 * Can this age group (or danced trophy event) go in a cell of this dance's row? A dance no age group has switched on
 * takes any; a trophy event only goes in its own dance. The builder offers exactly these.
 */
export function isEligible(
  data: Pick<CompetitionState["data"], "dances" | "trophyEvents">,
  danceId: string | undefined,
  groupId: string,
): boolean {
  const trophyEvent = data.trophyEvents?.[groupId];
  if (trophyEvent) return !!danceId && trophyEvent.danceId === danceId;
  const groups = danceId ? data.dances?.[danceId]?.groupIds : undefined;
  return !groups || !Object.values(groups).some(Boolean) || !!groups[groupId];
}

/** A platform's cell, as ids */
export interface CellSpec {
  groupIds: string[];
  judgeIds: string[];
}
/** A row: a dance (danceId) or a line of its own (name); platform cells only for a dance */
export interface RowSpec {
  id?: string;
  danceId?: string;
  name?: string;
  description?: string;
  cells: Record<string, CellSpec>;
}
export interface EventSpec {
  id?: string;
  name: string;
  description?: string;
  rows: RowSpec[];
}
export interface SessionSpec {
  id?: string;
  name: string;
  description?: string;
  events: EventSpec[];
}
export interface DaySpec {
  name?: string;
  date?: string;
  description?: string;
  /** Left out: the day's sessions stay as they are */
  sessions?: SessionSpec[];
}

/**
 * Put a day's sessions, events, rows and cells exactly as given (ids kept where given, new ones made for the rest;
 * anything not listed goes), numbering siblings in the order given. A day not found is made, named and dated as
 * "Add day" would. Fields the builder doesn't touch on a record that stays are kept. Returns the day's id.
 */
export function replaceDay(
  s: RawSchedule,
  env: Pick<ScheduleEnv, "newId" | "competitionDate">,
  dayId: string | null,
  spec: DaySpec,
): string {
  let id = dayId && s.days?.[dayId] ? dayId : null;
  if (!id) {
    id = dayId ?? env.newId();
    addDay(s, id, nextDay(s, env.competitionDate));
  }
  const day = s.days![id];
  if (spec.date !== undefined) setDayDate(s, id, spec.date);
  if (spec.name !== undefined) day.name = spec.name;
  if (spec.description !== undefined) {
    if (spec.description) day.description = spec.description;
    else delete day.description;
  }

  const text = (rec: { description?: string }, v: string | undefined) => {
    if (v) rec.description = v;
    else delete rec.description;
  };
  if (!spec.sessions) return id;
  const blocks: Record<string, SBlock> = {};
  spec.sessions.forEach((sp, i) => {
    const bid = sp.id ?? env.newId();
    const prev = day.blocks?.[bid];
    const block: SBlock = { ...prev, order: i, name: sp.name };
    text(block, sp.description);
    const events: Record<string, SEvent> = {};
    sp.events.forEach((ep, j) => {
      const eid = ep.id ?? env.newId();
      const event: SEvent = { ...prev?.events?.[eid], order: j, name: ep.name };
      text(event, ep.description);
      const dances: Record<string, SDance> = {};
      ep.rows.forEach((rp, k) => {
        const rid = rp.id ?? env.newId();
        const row: SDance = { ...prev?.events?.[eid]?.dances?.[rid], order: k };
        delete row.danceId;
        delete row.name;
        if (rp.danceId) row.danceId = rp.danceId;
        else row.name = rp.name ?? "";
        text(row, rp.description);
        const platforms: Record<string, Assignment> = {};
        for (const [pid, cell] of Object.entries(rp.cells)) {
          platforms[pid] = {
            ...prev?.events?.[eid]?.dances?.[rid]?.platforms?.[pid],
            orderedGroupIds: [...cell.groupIds],
            orderedJudgeIds: [...cell.judgeIds],
          };
        }
        row.platforms = platforms;
        dances[rid] = row;
      });
      event.dances = dances;
      events[eid] = event;
    });
    block.events = events;
    blocks[bid] = block;
  });
  day.blocks = blocks;
  return id;
}
