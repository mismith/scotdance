// The order dancers go up in each dance of one age group (optional). Stored as dancer numbers:
// draws/{groupId}/{danceId} = ["101", "104", …].
import { danceLabel, namer } from "../labels";
import { entriesOf, drawsOf, plan, type CompetitionState, type Plan } from "./types";

const num = (d: { number?: unknown }) => String(d.number ?? "").trim();

/** Numeric-aware compare for competitor numbers ("9" before "10", "?" last). */
export function compareNumbers(a: string, b: string) {
  const na = Number.parseInt(a, 10);
  const nb = Number.parseInt(b, 10);
  const fa = Number.isFinite(na);
  const fb = Number.isFinite(nb);
  if (fa && fb && na !== nb) return na - nb;
  if (fa !== fb) return fa ? -1 : 1;
  return a.localeCompare(b, undefined, { numeric: true });
}

/** Reels are danced together in number order, so they aren't shuffled. */
export const isReel = (d: { name?: string }) => /(^|\s)reel(\s|$)/i.test(d.name ?? "");

/**
 * One dance's draw as a list of numbers. The old admin saved draws cell by cell, so a stored draw can have gaps
 * (and come back as an object when sparse). A gap is not a feature: the app never writes or shows one (the draw
 * dialog skips it, Manage drops it on the next save), so it is left out here too.
 */
export function drawList(v: unknown): string[] {
  const list: unknown[] = Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [];
  return list.filter((n) => n != null && n !== "").map((n) => String(n));
}

/** A draw as stored, read as the app reads it (see drawList). */
export function storedDraw(state: CompetitionState, groupId: string, danceId: string): string[] {
  return drawList(drawsOf(state.data)[groupId]?.[danceId]);
}

/** The age group's dances (as it does them) and the numbers of its dancers. */
function context(state: CompetitionState, groupId: string) {
  const dances = entriesOf(state.data.dances).filter((d) => d.groupIds?.[groupId]);
  const numbers = entriesOf(state.data.dancers)
    .filter((d) => d.groupId === groupId)
    .map(num)
    .filter(Boolean);
  return { dances, numbers };
}

export function shuffled(values: string[], random: () => number = Math.random) {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const path = (groupId: string, danceId: string) => `draws/${groupId}/${danceId}`;
const groupWord = (state: CompetitionState, groupId: string) =>
  namer(state.data).groupLabel(groupId) ?? "an age group";

/** Save one dance's draw as it is (a drag, "Add to the end", "Take out"). `numbers: null` clears it. */
export const planSetDraw = (
  state: CompetitionState,
  groupId: string,
  danceId: string,
  numbers: string[] | null,
  summary?: string,
): Plan =>
  plan(summary ?? `Changed the draw for ${groupWord(state, groupId)}`, {
    [path(groupId, danceId)]: numbers,
  });

/** Every dance shuffled, reels in number order. */
export function planShuffleAll(
  state: CompetitionState,
  groupId: string,
  random: () => number = Math.random,
): Plan {
  const { dances, numbers } = context(state, groupId);
  const inOrder = [...numbers].sort(compareNumbers);
  const updates: Record<string, string[]> = {};
  for (const d of dances)
    updates[path(groupId, d.id)] = isReel(d) ? inOrder : shuffled(numbers, random);
  return plan("Shuffled every dance", updates);
}
export function planShuffle(
  state: CompetitionState,
  groupId: string,
  danceId: string,
  random: () => number = Math.random,
): Plan {
  const d = state.data.dances?.[danceId];
  return plan(`Shuffled ${d ? danceLabel(d) : ""}`, {
    [path(groupId, danceId)]: shuffled(context(state, groupId).numbers, random),
  });
}
export function planNumberOrder(state: CompetitionState, groupId: string, danceId: string): Plan {
  const d = state.data.dances?.[danceId];
  return plan(`${d ? danceLabel(d) : ""} in number order`, {
    [path(groupId, danceId)]: [...context(state, groupId).numbers].sort(compareNumbers),
  });
}
export function planClearDraw(state: CompetitionState, groupId: string, danceId: string): Plan {
  const d = state.data.dances?.[danceId];
  return plan(`Cleared ${d ? danceLabel(d) : ""}`, { [path(groupId, danceId)]: null });
}
export function planClearAllDraws(state: CompetitionState, groupId: string): Plan {
  const updates: Record<string, null> = {};
  for (const d of context(state, groupId).dances)
    if (storedDraw(state, groupId, d.id).length) updates[path(groupId, d.id)] = null;
  return plan("Cleared all draws", updates);
}

/** Numbers of the age group's dancers not yet in a dance's draw, in number order. */
export function missingFromDraw(
  state: CompetitionState,
  groupId: string,
  danceId: string,
): string[] {
  const set = new Set(storedDraw(state, groupId, danceId));
  return [...context(state, groupId).numbers].sort(compareNumbers).filter((n) => !set.has(n));
}
/** Numbers in a draw that no dancer in the age group has any more. */
export function strayInDraw(state: CompetitionState, groupId: string, danceId: string): string[] {
  const known = new Set(context(state, groupId).numbers);
  return storedDraw(state, groupId, danceId).filter((n) => !known.has(n));
}
export function planAddMissingToDraw(
  state: CompetitionState,
  groupId: string,
  danceId: string,
): Plan {
  const known = new Set(context(state, groupId).numbers);
  return planSetDraw(state, groupId, danceId, [
    ...storedDraw(state, groupId, danceId).filter((n) => known.has(n)),
    ...missingFromDraw(state, groupId, danceId),
  ]);
}
export function planRemoveStraysFromDraw(
  state: CompetitionState,
  groupId: string,
  danceId: string,
): Plan {
  const known = new Set(context(state, groupId).numbers);
  return planSetDraw(
    state,
    groupId,
    danceId,
    storedDraw(state, groupId, danceId).filter((n) => known.has(n)),
  );
}
