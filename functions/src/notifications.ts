import admin from 'firebase-admin';

// Result alerts for followed dancers.
//
// Data:
//   users:favorites/{uid}/dancers/{aggregateId}   who follows whom (written by the app)
//   dancers:followers/{aggregateId}/{uid}         reverse index, kept by onFavoriteWritten
//   users/{uid}/alerts/{enabled,results,morning,published}
//                                                  the person's choices (kinds default on)
//   competitions:followers/{competitionId}/{uid}   reverse index of followed competitions
//   users:tokens/{uid}/{key} = { token, platform } device push tokens
//   notifications:sent/{competitionId}/{groupId}/{danceId}/{uid}_{entryId}
//                                                  what was last sent, so edits and re-saves
//                                                  don't notify twice for the same placing
//
// In the emulator nothing is sent to FCM; each would-be message is written to
// notifications:log instead so the flow can be checked end to end.

type Db = admin.database.Reference;

const REVERSE_PREFIX = 'reverse:';
const TIE_SUFFIX = ':tie';
const OVERALL_ID = 'overall';
const CALLBACKS_ID = 'callbacks';

function ordinal(n: number) {
  const s = n % 100;
  if (s >= 11 && s <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** dancerId → place (1-based), mirroring the app's parsing of ties and reverse entry. */
export function parsePlacings(raw: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (!Array.isArray(raw) || !raw.length) return out;
  let entries = raw as string[];
  let reverseFrom: number | null = null;
  if (typeof entries[0] === 'string' && entries[0].startsWith(REVERSE_PREFIX)) {
    reverseFrom = Number.parseInt(entries[0].slice(REVERSE_PREFIX.length), 10);
    entries = entries.slice(1);
  }
  const rows = entries.map((e) => ({
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

function daysFromToday(date: unknown): number | null {
  if (date == null) return null;
  const isDay = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const d = isDay ? new Date(`${date}T12:00:00Z`) : new Date(date as string | number);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / 86_400_000);
}

interface Message {
  uid: string;
  title: string;
  body: string;
  link: string;
  key: string;
  signature: string;
}

async function tokensFor(db: Db, uid: string) {
  const snap = await db.child(`users:tokens/${uid}`).get();
  return Object.entries((snap.val() || {}) as Record<string, { token?: string }>)
    .map(([key, v]) => ({ key, token: v?.token }))
    .filter((t): t is { key: string; token: string } => !!t.token);
}

async function deliverOne(db: Db, app: admin.app.App, m: Message, emulated: boolean) {
  const sentRef = db.child(`notifications:sent/${m.key}`);
  if ((await sentRef.get()).val() === m.signature) return;
  const tokens = await tokensFor(db, m.uid);
  if (emulated) {
    await db.child('notifications:log').push({
      uid: m.uid,
      title: m.title,
      body: m.body,
      link: m.link,
      tokens: tokens.length,
      at: Date.now(),
    });
  } else if (tokens.length) {
    const res = await admin.messaging(app).sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: { title: m.title, body: m.body },
      data: { link: m.link },
      apns: { payload: { aps: { sound: 'default' } } },
    });
    // Forget tokens the platform says are gone.
    const gone = /registration-token-not-registered|invalid-argument/;
    const dead = res.responses
      .map((r, i) => (!r.success && gone.test(r.error?.code ?? '') ? tokens[i].key : null))
      .filter((k): k is string => !!k);
    await Promise.all(dead.map((k) => db.child(`users:tokens/${m.uid}/${k}`).remove()));
  }
  await sentRef.set(m.signature);
}

function deliver(db: Db, app: admin.app.App, messages: Message[], emulated: boolean) {
  return Promise.all(messages.map((m) => deliverOne(db, app, m, emulated)));
}

type AlertKind = 'results' | 'morning' | 'published';

async function wants(db: Db, uid: string, kind: AlertKind) {
  const a = (await db.child(`users/${uid}/alerts`).get()).val() || {};
  return a.enabled === true && a[kind] !== false;
}

export function getOnResultsWritten(db: Db, app: admin.app.App, emulated: boolean) {
  type Change = { before: admin.database.DataSnapshot; after: admin.database.DataSnapshot };
  return async (change: Change, ctx: { params: Record<string, string> }) => {
    const { competitionId, groupId, danceId } = ctx.params;
    if (danceId === CALLBACKS_ID) return;
    const after = change.after.val();
    if (!Array.isArray(after) || !after.length) return;
    if (JSON.stringify(change.before.val()) === JSON.stringify(after)) return;

    const comp = (await db.child(`competitions/${competitionId}`).get()).val() || {};
    if (!comp.published) return;
    // Only around competition day: backfilling old results must not notify.
    // (Skipped in the emulator, whose data is years old.)
    const days = daysFromToday(comp.date);
    if (!emulated && (days == null || days < -1 || days > 1)) return;

    const placings = parsePlacings(after);
    const dataRef = (path: string) => db.child(`competitions:data/${competitionId}/${path}`);
    const [danceSnap, groupSnap] = await Promise.all([
      danceId === OVERALL_ID ? Promise.resolve(null) : dataRef(`dances/${danceId}/name`).get(),
      dataRef(`groups/${groupId}`).get(),
    ]);
    const danceName = danceId === OVERALL_ID ? 'overall' : `the ${danceSnap?.val() || 'dance'}`;
    const group = groupSnap.val() || {};
    const category = group.categoryId
      ? (await dataRef(`categories/${group.categoryId}/name`).get()).val()
      : null;
    const groupName = [category, group.name].filter(Boolean).join(' ');

    // Everyone entered in this group: placed or not, their followers hear the results are in.
    const entriesSnap = await dataRef('dancers')
      .orderByChild('groupId')
      .equalTo(groupId)
      .get();
    type Entry = { firstName?: string; dancerId?: string };
    const entries = Object.entries((entriesSnap.val() || {}) as Record<string, Entry>);

    const titleFor = (first: string, place: number | undefined) => {
      if (!place) return `Results are in for ${danceName}`;
      if (danceId === OVERALL_ID) return `${first} placed ${ordinal(place)} overall`;
      return `${first} placed ${ordinal(place)} in ${danceName}`;
    };
    const body = [groupName, comp.name].filter(Boolean).join(' · ');
    const link = `/competitions/${competitionId}/results/${groupId}#dance-${danceId}`;

    const perEntry = await Promise.all(
      entries
        .filter(([, entry]) => !!entry?.dancerId)
        .map(async ([entryId, entry]) => {
          const followersSnap = await db.child(`dancers:followers/${entry.dancerId}`).get();
          const followers = Object.keys(followersSnap.val() || {});
          const enabled = await Promise.all(
            followers.map((uid) => wants(db, uid, 'results')),
          );
          const place = placings.get(entryId);
          return followers
            .filter((_, i) => enabled[i])
            .map<Message>((uid) => ({
            uid,
            title: titleFor(entry.firstName || 'Your dancer', place),
            body,
            link,
            key: `${competitionId}/${groupId}/${danceId}/${uid}_${entryId}`,
            signature: String(place ?? 'in'),
          }));
        }),
    );
    const messages = perEntry.flat();
    await deliver(db, app, messages, emulated);
  };
}

/** Keeps dancers:followers in step with users:favorites/{uid}/dancers. */
export function getOnFavoriteWritten(db: Db) {
  type Change = { after: admin.database.DataSnapshot };
  return async (change: Change, ctx: { params: Record<string, string> }) => {
    const { uid, dancerId } = ctx.params;
    const ref = db.child(`dancers:followers/${dancerId}/${uid}`);
    if (change.after.exists()) await ref.set(true);
    else await ref.remove();
  };
}

/** One-off: build dancers:followers from existing favourites. */
export function getOnBackfillFollowers(db: Db) {
  return async () => {
    const all = (await db.child('users:favorites').get()).val() || {};
    const updates: Record<string, true> = {};
    type Fav = { dancers?: Record<string, unknown>; competitions?: Record<string, unknown> };
    Object.entries(all as Record<string, Fav>).forEach(([uid, fav]) => {
      Object.keys(fav?.dancers || {}).forEach((dancerId) => {
        updates[`dancers:followers/${dancerId}/${uid}`] = true;
      });
      Object.keys(fav?.competitions || {}).forEach((competitionId) => {
        updates[`competitions:followers/${competitionId}/${uid}`] = true;
      });
    });
    await db.update(updates);
    return { count: Object.keys(updates).length };
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
  const firstName = new Map(entries.filter((e) => e?.dancerId).map((e) => [e.dancerId as string, e.firstName || '']));
  const followerLists = await Promise.all(
    personIds.map(async (id) => Object.keys((await db.child(`dancers:followers/${id}`).get()).val() || {})),
  );
  followerLists.forEach((uids, i) => uids.forEach((uid) => {
    const set = byUid.get(uid) ?? new Set<string>();
    const name = firstName.get(personIds[i]);
    if (name) set.add(name);
    byUid.set(uid, set);
  }));
  const compFollowers = Object.keys((await db.child(`competitions:followers/${competitionId}`).get()).val() || {});
  compFollowers.forEach((uid) => byUid.set(uid, byUid.get(uid) ?? new Set()));
  return byUid;
}

const listNames = (names: string[]) => (names.length > 1
  ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  : names[0]);

async function notifyCompetition(
  db: Db,
  app: admin.app.App,
  emulated: boolean,
  competitionId: string,
  kind: 'morning' | 'published',
) {
  const comp = (await db.child(`competitions/${competitionId}`).get()).val() || {};
  if (!comp.published) return 0;
  const recipients = await recipientsFor(db, competitionId);
  const uids = [...recipients.keys()];
  const allowed = await Promise.all(uids.map((uid) => wants(db, uid, kind)));
  const messages = uids.filter((_, i) => allowed[i]).map<Message>((uid) => {
    const names = [...(recipients.get(uid) ?? [])];
    const who = names.length ? listNames(names) : null;
    const verb = names.length > 1 ? 'are' : 'is';
    let title: string;
    let body: string;
    if (kind === 'morning') {
      title = who ? `Today at ${comp.name}: ${who} ${verb} dancing` : `${comp.name} is today`;
      body = 'Tap for platforms and dancing order.';
    } else {
      title = `${comp.name} is live`;
      body = who
        ? `${who} ${verb} on the dancer list. See platforms and dancing order.`
        : 'The dancer list and schedule are up.';
    }
    return {
      uid,
      title,
      body,
      link: `/competitions/${competitionId}/info`,
      key: `${competitionId}/${kind}/${uid}`,
      signature: kind,
    };
  });
  await deliver(db, app, messages, emulated);
  return messages.length;
}

/** A competition is published (organisers usually do this when the dancer list is ready). */
export function getOnCompetitionPublished(db: Db, app: admin.app.App, emulated: boolean) {
  type Change = { before: admin.database.DataSnapshot; after: admin.database.DataSnapshot };
  return async (change: Change, ctx: { params: Record<string, string> }) => {
    if (change.before.val() === true || change.after.val() !== true) return;
    await notifyCompetition(db, app, emulated, ctx.params.competitionId, 'published');
  };
}

/** Morning of competition day: a summary for everyone following someone entered. */
export async function sendMorningSummaries(
  db: Db,
  app: admin.app.App,
  emulated: boolean,
  today: string,
) {
  const snap = await db.child('competitions').orderByChild('date').equalTo(today).get();
  const ids = Object.keys(snap.val() || {});
  const counts = await Promise.all(ids.map((id) => notifyCompetition(db, app, emulated, id, 'morning')));
  return { competitions: ids.length, messages: counts.reduce((a, b) => a + b, 0) };
}

/** Keeps competitions:followers in step with users:favorites/{uid}/competitions. */
export function getOnCompetitionFavoriteWritten(db: Db) {
  type Change = { after: admin.database.DataSnapshot };
  return async (change: Change, ctx: { params: Record<string, string> }) => {
    const { uid, competitionId } = ctx.params;
    const ref = db.child(`competitions:followers/${competitionId}/${uid}`);
    if (change.after.exists()) await ref.set(true);
    else await ref.remove();
  };
}
