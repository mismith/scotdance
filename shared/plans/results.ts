// One dance's results (or an age group's callbacks and overall, or a trophy event's placings), entered by tapping
// dancers in the order they placed. Stored as results/{groupId}/{danceId} = ["reverse:6"?, "id", "id:tie", …] or
// false (marked "none placed"), and championship points as points/{groupId}/{danceId}/combined = [dancerId…].
import { danceLabel, namer, trophyEventLabel } from "../labels";
import {
  CALLBACKS,
  OVERALL,
  isPlaceholderId,
  ordinalSuffix,
  parsePlacings,
  placeAt,
  removeEntry,
  serializePlacings,
  type Entry,
  type Placings,
} from "../placings";
import { plan, pointsOf, resultsOf, type CompetitionState, type Plan } from "./types";

/** What a result is called in Undo: "Callbacks", "Overall", a dance, or a trophy event ("Dancer of the Day: callbacks"). */
export function resultName(state: CompetitionState, groupId: string, danceId: string): string {
  const n = namer(state.data);
  const trophyEvent = n.trophyEvent(groupId);
  if (trophyEvent)
    return danceId === CALLBACKS
      ? `${trophyEventLabel(trophyEvent)}: callbacks`
      : trophyEventLabel(trophyEvent);
  if (danceId === CALLBACKS) return "Callbacks";
  if (danceId === OVERALL) return "Overall";
  const dance = n.dance(danceId);
  return dance ? danceLabel(dance) : "Dance";
}

/** A dancer by their number ("?" for a stand-in or someone who has gone). */
export function dancerTag(state: CompetitionState, id: string): string {
  if (isPlaceholderId(id)) return "?";
  const d = namer(state.data).dancer(id);
  return d ? String(d.number ?? "").trim() : "?";
}

/** The placings as stored now. */
export const storedPlacings = (state: CompetitionState, groupId: string, danceId: string) =>
  resultsOf(state.data)[groupId]?.[danceId];
const current = (state: CompetitionState, g: string, d: string): Placings =>
  parsePlacings(storedPlacings(state, g, d));

const resultPath = (g: string, d: string) => `results/${g}/${d}`;

/** Save a dance's placings as they are (`false`: none placed; `null`: cleared). */
export function planSavePlacings(
  state: CompetitionState,
  groupId: string,
  danceId: string,
  value: Placings | false | null,
  label: string,
): Plan {
  const stored = value === false || value === null ? value : serializePlacings(value);
  return plan(`${label} in ${resultName(state, groupId, danceId)}`, {
    [resultPath(groupId, danceId)]: stored,
  });
}

/** A plan, and the placings it leaves (for what's said aloud after). */
export interface PlacingsPlan {
  plan: Plan;
  after: Placings;
}
const saving = (
  state: CompetitionState,
  g: string,
  d: string,
  after: Placings,
  label: string,
): PlacingsPlan => ({ plan: planSavePlacings(state, g, d, after, label), after });

/** Add a dancer to the end, or take them out if already there. `added` says which. */
export function planPlace(
  state: CompetitionState,
  groupId: string,
  danceId: string,
  id: string,
): PlacingsPlan & { added: boolean } {
  const p = current(state, groupId, danceId);
  const i = p.entries.findIndex((e) => e.id === id);
  if (i >= 0)
    return {
      ...saving(state, groupId, danceId, removeEntry(p, i), `Took out ${dancerTag(state, id)}`),
      added: false,
    };
  const added = { ...p, entries: [...p.entries, { id, tie: false }] };
  return {
    ...saving(state, groupId, danceId, added, `Placed ${dancerTag(state, id)}`),
    added: true,
  };
}

/** A placed row tapped: take that dancer out (by who, not just where: the list may have changed). `null`: they're not there. */
export function planTakeOut(
  state: CompetitionState,
  groupId: string,
  danceId: string,
  index: number,
  id: string,
): PlacingsPlan | null {
  const p = current(state, groupId, danceId);
  const i = p.entries[index]?.id === id ? index : p.entries.findIndex((e) => e.id === id);
  if (i < 0) return null;
  return saving(state, groupId, danceId, removeEntry(p, i), `Took out ${dancerTag(state, id)}`);
}

/** Tie the dancer at `index` with the one before (or untie). `null`: nobody there. */
export function planTie(
  state: CompetitionState,
  groupId: string,
  danceId: string,
  index: number,
  on: boolean,
): PlacingsPlan | null {
  const p = current(state, groupId, danceId);
  if (!p.entries[index]) return null;
  p.entries[index].tie = on;
  return saving(
    state,
    groupId,
    danceId,
    p,
    `${on ? "Tied" : "Untied"} ${dancerTag(state, p.entries[index].id)}`,
  );
}

/** The order as dragged: `entries` in their new order, `moved` the dancer who was moved. */
export function planReorderPlacings(
  state: CompetitionState,
  groupId: string,
  danceId: string,
  entries: Entry[],
  moved: string,
): PlacingsPlan {
  const p = { ...current(state, groupId, danceId), entries };
  const at = placeAt(
    entries.findIndex((e) => e.id === moved),
    p,
  );
  return saving(
    state,
    groupId,
    danceId,
    p,
    at
      ? `Moved ${dancerTag(state, moved)} to ${at}${ordinalSuffix(at)}`
      : `Moved ${dancerTag(state, moved)}`,
  );
}

/** "Lowest place first": places entered from the Nth up to 1st, as a championship announces them (`null`: off). */
export function planReverse(
  state: CompetitionState,
  groupId: string,
  danceId: string,
  n: number | null,
): PlacingsPlan {
  return saving(
    state,
    groupId,
    danceId,
    { ...current(state, groupId, danceId), reverseFrom: n },
    n == null ? "Lowest place first off" : `Entering from ${n}${ordinalSuffix(n)}`,
  );
}

/** Choose who a "?" was. `null`: that "?" has gone. */
export function planReplacePlaceholder(
  state: CompetitionState,
  groupId: string,
  danceId: string,
  placeholderId: string,
  dancerId: string,
): PlacingsPlan | null {
  const p = current(state, groupId, danceId);
  const entry = p.entries.find((e) => e.id === placeholderId);
  if (!entry) return null;
  entry.id = dancerId;
  return saving(state, groupId, danceId, p, `Replaced ? with ${dancerTag(state, dancerId)}`);
}

/** Said generally: it also covers a dance that didn't run, or an Overall that wasn't given. */
export function noneLabel(state: CompetitionState, groupId: string, danceId: string) {
  return danceId === CALLBACKS
    ? "No callbacks"
    : danceId === OVERALL && !namer(state.data).trophyEvent(groupId)
      ? "No overall"
      : "No results";
}

/** Mark a dance "no results" (or "no callbacks", "no overall"), or clear the mark. */
export function planNoResults(
  state: CompetitionState,
  groupId: string,
  danceId: string,
  on: boolean,
): Plan {
  const label = noneLabel(state, groupId, danceId);
  return planSavePlacings(
    state,
    groupId,
    danceId,
    on ? false : null,
    on ? label : `Cleared “${label}”`,
  );
}

/** There wasn't a callback round: mark the callbacks "none" and carry on. */
export function planNoCallbackRound(state: CompetitionState, groupId: string): Plan {
  const n = namer(state.data);
  const subject = n.trophyEvent(groupId)
    ? trophyEventLabel(n.trophyEvent(groupId)!)
    : n.groupLabel(groupId);
  return plan(`No callback round in ${subject ?? "this age group"}`, {
    [resultPath(groupId, CALLBACKS)]: false,
  });
}

/** Give a championship point to a dancer, or take it back. `gave` says which. */
export function planPoint(
  state: CompetitionState,
  groupId: string,
  danceId: string,
  id: string,
): Plan & { gave: boolean } {
  const list = [...(pointsOf(state.data)[groupId]?.[danceId]?.combined ?? [])];
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  else list.push(id);
  return {
    ...plan(
      `${i >= 0 ? "Took a point from" : "Gave a point to"} ${dancerTag(state, id)} in ${resultName(state, groupId, danceId)}`,
      { [`points/${groupId}/${danceId}/combined`]: list.length ? list : null },
    ),
    gave: i < 0,
  };
}
