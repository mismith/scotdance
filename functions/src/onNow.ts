import type { Reference } from 'firebase-admin/database';

// "On now" (ADR 0020): people at a competition say which age group is dancing
// on each platform, and a pink line shows it in the schedule. A signed-in
// account answers for itself, one answer per platform (a new one replaces its
// last), and this keeps each platform's line from those answers:
//
//   competitions:onNow:votes/{competitionId}/{platformId}/{uid} = { turn, vote, at }
//                    vote: 'yes' (it's on), 'no' (it isn't), 'undo' (take back my answer)
//   competitions:onNow/{competitionId}/{platformId} = { turn, at }      public; the line
//   competitions:onNow:log/{day}/{competitionId}/{pushId} = { uid, platformId, turn, vote, at }
//                    every answer, kept 7 days for spotting abuse (system admins read it)
//
// A turn is one age group (or a danced trophy event) in one dance of the
// schedule: "{dayId}/{blockId}/{eventId}/{scheduleDanceId}/{groupId}".
//
// The line goes on the turn with more Yes than No whose latest Yes is the
// most recent, counting answers from the last 15 minutes. So the newest report
// wins, and one No is enough to take back a single stray Yes. An organiser's
// answer counts three times.

export const FRESH_MS = 15 * 60 * 1000;
export const ORGANISER_WEIGHT = 3;
const KEEP_LOG_DAYS = 7;
const KEEP_VOTES_MS = 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export type VoteValue = 'yes' | 'no' | 'undo';
export interface Vote {
  turn: string;
  vote: VoteValue;
  at: number;
  /** How many answers this one counts as (an organiser's counts more). */
  weight?: number;
}
export interface Line {
  turn: string;
  at: number;
}

/** Where the line goes, from everyone's latest answer on one platform. */
export function tally(votes: Vote[], now: number): Line | null {
  const score = new Map<string, number>();
  const lastYes = new Map<string, number>();
  for (const v of votes) {
    if (v.vote === 'undo' || typeof v.at !== 'number' || now - v.at > FRESH_MS) continue;
    const w = v.weight ?? 1;
    score.set(v.turn, (score.get(v.turn) ?? 0) + (v.vote === 'yes' ? w : -w));
    if (v.vote === 'yes') lastYes.set(v.turn, Math.max(lastYes.get(v.turn) ?? 0, v.at));
  }
  let best: Line | null = null;
  for (const [turn, at] of lastYes) {
    if ((score.get(turn) ?? 0) <= 0) continue;
    if (!best || at > best.at) best = { turn, at };
  }
  return best;
}

/** A UTC day as the log's keys write it: 2026-11-23. */
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** On each answer: log it, then work out the platform's line again. */
export function getOnVote(db: Reference) {
  return async (change: { after: { val(): unknown } }, ctx: { params: Record<string, string> }) => {
    const { competitionId, platformId, uid } = ctx.params;
    const answer = change.after.val() as Vote | null;
    if (!answer) return;
    const now = Date.now();
    await db.child(`competitions:onNow:log/${dayKey(now)}/${competitionId}`).push({
      uid, platformId, turn: answer.turn, vote: answer.vote, at: answer.at ?? now,
    });

    const all = ((await db.child(`competitions:onNow:votes/${competitionId}/${platformId}`).get()).val() ?? {}) as Record<string, Vote>;
    const votes = await Promise.all(Object.entries(all).map(async ([voter, v]) => {
      const organiser = (await db.child(`users:permissions/${voter}/competitions/${competitionId}`).get()).val() === true;
      return { ...v, weight: organiser ? ORGANISER_WEIGHT : 1 };
    }));
    const line = tally(votes, now);
    const ref = db.child(`competitions:onNow/${competitionId}/${platformId}`);
    const current = (await ref.get()).val() as Line | null;
    if (current?.turn === line?.turn && current?.at === line?.at) return;
    await ref.set(line);
  };
}

/** Daily: drop the log past 7 days, and answers and lines from before yesterday. */
export async function sweepOnNow(db: Reference, now = Date.now()) {
  const oldest = dayKey(now - KEEP_LOG_DAYS * DAY);
  const logDays = Object.keys((await db.child('competitions:onNow:log').get()).val() ?? {});
  const updates: Record<string, null> = {};
  for (const day of logDays) if (day < oldest) updates[`competitions:onNow:log/${day}`] = null;

  const votes = ((await db.child('competitions:onNow:votes').get()).val() ?? {}) as Record<string, Record<string, Record<string, Vote>>>;
  for (const [competitionId, platforms] of Object.entries(votes)) {
    for (const [platformId, byUser] of Object.entries(platforms ?? {})) {
      for (const [uid, v] of Object.entries(byUser ?? {})) {
        if (!(now - (v?.at ?? 0) < KEEP_VOTES_MS)) updates[`competitions:onNow:votes/${competitionId}/${platformId}/${uid}`] = null;
      }
    }
  }
  const lines = ((await db.child('competitions:onNow').get()).val() ?? {}) as Record<string, Record<string, Line>>;
  for (const [competitionId, platforms] of Object.entries(lines)) {
    for (const [platformId, line] of Object.entries(platforms ?? {})) {
      if (!(now - (line?.at ?? 0) < KEEP_VOTES_MS)) updates[`competitions:onNow/${competitionId}/${platformId}`] = null;
    }
  }
  if (Object.keys(updates).length) await db.update(updates);
}
