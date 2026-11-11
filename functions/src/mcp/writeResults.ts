import {
  planNoCallbackRound,
  planNoResults,
  planSavePlacings,
  planSetPoints,
  resultsOf,
  type Plan,
} from '../../../shared/plans';
import { CALLBACKS, isPlaceholderId, OVERALL, parsePlacings, type Entry, type Placings } from '../../../shared/placings';
import { ToolError } from './errors';
import { find, items, labelOf, list, trim, Work } from './write';

/** A number as a results sheet gives it, or an entry id from get_results */
export type Given = string | number;

export interface ResultRowInput {
  /** The age group (id or name), or the trophy event (use trophyEvent) the row belongs to */
  ageGroup?: string;
  trophyEvent?: string;
  /** "callbacks", "overall", or a dance (id or name). A trophy event has "callbacks" (only if danced) and "overall" (its placings). */
  row: string;
  /** Placing order, 1st first (or, with reversedFrom, in the order announced). A tie is an inner list. */
  numbers?: Array<Given | Given[]>;
  /** Places announced from this place up to 1st (a championship). null: off. */
  reversedFrom?: number | null;
  /** Mark the row "no results" (for callbacks: "no callback round") */
  noResults?: boolean;
  /** Dancers who got a championship point in this row. Replaces the list. */
  points?: Given[];
  /** Allow "?" in numbers and points: a stand-in for a number that was missed */
  allowStandIns?: boolean;
}

export interface ResultTarget {
  group: string;
  row: string;
  /** Where the row is read back from: the age group or trophy event, and its label */
  subject: string;
  step: string;
}

type Rec = Record<string, unknown>;
type Dancer = { id: string; number: string; label: string; groupId: string };

const MAX_REVERSE = 20;

/** The dancers a row may place: an age group's, or those of the age groups a trophy event is open to */
function candidates(work: Work, scope: { kind: 'group' | 'trophyEvent'; id: string }): Dancer[] {
  const open = scope.kind === 'trophyEvent' ? (work.state.data.trophyEvents?.[scope.id]?.groupIds ?? {}) : null;
  return list(work, 'dancers')
    .filter((d) => (open ? !!open[String(d.groupId)] : d.groupId === scope.id))
    .map((d) => ({ id: d.id, number: trim(d.number), label: labelOf(work, 'dancers', d), groupId: String(d.groupId ?? '') }));
}

function groupName(work: Work, id: string) {
  return items(work, 'groups').find((g) => g.id === id)?.label ?? 'another age group';
}

class StandIns {
  private n = 0;
  constructor(private readonly taken: Set<string>) {}
  next(): string {
    let id: string;
    do id = String(Date.now() + this.n++);
    while (this.taken.has(id));
    this.taken.add(id);
    return id;
  }
}

function resolve(work: Work, given: Given, cands: Dancer[], scope: string, standIns: StandIns | null, what: string): string {
  const g = trim(given);
  if (!g) throw new ToolError(`An empty number in ${scope}.`);
  if (g === '?') {
    if (!standIns) {
      throw new ToolError(
        `“?” is a stand-in for a number that was missed, and it has to be fixed in Manage later. Only use it when the organiser asked for it: pass allowStandIns: true on that row.`,
      );
    }
    return standIns.next();
  }
  const byId = cands.find((d) => d.id === g);
  if (byId) return byId.id;
  const exact = cands.filter((d) => d.number === g);
  const hits = exact.length ? exact : cands.filter((d) => d.number.toLowerCase() === g.toLowerCase());
  if (hits.length === 1) return hits[0].id;
  if (hits.length > 1) {
    throw new ToolError(
      `Number ${g} is in more than one of the age groups this trophy event is open to (${hits.map((h) => groupName(work, h.groupId)).join(' and ')}). `
      + 'Give the entry id (get_dancers) instead.',
    );
  }
  const sample = cands.slice(0, 12).map((d) => d.number).join(', ');
  throw new ToolError(
    `${g} is not an entry in ${scope} (${what}). ${cands.length ? `The numbers there are ${sample}${cands.length > 12 ? ` and ${cands.length - 12} more` : ''}.` : 'It has no entries.'}`,
  );
}

const tagOf = (work: Work, id: string, cands: Dancer[]) => cands.find((d) => d.id === id)?.number ?? (isPlaceholderId(id) ? '?' : id);

/** Apply a plan from `shared/plans`, then say which row it was */
function applyRow(work: Work, p: Plan) {
  work.apply(p);
}

/** Where callbacks stand for a group: the people called back, none (no callback round), or not yet entered */
function callbacksOf(work: Work, g: string): { state: 'called'; ids: Set<string> } | { state: 'none' | 'missing' } {
  const raw = resultsOf(work.state.data)[g]?.[CALLBACKS];
  if (raw === false) return { state: 'none' };
  const ids = parsePlacings(raw).entries.map((e) => e.id);
  return ids.length ? { state: 'called', ids: new Set(ids) } : { state: 'missing' };
}

/** Rows are worked out in the order given, callbacks first, so a dance can follow its callbacks in one call */
export function planResults(work: Work, rows: ResultRowInput[]): { said: string[]; targets: ResultTarget[] } {
  if (work.state.data.results === false) {
    throw new ToolError('The Results tab is hidden for this competition, so nothing can be entered. set_visibility can show it (results: "show") first.');
  }
  const sorted = [...rows.keys()].sort((a, b) => Number(rows[b].row.trim().toLowerCase() === CALLBACKS) - Number(rows[a].row.trim().toLowerCase() === CALLBACKS) || a - b);
  const taken = new Set<string>();
  for (const perGroup of Object.values(resultsOf(work.state.data))) {
    for (const v of Object.values(perGroup ?? {})) for (const e of parsePlacings(v as string[]).entries) taken.add(e.id);
  }
  const standIns = new StandIns(taken);
  const targets: ResultTarget[] = [];
  const done = new Set<string>();
  const said: string[] = [];

  for (const index of sorted) {
    const r = rows[index];
    if (!!r.ageGroup === !!r.trophyEvent) {
      throw new ToolError(`Row ${index + 1}: give either ageGroup or trophyEvent (one of them), with the row to fill.`);
    }
    const isTrophy = !!r.trophyEvent;
    const subject = isTrophy ? find(work, 'trophyEvents', r.trophyEvent!) : find(work, 'groups', r.ageGroup!, 'age group');
    const subjectRec = list(work, isTrophy ? 'trophyEvents' : 'groups').find((x) => x.id === subject.id)!;
    const cands = candidates(work, { kind: isTrophy ? 'trophyEvent' : 'group', id: subject.id });

    // Which stored row this is
    const want = r.row.trim().toLowerCase();
    let danceId: string;
    let step: string;
    if (want === CALLBACKS) {
      if (isTrophy && !subjectRec.danceId) {
        throw new ToolError(`${subject.label} isn’t danced on its own, so it has no callbacks: it is decided from the age groups’ results. Its placings are row “overall”.`);
      }
      danceId = CALLBACKS;
      step = 'callbacks';
    } else if (want === OVERALL || (isTrophy && want === 'placings')) {
      if (!isTrophy) {
        const category = list(work, 'categories').find((c) => c.id === subjectRec.categoryId);
        if (!category || /^primary/i.test(trim(category.name))) throw new ToolError(`${subject.label} has no overall: Primary age groups don’t have one.`);
      }
      danceId = OVERALL;
      step = isTrophy ? 'placings' : 'overall';
    } else {
      if (isTrophy) throw new ToolError(`${subject.label} has the rows “callbacks”${subjectRec.danceId ? '' : ' (only if it is danced)'} and “overall” (its placings), not a dance.`);
      const dance = find(work, 'dances', r.row, 'dance');
      const record = list(work, 'dances').find((d) => d.id === dance.id)!;
      if (!(record.groupIds as Rec | undefined)?.[subject.id]) {
        const who = items(work, 'groups').filter((g) => (record.groupIds as Rec | undefined)?.[g.id]).map((g) => g.label);
        throw new ToolError(`${subject.label} doesn’t dance ${dance.label}${who.length ? ` (it is danced by ${who.join('; ')})` : ' (no age group has it switched on)'}. save_dances can switch it on.`);
      }
      danceId = dance.id;
      step = dance.label;
    }
    const key = `${subject.id}/${danceId}`;
    if (done.has(key)) throw new ToolError(`${subject.label}, ${step} is in the call twice. Send each row once.`);
    done.add(key);
    const scope = `${subject.label}${isTrophy ? ' (the age groups it is open to)' : ''}`;
    const touchesPlacings = r.numbers !== undefined || r.reversedFrom !== undefined || r.noResults !== undefined;
    if (!touchesPlacings && r.points === undefined) throw new ToolError(`${subject.label}, ${step}: say what to save: numbers, noResults, reversedFrom or points.`);

    if (touchesPlacings) {
      if (r.noResults) {
        if (r.numbers?.length || r.reversedFrom || r.points?.length) throw new ToolError(`${subject.label}, ${step}: noResults can’t be combined with numbers, reversedFrom or points.`);
        applyRow(work, danceId === CALLBACKS && !isTrophy ? planNoCallbackRound(work.state, subject.id) : planNoResults(work.state, subject.id, danceId, true));
        said.push(`marked ${subject.label} ${step} as no results`);
      } else {
        const allow = r.allowStandIns ? standIns : null;
        const isCallbacks = danceId === CALLBACKS;
        const current = parsePlacings(resultsOf(work.state.data)[subject.id]?.[danceId] as string[]);
        const flat: Entry[] = [];
        if (r.numbers === undefined) flat.push(...current.entries.map((e) => ({ ...e })));
        else {
          const seen = new Set<string>();
          for (const item of r.numbers) {
            if (Array.isArray(item) && isCallbacks) {
              throw new ToolError(`${subject.label}, callbacks: callbacks are a list of who was called back, with no places, so no ties. Give a flat list.`);
            }
            const group = Array.isArray(item) ? item : [item];
            if (!group.length) throw new ToolError(`${subject.label}, ${step}: a tie with nobody in it.`);
            group.forEach((g, i) => {
              const id = resolve(work, g, cands, scope, allow, step);
              if (seen.has(id)) throw new ToolError(`${tagOf(work, id, cands)} is placed twice in ${subject.label}, ${step}.`);
              seen.add(id);
              flat.push({ id, tie: i > 0 });
            });
          }
        }
        const reverseFrom = r.reversedFrom === undefined ? (r.numbers === undefined ? current.reverseFrom : null) : r.reversedFrom;
        if (reverseFrom !== null) {
          if (isCallbacks) throw new ToolError(`${subject.label}, callbacks: reversedFrom is for placings, not callbacks.`);
          if (!Number.isInteger(reverseFrom) || reverseFrom < 2 || reverseFrom > MAX_REVERSE) {
            throw new ToolError(`reversedFrom is the lowest place announced first, a whole number from 2 to ${MAX_REVERSE} (like 6 for “from 6th up to 1st”).`);
          }
          if (flat.length > reverseFrom) {
            throw new ToolError(`${subject.label}, ${step}: ${flat.length} dancers listed but reversedFrom is ${reverseFrom}. List at most ${reverseFrom} (from ${reverseFrom}th place up).`);
          }
        }

        // Dances and overall place only dancers who were called back, as the app lets only those be tapped
        if (danceId !== CALLBACKS && flat.length > 0 && (!isTrophy || subjectRec.danceId)) {
          const called = callbacksOf(work, subject.id);
          if (called.state === 'called') {
            const stray = flat.find((e) => !isPlaceholderId(e.id) && !called.ids.has(e.id));
            if (stray) {
              throw new ToolError(
                `${tagOf(work, stray.id, cands)} wasn’t called back in ${subject.label}, so can’t be placed in ${step}. `
                + 'Add them to the callbacks first (row “callbacks”, in the same call is fine), or check the number.',
              );
            }
          } else if (called.state === 'missing') {
            work.warnings.push(`${subject.label} has no callbacks entered yet, so the app will ask for them before it lets ${step} be filled in. Callbacks come first.`);
          }
        }
        applyRow(work, planSavePlacings(work.state, subject.id, danceId, { reverseFrom, entries: flat } satisfies Placings, 'Saved'));
        said.push(`${flat.length ? 'saved' : 'cleared'} ${subject.label} ${step}`);
      }
    }

    if (r.points !== undefined) {
      if (isTrophy || danceId === CALLBACKS) throw new ToolError(`${subject.label}, ${step}: championship points are for an age group’s dances and overall.`);
      const category = list(work, 'categories').find((c) => c.id === subjectRec.categoryId);
      if (/^primary/i.test(trim(category?.name)) && r.points.length) throw new ToolError(`${subject.label}: Primary has no championship points.`);
      const ids = r.points.map((g) => resolve(work, g, cands, scope, r.allowStandIns ? standIns : null, step));
      if (new Set(ids).size !== ids.length) throw new ToolError(`${subject.label}, ${step}: a dancer is listed twice in points.`);
      const placed = new Set(parsePlacings(resultsOf(work.state.data)[subject.id]?.[danceId] as string[]).entries.map((e) => e.id));
      const both = ids.find((id) => placed.has(id));
      if (both) throw new ToolError(`${tagOf(work, both, cands)} is placed in ${subject.label}, ${step}, and a dancer can’t be placed and given a point in the same dance, as in the app.`);
      applyRow(work, planSetPoints(work.state, subject.id, danceId, ids));
      said.push(`set the points in ${subject.label} ${step}`);
    }
    targets.push({ group: subject.id, row: danceId, subject: subject.label, step });
  }
  return { said, targets };
}
