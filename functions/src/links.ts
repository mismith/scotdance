import { HttpsError } from 'firebase-functions/v2/https';

// Linked competitions (docs/adr/0007-linked-competitions.md): a weekend's
// two, or a week's seven, linked by the people who run them. One is the
// primary; each of the others takes parts of it (its staff, and what's on
// its Details), and these functions keep those parts in step.
//
//   competitionLinks/{linkId} = { primary, competitions: { [id]: true } }
//   competitionLinks:of/{competitionId} = linkId
//   competitionLinks:sync/{competitionId}/{part} = true   (what it takes from the primary)
//
// Only functions write these (the rules give the app read access): the
// `linkCompetitions` callable for every change to a link, and the triggers
// below for the primary's changes.

/** In Manage's order: Details' sections top to bottom, then Staff. */
export const PARTS = ['about', 'venue', 'registration', 'links', 'visibility', 'organisations', 'staff'] as const;
export type Part = (typeof PARTS)[number];
type FieldPart = Exclude<Part, 'staff'>;

/** The fields on competitions/{id} each part covers. */
export const PART_FIELDS: Record<FieldPart, string[]> = {
  about: ['description', 'image'],
  venue: ['venue', 'address', 'location', 'lat', 'lng', 'country', 'region', 'locality'],
  registration: ['registrationURL', 'registrationStart', 'registrationEnd'],
  links: ['links'],
  // Together, so a copy can never be published without being listed.
  visibility: ['listed', 'published'],
  organisations: ['organisations'],
};
const FIELD_PARTS = Object.keys(PART_FIELDS) as FieldPart[];

/** Written onto staff by the judge and piper aggregators: each competition keeps its own. */
const BACK_POINTERS = ['judgeId', 'piperId'];

/** More than a week's worth would be a mistake, or worse. */
export const MAX_LINKED = 14;

type Db = any;
type Json = any;
type Updates = Record<string, Json>;

const val = async (db: Db, path: string): Promise<Json> => (await db.child(path).get()).val();
const isPart = (p: unknown): p is Part => typeof p === 'string' && (PARTS as readonly string[]).includes(p);

/** JSON with its keys sorted, to compare values whatever order they came in. */
function stable(v: Json): string {
  if (v === undefined || v === null || v === '') return 'null';
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (typeof v === 'object') {
    const keys = Object.keys(v).filter((k) => v[k] !== null && v[k] !== undefined).sort();
    return keys.length ? `{${keys.map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}` : 'null';
  }
  return JSON.stringify(v);
}
export const same = (a: Json, b: Json) => stable(a) === stable(b);
const blank = (v: Json) => stable(v) === 'null';
const without = (item: Json, keys: string[]) => {
  if (!item || typeof item !== 'object') return item ?? null;
  return Object.fromEntries(Object.entries(item).filter(([k]) => !keys.includes(k)));
};

export interface Link {
  linkId: string
  primary: string | null
  members: string[]
}

/** The link a competition is in, if any. */
export async function linkOf(db: Db, competitionId: string): Promise<Link | null> {
  const linkId = await val(db, `competitionLinks:of/${competitionId}`);
  if (typeof linkId !== 'string') return null;
  const link = await val(db, `competitionLinks/${linkId}`);
  if (!link) return null;
  return { linkId, primary: link.primary ?? null, members: Object.keys(link.competitions ?? {}) };
}

const exists = async (db: Db, competitionId: string) => (await db.child(`competitions/${competitionId}/date`).get()).exists();

async function flagsOf(db: Db, competitionId: string): Promise<Part[]> {
  const flags = (await val(db, `competitionLinks:sync/${competitionId}`)) ?? {};
  return PARTS.filter((p) => flags[p] === true);
}

/** The competitions in a link taking `part` from its primary (that are still there). */
async function syncing(db: Db, link: Link, part: Part): Promise<string[]> {
  const others = link.members.filter((id) => id !== link.primary);
  const takes = await Promise.all(others.map(async (id) => (
    (await val(db, `competitionLinks:sync/${id}/${part}`)) === true && exists(db, id)
  )));
  return others.filter((_, i) => takes[i]);
}

// What copying a part writes ------------------------------------------------

const personKey = (item: Json) => `${item?.firstName ?? ''} ${item?.lastName ?? ''}`.trim().replace(/\s+/g, ' ').toLowerCase();
const personName = (item: Json) => `${item?.firstName ?? ''} ${item?.lastName ?? ''}`.trim().replace(/\s+/g, ' ');

/** Each list of judges in a schedule: its path (under the schedule) and ids. */
function judgeLists(schedule: Json): Array<{ path: string; ids: string[] }> {
  const out: Array<{ path: string; ids: string[] }> = [];
  for (const [dayId, day] of Object.entries(schedule?.days ?? {}) as [string, Json][]) {
    for (const [blockId, block] of Object.entries(day?.blocks ?? {}) as [string, Json][]) {
      for (const [eventId, event] of Object.entries(block?.events ?? {}) as [string, Json][]) {
        for (const [danceId, dance] of Object.entries(event?.dances ?? {}) as [string, Json][]) {
          for (const [platformId, platform] of Object.entries(dance?.platforms ?? {}) as [string, Json][]) {
            if (!Array.isArray(platform?.orderedJudgeIds)) continue;
            out.push({ path: `days/${dayId}/blocks/${blockId}/events/${eventId}/dances/${danceId}/platforms/${platformId}/orderedJudgeIds`, ids: platform.orderedJudgeIds });
          }
        }
      }
    }
  }
  return out;
}

export interface Cleared {
  name: string
  /** Age groups it sponsored. */
  sponsors: number
  /** Dances it judged in the schedule. */
  judging: number
}

export interface StaffPlan {
  updates: Updates
  /** How many the competition has now, and will have. */
  replacing: number
  count: number
  /** Who's dropped while something still pointed at them (those pointers are cleared). */
  cleared: Cleared[]
  /** Judges named in its championship points with no one by that name to move them to. */
  blocked: string[]
}

/**
 * Replacing one competition's staff (`to`) with another's (`from`): the same
 * keys, so sponsors and schedule judges can point at them. What pointed at
 * the old staff is moved to the new one with the same name, or cleared.
 */
export function planStaff(to: string, data: {
  from: Record<string, Json> | null
  to: Record<string, Json> | null
  groups?: Record<string, Json> | null
  schedule?: Json
  points?: Record<string, Json> | null
}): StaffPlan {
  const fromStaff = data.from ?? {};
  const toStaff = data.to ?? {};
  const base = `competitions:data/${to}`;
  const updates: Updates = {};

  // Each of its staff → the one taking their place: the same key, else the
  // same type and name, else the same name.
  const moved = new Map<string, string | null>();
  for (const [id, item] of Object.entries(toStaff)) {
    const key = personKey(item);
    const match = (fromStaff[id] && personKey(fromStaff[id]) === key && id)
      || Object.keys(fromStaff).find((f) => personKey(fromStaff[f]) === key && fromStaff[f]?.type === item?.type)
      || Object.keys(fromStaff).find((f) => personKey(fromStaff[f]) === key);
    moved.set(id, match || null);
  }

  const staff: Record<string, Json> = {};
  for (const [id, item] of Object.entries(fromStaff)) {
    // A back-pointer is the aggregator's to write; keep this one's when it's the same person.
    const mine = toStaff[id];
    const keep = mine && mine.type === item?.type && personKey(mine) === personKey(item)
      ? Object.fromEntries(BACK_POINTERS.filter((k) => mine[k]).map((k) => [k, mine[k]]))
      : {};
    staff[id] = { ...without(item, BACK_POINTERS), ...keep };
  }
  if (!same(staff, toStaff)) updates[`${base}/staff`] = Object.keys(staff).length ? staff : null;

  const cleared = new Map<string, Cleared>();
  const clear = (id: string) => {
    if (!cleared.has(id)) cleared.set(id, { name: personName(toStaff[id]) || 'Someone', sponsors: 0, judging: 0 });
    return cleared.get(id)!;
  };

  for (const [groupId, group] of Object.entries(data.groups ?? {})) {
    const sponsor = group?.sponsor;
    if (typeof sponsor !== 'string' || !(sponsor in toStaff)) continue; // a typed name, or no one
    const next = moved.get(sponsor);
    if (next === sponsor) continue;
    updates[`${base}/groups/${groupId}/sponsor`] = next;
    if (!next) clear(sponsor).sponsors += 1;
  }

  for (const { path, ids } of judgeLists(data.schedule)) {
    if (!ids.some((id) => id in toStaff)) continue;
    const next = ids.flatMap((id) => {
      if (!(id in toStaff)) return [id];
      const to2 = moved.get(id);
      if (!to2) clear(id).judging += 1;
      return to2 ? [to2] : [];
    });
    const unique = [...new Set(next)];
    if (!same(unique, ids)) updates[`${base}/schedule/${path}`] = unique.length ? unique : null;
  }

  // Championship points are kept under each judge's key: move them, never drop them.
  const blocked = new Set<string>();
  for (const [groupId, dances] of Object.entries(data.points ?? {})) {
    for (const [danceId, judges] of Object.entries(dances ?? {}) as [string, Json][]) {
      for (const [judgeId, points] of Object.entries(judges ?? {})) {
        if (!(judgeId in toStaff)) continue;
        const next = moved.get(judgeId);
        if (next === judgeId) continue;
        if (!next || (judges as Json)[next] !== undefined) {
          blocked.add(personName(toStaff[judgeId]) || 'a judge');
          continue;
        }
        updates[`${base}/points/${groupId}/${danceId}/${judgeId}`] = null;
        updates[`${base}/points/${groupId}/${danceId}/${next}`] = points;
      }
    }
  }

  return {
    updates,
    replacing: Object.keys(toStaff).length,
    count: Object.keys(fromStaff).length,
    cleared: [...cleared.values()],
    blocked: [...blocked],
  };
}

export interface PartPlan {
  part: Part
  updates: Updates
  /** It has something of its own there now, which this replaces. */
  replaces: boolean
  /** Why it can't be taken (staff only). */
  blocked?: string
  staff?: Omit<StaffPlan, 'updates' | 'blocked'>
}

/** Copying `part` from `from` into `to`. `records` caches competitions/{id}, read once each. */
async function planPart(db: Db, from: string, to: string, part: Part, records: Map<string, Json>): Promise<PartPlan> {
  const record = async (id: string) => {
    if (!records.has(id)) records.set(id, (await val(db, `competitions/${id}`)) ?? {});
    return records.get(id);
  };
  if (part !== 'staff') {
    const [src, dst] = await Promise.all([record(from), record(to)]);
    const updates: Updates = {};
    for (const f of PART_FIELDS[part]) {
      if (!same(src[f], dst[f])) updates[`competitions/${to}/${f}`] = src[f] ?? null;
    }
    const replaces = PART_FIELDS[part].some((f) => !blank(dst[f]) && !same(dst[f], src[f]));
    return { part, updates, replaces };
  }
  const [fromStaff, toData] = await Promise.all([
    val(db, `competitions:data/${from}/staff`),
    Promise.all(['staff', 'groups', 'schedule', 'points'].map((k) => val(db, `competitions:data/${to}/${k}`))),
  ]);
  const [toStaff, groups, schedule, points] = toData;
  const plan = planStaff(to, { from: fromStaff, to: toStaff, groups, schedule, points });
  const { updates, blocked, ...staff } = plan;
  const fromName = (await record(from)).name || 'the primary';
  return {
    part,
    updates,
    replaces: staff.replacing > 0 && `competitions:data/${to}/staff` in updates,
    blocked: blocked.length
      ? `Its championship points have marks from ${blocked.join(', ')}, who ${blocked.length > 1 ? 'aren’t' : 'isn’t'} on ${fromName}’s staff.`
      : undefined,
    staff,
  };
}

export interface TargetPreview {
  competitionId: string
  parts: Array<Omit<PartPlan, 'updates'>>
}

async function plansFor(db: Db, from: string, targets: Array<{ competitionId: string, parts: Part[] }>) {
  const records = new Map<string, Json>();
  return Promise.all(targets.map(async ({ competitionId, parts }) => ({
    competitionId,
    plans: await Promise.all(parts.map((p) => planPart(db, from, competitionId, p, records))),
  })));
}

const preview = (planned: Awaited<ReturnType<typeof plansFor>>): TargetPreview[] => planned.map(({ competitionId, plans }) => ({
  competitionId,
  parts: plans.map(({ updates, ...rest }) => { void updates; return rest; }),
}));

function applyOrRefuse(planned: Awaited<ReturnType<typeof plansFor>>, into: Updates) {
  for (const { plans } of planned) {
    for (const plan of plans) {
      if (plan.blocked) throw new HttpsError('failed-precondition', plan.blocked);
      Object.assign(into, plan.updates);
    }
  }
}

// Taking one out ---------------------------------------------------------------

/**
 * Takes a competition out of its link, keeping everything it has. Its
 * primary leaving stops the others syncing (Manage asks for a new one), and
 * a link of one is no link.
 */
export async function takeOut(db: Db, competitionId: string) {
  const link = await linkOf(db, competitionId);
  const updates: Updates = {
    [`competitionLinks:of/${competitionId}`]: null,
    [`competitionLinks:sync/${competitionId}`]: null,
  };
  if (link) {
    const { linkId } = link;
    const left = link.members.filter((id) => id !== competitionId);
    updates[`competitionLinks/${linkId}/competitions/${competitionId}`] = null;
    if (link.primary === competitionId) {
      updates[`competitionLinks/${linkId}/primary`] = null;
      for (const id of left) updates[`competitionLinks:sync/${id}`] = null;
    }
    if (left.length < 2) {
      updates[`competitionLinks/${linkId}`] = null;
      for (const id of left) {
        updates[`competitionLinks:of/${id}`] = null;
        updates[`competitionLinks:sync/${id}`] = null;
      }
    }
  }
  await db.update(updates);
  return link;
}

// The callable ------------------------------------------------------------------

const idOf = (v: unknown) => (typeof v === 'string' && /^[^.#$/[\]]{1,128}$/.test(v) ? v : null);

/**
 * Callable: every change to a link, by `action`.
 *
 * - `link` { competitionId, withId, parts?, dryRun? }: links two. The one
 *   not yet in a link joins the other's (or `withId` starts one, as its
 *   primary) and takes `parts` (all, unless said) from the primary.
 * - `unlink` { competitionId }: takes it out, keeping what it has.
 * - `primary` { competitionId, dryRun? }: makes it the primary, re-copying
 *   the others' synced parts from it. The old primary takes what it took.
 * - `sync` { competitionId, part, on, dryRun? }: one competition taking a
 *   part or not; on the primary, every other one at once.
 * - `syncNow` { competitionId }: copies its synced parts again (on the
 *   primary, every other one's), for anything that went astray.
 *
 * A dry run says what would be replaced, for Manage to confirm first.
 * Changing a link needs you to manage every competition it changes (or be a
 * system admin): otherwise someone could attach theirs to a popular one, or
 * push their staff into someone else's. Taking your own out needs only yours.
 */
export function getOnLink(db: Db) {
  return async (data: Json, ctx: Json) => {
    const uid = ctx.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '');
    const perms = (await val(db, `users:permissions/${uid}`)) ?? {};
    const manages = (id: string) => perms.admin === true || perms.competitions?.[id] === true;
    const mustManage = (ids: string[], message: string) => {
      if (!ids.every(manages)) throw new HttpsError('permission-denied', message);
    };
    const action = data?.action;
    const competitionId = idOf(data?.competitionId);
    if (!competitionId) throw new HttpsError('invalid-argument', 'Which competition?');
    const dryRun = data?.dryRun === true;

    if (action === 'link') {
      const withId = idOf(data?.withId);
      if (!withId || withId === competitionId) throw new HttpsError('invalid-argument', 'Link it with which competition?');
      const parts = Array.isArray(data?.parts) ? PARTS.filter((p) => data.parts.includes(p)) : [...PARTS];
      const [aThere, bThere, a, b] = await Promise.all([exists(db, competitionId), exists(db, withId), linkOf(db, competitionId), linkOf(db, withId)]);
      if (!aThere || !bThere) throw new HttpsError('not-found', 'That competition isn’t there any more.');
      if (a && b) {
        if (a.linkId === b.linkId) throw new HttpsError('already-exists', 'They’re linked already.');
        throw new HttpsError('failed-precondition', 'Both are linked with others already. Take one out of its link first.');
      }
      // The one not in a link joins; with neither, `withId` (the one you're on) starts one.
      const link = b ?? a;
      const joining = b || !a ? competitionId : withId;
      const primary = link ? link.primary : withId;
      if (!primary) throw new HttpsError('failed-precondition', 'Choose which of those is the primary first.');
      mustManage([joining, primary], 'You need to manage both competitions to link them.');
      if ((link?.members.length ?? 1) + 1 > MAX_LINKED) {
        throw new HttpsError('failed-precondition', `A link has at most ${MAX_LINKED} competitions.`);
      }
      const planned = await plansFor(db, primary, [{ competitionId: joining, parts }]);
      if (dryRun) return { joining, primary, targets: preview(planned) };

      const linkId = link?.linkId ?? db.child('competitionLinks').push().key;
      const updates: Updates = {
        [`competitionLinks/${linkId}/primary`]: primary,
        [`competitionLinks/${linkId}/competitions/${primary}`]: true,
        [`competitionLinks/${linkId}/competitions/${joining}`]: true,
        [`competitionLinks:of/${primary}`]: linkId,
        [`competitionLinks:of/${joining}`]: linkId,
        [`competitionLinks:sync/${joining}`]: parts.length ? Object.fromEntries(parts.map((p) => [p, true])) : null,
      };
      applyOrRefuse(planned, updates);
      await db.update(updates);
      return { linkId, joining, primary };
    }

    const link = await linkOf(db, competitionId);

    if (action === 'unlink') {
      if (!link) return { linkId: null };
      if (!manages(competitionId) && !(link.primary && manages(link.primary))) {
        throw new HttpsError('permission-denied', 'You need to manage it, or the primary, to take it out.');
      }
      await takeOut(db, competitionId);
      return { linkId: link.linkId };
    }

    if (!link) throw new HttpsError('failed-precondition', 'It isn’t linked with any others.');

    if (action === 'primary') {
      if (link.primary === competitionId) return { linkId: link.linkId };
      mustManage(link.members, 'You need to manage every linked competition to change the primary.');
      // It stops taking anything; the old primary takes what it took.
      const theirs = await flagsOf(db, competitionId);
      const flags = new Map<string, Part[]>();
      for (const id of link.members) {
        if (id === competitionId) continue;
        flags.set(id, id === link.primary ? theirs : await flagsOf(db, id));
      }
      const planned = await plansFor(db, competitionId, [...flags].map(([id, parts]) => ({ competitionId: id, parts })));
      if (dryRun) return { primary: competitionId, targets: preview(planned) };
      const updates: Updates = {
        [`competitionLinks/${link.linkId}/primary`]: competitionId,
        [`competitionLinks:sync/${competitionId}`]: null,
      };
      if (link.primary) {
        updates[`competitionLinks:sync/${link.primary}`] = theirs.length ? Object.fromEntries(theirs.map((p) => [p, true])) : null;
      }
      applyOrRefuse(planned, updates);
      await db.update(updates);
      return { linkId: link.linkId };
    }

    if (action === 'sync') {
      const { part } = data;
      if (!isPart(part)) throw new HttpsError('invalid-argument', 'Sync which part?');
      if (!link.primary) throw new HttpsError('failed-precondition', 'Choose a primary first.');
      const on = data?.on === true;
      // On the primary, the switch is every other one's.
      const targets = link.primary === competitionId ? link.members.filter((id) => id !== competitionId) : [competitionId];
      const current = await Promise.all(targets.map(async (id) => (await val(db, `competitionLinks:sync/${id}/${part}`)) === true));
      const changing = targets.filter((_, i) => current[i] !== on);
      mustManage(changing, 'You need to manage every competition that would change.');
      const planned = on ? await plansFor(db, link.primary, changing.map((id) => ({ competitionId: id, parts: [part] }))) : [];
      if (dryRun) return { primary: link.primary, targets: preview(planned) };
      const updates: Updates = {};
      for (const id of changing) updates[`competitionLinks:sync/${id}/${part}`] = on ? true : null;
      applyOrRefuse(planned, updates);
      if (Object.keys(updates).length) await db.update(updates);
      return { linkId: link.linkId, changed: changing.length };
    }

    if (action === 'syncNow') {
      if (!link.primary) throw new HttpsError('failed-precondition', 'Choose a primary first.');
      const targets = link.primary === competitionId ? link.members.filter((id) => id !== competitionId) : [competitionId];
      mustManage(targets, 'You need to manage every competition it would copy into.');
      const planned = await plansFor(db, link.primary, await Promise.all(targets.map(async (id) => ({ competitionId: id, parts: await flagsOf(db, id) }))));
      const updates: Updates = {};
      applyOrRefuse(planned, updates);
      if (Object.keys(updates).length) await db.update(updates);
      return { linkId: link.linkId, copied: Object.keys(updates).length };
    }

    throw new HttpsError('invalid-argument', 'Unknown action.');
  };
}

// Keeping them in step -----------------------------------------------------------

/**
 * competitions:data/{competitionId}/staff/{staffId}, written: a primary's
 * staff member goes to every competition taking its staff. It reads the
 * member fresh, rather than taking the event's, so events that arrive out of
 * order still end up in step. Back-pointers are each competition's own.
 */
export function getOnStaffWritten(db: Db) {
  return async (change: Json, ctx: Json) => {
    const { competitionId, staffId } = ctx.params;
    if (same(without(change.before.val(), BACK_POINTERS), without(change.after.val(), BACK_POINTERS))) return;
    const link = await linkOf(db, competitionId);
    if (!link || link.primary !== competitionId) return;
    const targets = await syncing(db, link, 'staff');
    if (!targets.length) return;
    const item = await val(db, `competitions:data/${competitionId}/staff/${staffId}`);
    const updates: Updates = {};
    await Promise.all(targets.map(async (id) => {
      const path = `competitions:data/${id}/staff/${staffId}`;
      if (!item) {
        // Gone: off its schedule there and off any trophy it sponsors, as
        // deleting one in Manage does.
        updates[path] = null;
        const [groups, schedule] = await Promise.all([val(db, `competitions:data/${id}/groups`), val(db, `competitions:data/${id}/schedule`)]);
        for (const [groupId, group] of Object.entries(groups ?? {}) as [string, Json][]) {
          if (group?.sponsor === staffId) updates[`competitions:data/${id}/groups/${groupId}/sponsor`] = null;
        }
        for (const { path: at, ids } of judgeLists(schedule)) {
          if (!ids.includes(staffId)) continue;
          const kept = ids.filter((j) => j !== staffId);
          updates[`competitions:data/${id}/schedule/${at}`] = kept.length ? kept : null;
        }
        return;
      }
      const theirs = (await val(db, path)) ?? {};
      for (const key of new Set([...Object.keys(item), ...Object.keys(theirs)])) {
        if (!BACK_POINTERS.includes(key)) updates[`${path}/${key}`] = item[key] ?? null;
      }
    }));
    await db.update(updates);
  };
}

/**
 * competitions/{competitionId}, updated: a primary's changed parts go to
 * every competition taking them, read fresh as staff are.
 */
export function getOnCompetitionUpdated(db: Db) {
  return async (change: Json, ctx: Json) => {
    const { competitionId } = ctx.params;
    const before = change.before.val() ?? {};
    const after = change.after.val() ?? {};
    const changed = FIELD_PARTS.filter((p) => PART_FIELDS[p].some((f) => !same(before[f], after[f])));
    if (!changed.length) return;
    const link = await linkOf(db, competitionId);
    if (!link || link.primary !== competitionId) return;
    const fresh = await val(db, `competitions/${competitionId}`);
    if (!fresh) return;
    const updates: Updates = {};
    for (const part of changed) {
      for (const id of await syncing(db, link, part)) {
        for (const f of PART_FIELDS[part]) updates[`competitions/${id}/${f}`] = fresh[f] ?? null;
      }
    }
    if (Object.keys(updates).length) await db.update(updates);
  };
}
