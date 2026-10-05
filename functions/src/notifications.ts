import { createHash } from 'node:crypto';
import type { App } from 'firebase-admin/app';
import type { DataSnapshot, Reference } from 'firebase-admin/database';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import tzlookup from '@photostructure/tz-lookup';

// Push alerts for people following dancers and competitions.
//
// Data:
//   users:favorites/{uid}/dancers/{aggregateId}      who follows whom (written by the app)
//   users:favorites/{uid}/competitions/{competitionId}
//   dancers:followers/{aggregateId}/{uid}            reverse indexes, kept in step by the
//   competitions:followers/{competitionId}/{uid}     favourite triggers (backfillFollowers
//                                                    builds them once)
//   users/{uid}/alerts = { enabled, results, morning, published }
//                                                    the person's choices: enabled must be
//                                                    true, and each kind is on unless false
//   users:tokens/{uid}/{key} = { token, platform, updatedAt }
//                                                    device push tokens: FCM registration
//                                                    tokens on iOS and Android alike (the app
//                                                    gets them from @capacitor-firebase/messaging).
//                                                    Never store a raw APNs token here: FCM
//                                                    rejects it, and the dead-token cleanup
//                                                    below would delete it.
//   notifications:sent/{key} = signature             what was last sent, so edits and re-saves
//                                                    don't notify twice for the same thing
//
// Results wait for the organiser to pause: the database trigger only checks
// there's someone to tell, then queues a Cloud Task that runs a minute later
// (getOnResultsSettled) and sends what stands, unless it's changed again.
//
// In the emulator nothing is sent to FCM: each would-be message is written to
// notifications:log instead (System admin shows it as an outbox).

type Db = Reference;
type Change = { before: DataSnapshot; after: DataSnapshot };
type Ctx = { params: Record<string, string> };

export type AlertKind = 'results' | 'morning' | 'published';

const REVERSE_PREFIX = 'reverse:';
const TIE_SUFFIX = ':tie';
const OVERALL_ID = 'overall';
const CALLBACKS_ID = 'callbacks';
const DAY_MS = 86_400_000;
/** The morning summary goes out in this hour, local to the competition. */
const MORNING_HOUR = 6;

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function ordinal(n: number) {
  const s = n % 100;
  if (s >= 11 && s <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/**
 * Entry id → place (1-based), read the way the app reads stored placings
 * (web/src/lib/admin/results.ts): ["reverse:N"?, "entryId", "entryId:tie", …].
 * ":tie" ties a dancer with the one before; "reverse:N" means places were
 * entered from Nth up to 1st.
 */
export function parsePlacings(raw: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (!Array.isArray(raw) || !raw.length) return out;
  let entries = raw as unknown[];
  let reverseFrom: number | null = null;
  if (typeof entries[0] === 'string' && entries[0].startsWith(REVERSE_PREFIX)) {
    const n = Number.parseInt(entries[0].slice(REVERSE_PREFIX.length), 10);
    reverseFrom = n > 0 ? n : null;
    entries = entries.slice(1);
  }
  const rows = entries
    .filter((e): e is string => typeof e === 'string' && e.length > 0 && !e.startsWith(REVERSE_PREFIX))
    .map((e) => ({
      id: e.endsWith(TIE_SUFFIX) ? e.slice(0, -TIE_SUFFIX.length) : e,
      tie: e.endsWith(TIE_SUFFIX),
    }));
  rows.forEach((row, i) => {
    let place: number;
    if (reverseFrom != null) {
      const rest = rows.slice(i + 1);
      const offset = rest.findIndex((r) => !r.tie);
      const end = offset < 0 ? rows.length - 1 : i + offset;
      place = reverseFrom - end;
    } else {
      place = 1;
      for (let j = 0; j <= i; j += 1) if (j === 0 || !rows[j].tie) place = j + 1;
    }
    if (place > 0) out.set(row.id, place);
  });
  return out;
}

/** A stored competition date as an instant: 'YYYY-MM-DD' (read as noon UTC), ms, or an ISO string. */
function dateValue(date: unknown): Date | null {
  if (date == null || date === '') return null;
  let d: Date;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) d = new Date(`${date}T12:00:00Z`);
  else if (typeof date === 'string' && /^\d{10,}$/.test(date)) d = new Date(Number(date));
  else d = new Date(date as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysFromToday(date: unknown, now = Date.now()): number | null {
  const d = dateValue(date);
  return d ? Math.round((d.getTime() - now) / DAY_MS) : null;
}

/** The competition's IANA time zone, from its coordinates; null without usable ones. */
export function competitionZone(comp: { lat?: unknown; lng?: unknown } | null | undefined): string | null {
  const { lat, lng } = comp ?? {};
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  try {
    return tzlookup(lat, lng);
  } catch {
    return null;
  }
}

/** The calendar day ('YYYY-MM-DD') and hour (0–23) at `at` in `timeZone`. */
function localDayHour(at: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return { day: `${part('year')}-${part('month')}-${part('day')}`, hour: Number(part('hour')) };
}

/** The competition's calendar day where it's held. */
function competitionDay(date: unknown, timeZone: string): string | null {
  const d = dateValue(date);
  if (!d) return null;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return localDayHour(d.getTime(), timeZone).day;
}

/**
 * Is it 06:00–06:59 on competition day where the competition is held? The
 * morning job runs hourly, so this is true on exactly one of its runs.
 */
export function isMorningOf(
  comp: { date?: unknown; lat?: unknown; lng?: unknown } | null | undefined,
  now = Date.now(),
): boolean {
  const zone = competitionZone(comp);
  if (!zone) return false;
  const local = localDayHour(now, zone);
  return local.hour === MORNING_HOUR && local.day === competitionDay(comp?.date, zone);
}

export interface ResultContext {
  competitionName?: string | null;
  /** Category and age group, e.g. "Premier 12 & Under". */
  groupName?: string | null;
  danceName?: string | null;
  overall: boolean;
}

/** A dance's name as people say it, without "the": "Highland Fling". */
function danceTitle(name: unknown) {
  const n = typeof name === 'string' ? name.trim() : '';
  return n.replace(/^the\s+/i, '') || 'Dance';
}

/**
 * One dancer's result alert: placed (with `place`) or not. The news goes in
 * the title, short enough for a lock screen ("Isla placed 1st"); which dance
 * and where, under it.
 */
export function resultMessage(ctx: ResultContext, firstName: string | null | undefined, place?: number) {
  const first = firstName?.trim() || 'Your dancer';
  const where = [ctx.groupName, ctx.competitionName].filter(Boolean).join(' · ');
  if (ctx.overall) {
    return {
      title: place ? `${first} placed ${ordinal(place)} overall` : 'Overall results are in',
      body: where,
    };
  }
  if (place) return { title: `${first} placed ${ordinal(place)}`, body: [danceTitle(ctx.danceName), where].filter(Boolean).join(' · ') };
  return { title: `${danceTitle(ctx.danceName)} results are in`, body: where };
}

/** "Ailsa", "Ailsa and Mairi", "Ailsa, Mairi and Iona". */
const listNames = (names: string[]) => (names.length > 1
  ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  : names[0]);

/**
 * A competition alert: the morning of, or when it's published. `names` are
 * the first names of the dancers the person follows who are entered (none
 * when they follow only the competition).
 */
export function competitionMessage(
  kind: 'morning' | 'published',
  competitionName: string | null | undefined,
  names: string[],
) {
  const competition = competitionName?.trim() || 'The competition';
  const who = names.length ? listNames(names) : null;
  const verb = names.length > 1 ? 'are' : 'is';
  if (kind === 'morning') {
    return {
      title: `${competition} is today`,
      body: who ? `${who} ${verb} dancing. Tap for platforms and dancing order.` : 'Tap for platforms and dancing order.',
    };
  }
  return {
    title: `${competition} is live`,
    body: who
      ? `${who} ${verb} on the dancer list. See platforms and dancing order.`
      : 'The dancer list and schedule are up.',
  };
}

interface Message {
  uid: string;
  kind: AlertKind;
  competitionId: string;
  title: string;
  body: string;
  link: string;
  /** Under notifications:sent. */
  key: string;
  /** What this message says, in short: the same signature isn't sent twice. */
  signature: string;
}

/**
 * How each kind interrupts. iOS: a placing is Time Sensitive (it gets through
 * Focus and the scheduled summary), the morning of is a normal alert, and a
 * dancer list going up is passive (no sound; it waits in Notification
 * Centre). Android: the channel of the same name, made by the app, at the
 * matching importance; people can change each in the phone's settings.
 */
const DELIVERY: Record<AlertKind, { interruption: string; relevance: number }> = {
  results: { interruption: 'time-sensitive', relevance: 1 },
  morning: { interruption: 'active', relevance: 0.7 },
  published: { interruption: 'passive', relevance: 0.4 },
};

/** A short id for what a message is about: a newer one replaces it on the phone. */
export const collapseId = (key: string) => createHash('sha256').update(key).digest('base64url');

/** What FCM is sent for one message to a person's devices. */
export function fcmMessage(
  m: Pick<Message, 'title' | 'body' | 'link' | 'competitionId' | 'kind' | 'key'>,
  tokens: string[],
): MulticastMessage {
  const { interruption, relevance } = DELIVERY[m.kind];
  // A correction (placed 4th, then 3rd) replaces the alert it corrects.
  const replaces = collapseId(m.key);
  return {
    tokens,
    notification: { title: m.title, body: m.body },
    data: { link: m.link },
    apns: {
      headers: { 'apns-collapse-id': replaces },
      // threadId is sent as aps "thread-id": iOS groups a competition's alerts.
      payload: {
        aps: {
          ...(interruption !== 'passive' && { sound: 'default' }),
          threadId: m.competitionId,
          'interruption-level': interruption,
          'relevance-score': relevance,
        },
      },
    },
    // The icon is in the app's Android resources.
    android: { notification: { channelId: m.kind, tag: replaces, icon: 'ic_stat_scott', color: '#0065bd' } },
    // Delivery numbers per kind, in the Firebase console's messaging reports.
    fcmOptions: { analyticsLabel: m.kind },
  };
}

/** FCM says this token will never work: unregistered, or not an FCM token at all. */
export function isDeadToken(error: { code?: string; message?: string } | undefined) {
  const code = error?.code ?? '';
  if (/registration-token-not-registered|invalid-registration-token/.test(code)) return true;
  // invalid-argument also covers a bad message, which mustn't cost anyone their tokens.
  return /invalid-argument/.test(code) && /registration token/i.test(error?.message ?? '');
}

async function tokensFor(db: Db, uid: string) {
  const snap = await db.child(`users:tokens/${uid}`).get();
  return Object.entries((snap.val() || {}) as Record<string, { token?: string }>)
    .map(([key, v]) => ({ key, token: v?.token }))
    .filter((t): t is { key: string; token: string } => typeof t.token === 'string' && !!t.token);
}

async function deliverOne(db: Db, app: App, m: Message, emulated: boolean) {
  // Claim the signature first, in one step, so two runs for the same save
  // (events can arrive twice) can't both send.
  const ledger = db.child(`notifications:sent/${m.key}`);
  let before: unknown = null;
  const claim = await ledger.transaction((sent) => {
    before = sent;
    return sent === m.signature ? undefined : m.signature;
  });
  if (!claim.committed) return;
  const tokens = await tokensFor(db, m.uid);
  if (emulated) {
    await db.child('notifications:log').push().set({
      uid: m.uid,
      title: m.title,
      body: m.body,
      link: m.link,
      kind: m.kind,
      competitionId: m.competitionId,
      tokens: tokens.length,
      at: Date.now(),
    });
    return;
  }
  if (!tokens.length) return;
  let res;
  try {
    res = await getMessaging(app).sendEachForMulticast(fcmMessage(m, tokens.map((t) => t.token)));
  } catch (e) {
    // Not sent (FCM unreachable, say): give the claim back, so a retry (the
    // results task's) sends it rather than finding it already sent.
    await ledger.set(before ?? null);
    throw e;
  }
  // Forget tokens FCM says are gone.
  const dead = res.responses
    .map((r, i) => (!r.success && isDeadToken(r.error) ? tokens[i].key : null))
    .filter((k): k is string => !!k);
  await Promise.all(dead.map((k) => db.child(`users:tokens/${m.uid}/${k}`).remove()));
}

function deliver(db: Db, app: App, messages: Message[], emulated: boolean) {
  return Promise.all(messages.map((m) => deliverOne(db, app, m, emulated)));
}

/** uid → whether they want this kind of alert (read once per uid). */
function wanted(db: Db, kind: AlertKind) {
  const seen = new Map<string, Promise<boolean>>();
  return (uid: string) => {
    if (!seen.has(uid)) {
      seen.set(uid, db.child(`users/${uid}/alerts`).get().then((snap) => {
        const a = snap.val() || {};
        return a.enabled === true && a[kind] !== false;
      }));
    }
    return seen.get(uid) as Promise<boolean>;
  };
}

/** One dance's results, as saved: sent once they've stood for a minute. */
export interface SettleTask {
  competitionId: string;
  groupId: string;
  danceId: string;
  results: unknown[];
}

type Entry = { firstName?: string; dancerId?: string };

/** Everyone entered in an age group, with who follows them. */
async function entriesWithFollowers(db: Db, competitionId: string, groupId: string) {
  const snap = await db.child(`competitions:data/${competitionId}/dancers`).orderByChild('groupId').equalTo(groupId).get();
  return Promise.all(
    Object.entries((snap.val() || {}) as Record<string, Entry>)
      .filter(([, entry]) => !!entry?.dancerId)
      .map(async ([entryId, entry]) => ({
        entryId,
        entry,
        followers: Object.keys((await db.child(`dancers:followers/${entry.dancerId}`).get()).val() || {}),
      })),
  );
}

/** Published, and (outside the emulator, whose data is years old) around competition day. */
async function liveCompetition(db: Db, competitionId: string, emulated: boolean) {
  const comp = (await db.child(`competitions/${competitionId}`).get()).val() || {};
  if (comp.published !== true) return null;
  // Backfilling old results must not notify.
  const days = daysFromToday(comp.date);
  if (!emulated && (days == null || days < -1 || days > 1)) return null;
  return comp as { name?: string };
}

/**
 * Results for one dance (or overall) were saved. Manage saves each placing as
 * it's tapped, so nothing is sent yet: if anyone follows a dancer in the age
 * group, `schedule` queues the dance for getOnResultsSettled, a minute on.
 */
export function getOnResultsWritten(db: Db, emulated: boolean, schedule: (task: SettleTask) => Promise<unknown>) {
  return async (change: Change, ctx: Ctx) => {
    const { competitionId, groupId, danceId } = ctx.params;
    if (danceId === CALLBACKS_ID) return;
    const after = change.after.val();
    if (!Array.isArray(after) || !after.length) return;
    if (same(change.before.val(), after)) return;
    // Championship mode switched on before anyone's placed: nothing to say yet.
    if (!parsePlacings(after).size) return;
    if (!(await liveCompetition(db, competitionId, emulated))) return;
    const entries = await entriesWithFollowers(db, competitionId, groupId);
    if (!entries.some((e) => e.followers.length)) return;
    await schedule({ competitionId, groupId, danceId, results: after });
  };
}

/**
 * A minute after a save: if the dance's results still stand as saved, its
 * followers hear. Each placed dancer's, their place; the rest of the age
 * group's, that results are in. Changed since, a later save's task has it.
 */
export function getOnResultsSettled(db: Db, app: App, emulated: boolean) {
  return async ({ competitionId, groupId, danceId, results }: SettleTask) => {
    const dataRef = (path: string) => db.child(`competitions:data/${competitionId}/${path}`);
    if (!same((await dataRef(`results/${groupId}/${danceId}`).get()).val(), results)) return;
    const placings = parsePlacings(results);
    if (!placings.size) return;
    const comp = await liveCompetition(db, competitionId, emulated);
    if (!comp) return;

    const overall = danceId === OVERALL_ID;
    const [entries, danceSnap, groupSnap] = await Promise.all([
      entriesWithFollowers(db, competitionId, groupId),
      overall ? Promise.resolve(null) : dataRef(`dances/${danceId}/name`).get(),
      dataRef(`groups/${groupId}`).get(),
    ]);
    const group = groupSnap.val() || {};
    const category = group.categoryId
      ? (await dataRef(`categories/${group.categoryId}/name`).get()).val()
      : null;
    const context: ResultContext = {
      competitionName: comp.name,
      groupName: [category, group.name].filter(Boolean).join(' '),
      danceName: danceSnap?.val(),
      overall,
    };
    const link = `/competitions/${competitionId}/results/${groupId}#dance-${danceId}`;

    const wants = wanted(db, 'results');

    const perEntry = await Promise.all(
      entries.map(async ({ entryId, entry, followers }) => {
        const allowed = await Promise.all(followers.map(wants));
        const place = placings.get(entryId);
        return followers
          .filter((_, i) => allowed[i])
          .map<Message>((uid) => ({
          uid,
          kind: 'results',
          competitionId,
          ...resultMessage(context, entry.firstName, place),
          link,
          key: `${competitionId}/${groupId}/${danceId}/${uid}_${entryId}`,
          signature: String(place ?? 'in'),
        }));
      }),
    );
    await deliver(db, app, perEntry.flat(), emulated);
  };
}

/**
 * A dancer favourite is a follow of a person when it holds their name (v4
 * always stores one) and isn't one of the old app's per-competition keys
 * already copied to the person (oldDancers), as the app reads them
 * (web/src/stores/favorites.ts). The old app's `true` keys never are.
 */
const isPersonFollow = (value: unknown, key: string, oldDancers: Record<string, unknown> | null | undefined) =>
  typeof value === 'string' && !oldDancers?.[key];

/** Keeps dancers:followers in step with users:favorites/{uid}/dancers. */
export function getOnFavoriteWritten(db: Db) {
  return async (change: Change, ctx: Ctx) => {
    const { uid, aggregateId } = ctx.params;
    const ref = db.child(`dancers:followers/${aggregateId}/${uid}`);
    const value = change.after.val();
    const old = typeof value === 'string'
      ? (await db.child(`users:favorites/${uid}/oldDancers/${aggregateId}`).get()).val()
      : null;
    if (isPersonFollow(value, aggregateId, old ? { [aggregateId]: old } : null)) await ref.set(true);
    else await ref.remove();
  };
}

/** Keeps competitions:followers in step with users:favorites/{uid}/competitions. */
export function getOnCompetitionFavoriteWritten(db: Db) {
  return async (change: Change, ctx: Ctx) => {
    const { uid, competitionId } = ctx.params;
    const ref = db.child(`competitions:followers/${competitionId}/${uid}`);
    if (change.after.exists()) await ref.set(true);
    else await ref.remove();
  };
}

/** One-off: build dancers:followers and competitions:followers from existing favourites. */
export function getOnBackfillFollowers(db: Db) {
  return async () => {
    const all = (await db.child('users:favorites').get()).val() || {};
    const updates: Record<string, true> = {};
    let dancerFollows = 0;
    let competitionFollows = 0;
    type Fav = { dancers?: Record<string, unknown>; competitions?: Record<string, unknown>; oldDancers?: Record<string, unknown> };
    Object.entries(all as Record<string, Fav>).forEach(([uid, fav]) => {
      Object.entries(fav?.dancers || {}).forEach(([aggregateId, value]) => {
        if (!isPersonFollow(value, aggregateId, fav?.oldDancers)) return;
        updates[`dancers:followers/${aggregateId}/${uid}`] = true;
        dancerFollows += 1;
      });
      Object.keys(fav?.competitions || {}).forEach((competitionId) => {
        updates[`competitions:followers/${competitionId}/${uid}`] = true;
        competitionFollows += 1;
      });
    });
    // In batches: the database refuses one write this big.
    const paths = Object.keys(updates);
    for (let i = 0; i < paths.length; i += 500) {
      await db.update(Object.fromEntries(paths.slice(i, i + 500).map((p) => [p, true])));
    }
    return { dancerFollows, competitionFollows };
  };
}

/**
 * uid → first names of followed dancers entered in a competition. People who
 * follow the competition itself are included with no names.
 */
async function recipientsFor(db: Db, competitionId: string) {
  type Entry = { firstName?: string; dancerId?: string };
  const entries = Object.values(
    ((await db.child(`competitions:data/${competitionId}/dancers`).get()).val() || {}) as Record<string, Entry>,
  );
  const byUid = new Map<string, Set<string>>();
  const personIds = [...new Set(entries.map((e) => e?.dancerId).filter((x): x is string => !!x))];
  const firstName = new Map(entries.filter((e) => e?.dancerId).map((e) => [e.dancerId as string, e.firstName?.trim() || '']));
  const followerLists = await Promise.all(
    personIds.map(async (id) => Object.keys((await db.child(`dancers:followers/${id}`).get()).val() || {})),
  );
  followerLists.forEach((uids, i) => uids.forEach((uid) => {
    const set = byUid.get(uid) ?? new Set<string>();
    const name = firstName.get(personIds[i]);
    if (name) set.add(name);
    byUid.set(uid, set);
  }));
  const competitionFollowers = Object.keys((await db.child(`competitions:followers/${competitionId}`).get()).val() || {});
  competitionFollowers.forEach((uid) => byUid.set(uid, byUid.get(uid) ?? new Set()));
  return byUid;
}

async function notifyCompetition(
  db: Db,
  app: App,
  emulated: boolean,
  competitionId: string,
  comp: { name?: string },
  kind: 'morning' | 'published',
  signature: string,
) {
  const recipients = await recipientsFor(db, competitionId);
  const uids = [...recipients.keys()];
  const wants = wanted(db, kind);
  const allowed = await Promise.all(uids.map(wants));
  const messages = uids.filter((_, i) => allowed[i]).map<Message>((uid) => ({
    uid,
    kind,
    competitionId,
    ...competitionMessage(kind, comp.name, [...(recipients.get(uid) ?? [])]),
    link: `/competitions/${competitionId}/info`,
    key: `${competitionId}/${kind}/${uid}`,
    signature,
  }));
  await deliver(db, app, messages, emulated);
  return messages.length;
}

/**
 * A competition was published (organisers usually do this when the dancer
 * list is ready). Run it after the publish sync: that links entries to the
 * dancers people follow.
 */
export function getOnCompetitionPublished(db: Db, app: App, emulated: boolean) {
  return async (change: Change, ctx: Ctx) => {
    if (change.before.val() === true || change.after.val() !== true) return;
    const { competitionId } = ctx.params;
    const comp = (await db.child(`competitions/${competitionId}`).get()).val() || {};
    if (comp.published !== true) return;
    // Publishing an old competition (adding past results) must not notify.
    const days = daysFromToday(comp.date);
    if (!emulated && (days == null || days < -1)) return;
    await notifyCompetition(db, app, emulated, competitionId, comp, 'published', 'published');
  };
}

/**
 * Morning of competition day, 06:00 where it's held: a summary for everyone
 * following someone entered (or the competition). Runs hourly.
 */
export async function sendMorningSummaries(db: Db, app: App, emulated: boolean, now = Date.now()) {
  const utcDay = (offset: number) => new Date(now + offset * DAY_MS).toISOString().slice(0, 10);
  const byDate = db.child('competitions').orderByChild('date');
  // Today somewhere is yesterday, today or tomorrow in UTC. Dates are mostly
  // 'YYYY-MM-DD'; ISO strings sort just after their day, and some are ms.
  const [strings, numbers] = await Promise.all([
    byDate.startAt(utcDay(-1)).endAt(`${utcDay(1)}\uf8ff`).get(),
    byDate.startAt(Date.parse(`${utcDay(-1)}T00:00:00Z`)).endAt(Date.parse(`${utcDay(2)}T00:00:00Z`) - 1).get(),
  ]);
  type Comp = { name?: string; date?: unknown; lat?: unknown; lng?: unknown; published?: unknown };
  const candidates = Object.entries({ ...(strings.val() || {}), ...(numbers.val() || {}) } as Record<string, Comp>)
    .filter(([, c]) => c?.published === true);
  const unplaced = candidates.filter(([, c]) => !competitionZone(c)).length;
  if (unplaced) {
    console.warn(`morningSummaries: ${unplaced} published competition(s) around today have no coordinates, so no morning summary`);
  }
  const due = candidates.filter(([, c]) => isMorningOf(c, now));
  const counts = await Promise.all(due.map(([id, c]) => {
    const day = competitionDay(c.date, competitionZone(c) as string);
    // Per competition and day: a re-run in the same hour can't send twice.
    return notifyCompetition(db, app, emulated, id, c, 'morning', `morning:${day}`);
  }));
  return { competitions: due.length, messages: counts.reduce((a, b) => a + b, 0) };
}

/**
 * One competition's morning summary, now, whatever the time: for trying it
 * out (System admin › Tools offers it on a local emulator, where scheduled
 * jobs don't run). Sends to each person once a day, as the hourly job does.
 */
export async function sendMorningSummaryNow(db: Db, app: App, emulated: boolean, competitionId: string) {
  const comp = (await db.child(`competitions/${competitionId}`).get()).val();
  if (!comp?.published) return { messages: 0 };
  const day = competitionDay(comp.date, competitionZone(comp) ?? 'UTC');
  return { messages: await notifyCompetition(db, app, emulated, competitionId, comp, 'morning', `morning:${day}`) };
}
