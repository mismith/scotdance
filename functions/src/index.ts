import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { app as functionsApp } from 'firebase-functions/v1';
import Invites from './invites';
import Submissions from './submissions';
import * as Dancers from './dancers';
import * as Competitions from './competitions';
import * as Judges from './judges';
import * as Pipers from './pipers';
import * as Venues from './venues';
import * as Organisations from './organisations';
import * as Notifications from './notifications';
import { getOnSearchAll } from './search';
import { runBackfillCoords } from './backfillCoords';
import { attachUserToCompetition, ensureAdmin } from './utility/competition';
import { isEmulator } from './utility/env';
import { runtimeConfig, geocodingApiKey } from './utility/config';
import { database, https } from './utility/triggers';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { enqueue, TASKS_INVOKER } from './utility/tasks';

// In the emulator, trigger snapshots build their `.ref` from
// `http://{emulator host}/?ns=scotdance` on this same app (see
// setEmulatedAdminApp below). The app's own URL must be that exact string, or
// firebase-admin opens a second database for it and throws "Database
// initialized multiple times".
function databaseURL() {
  if (isEmulator()) return `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}/?ns=scotdance`;
  return 'https://scotdance.firebaseio.com';
}
const app = initializeApp({ databaseURL: databaseURL() }, 'app');
if (isEmulator()) {
  functionsApp.setEmulatedAdminApp(app);
}

const env = isEmulator() ? 'development' : 'production';
const appConfig = {
  db: getDatabase(app).ref(env),
  database: database(),
  name: 'ScotDance.app',
  description: 'Highland dancing event tracker',
  email: 'admin@scotdance.app',
  url: isEmulator() ? 'http://localhost:5273' : 'https://scotdance.app',
};

const configDatabase = database({ secrets: [runtimeConfig] });

const invites = new Invites(configDatabase, appConfig);
const invitesHooks = invites.hook(`/${env}/competitions:data/{competitionId}/invites`);
export const competitionInviteCreated = invitesHooks.onCreate;
export const competitionInviteUpdated = invitesHooks.onUpdate;
export const competitionInviteDeleted = invitesHooks.onDelete;

const submissions = new Submissions(configDatabase, appConfig);
const submissionsHooks = submissions.hook(`/${env}/competitions:submissions`);
export const competitionSubmissionCreated = submissionsHooks.onCreate;
export const competitionSubmissionUpdated = submissionsHooks.onUpdate;

// Organisations: anyone running a competition can start one; its admins
// invite others to help, as a competition's do.
export const createOrganisation = https({ secrets: [runtimeConfig] }).onCall(Organisations.getOnCreate(appConfig.db));
const organisationInvites = new Organisations.OrganisationInvites(configDatabase, appConfig);
const organisationInvitesHooks = organisationInvites.hook(`/${env}/organisations:data/{organisationId}/invites`);
export const organisationInviteCreated = organisationInvitesHooks.onCreate;
export const organisationInviteUpdated = organisationInvitesHooks.onUpdate;
export const organisationInviteDeleted = organisationInvitesHooks.onDelete;
export const organisationDeleted = appConfig.database.ref(`/${env}/organisations/{organisationId}`)
  .onDelete(Organisations.getOnDelete(appConfig.db));

export const competitionDeleted = appConfig.database.ref(`/${env}/competitions/{competitionId}`)
  .onDelete(async (before, ctx) => {
    // remove lingering permissions links between competitions and users
    const { db } = appConfig;
    const { competitionId } = ctx.params;
    const snap = await db.child(`competitions:permissions/${competitionId}`).once('value');
    const permissions = snap.val();
    if (!permissions) return;
    const { users } = permissions;
    if (!users) return;

    const userIds = Object.keys(users);
    await Promise.all(userIds.map((userId) => attachUserToCompetition({
      db,
      userId,
      competitionId,
      value: null,
    })));
  });
// Publishing links the competition's dancers into their public profiles
// (unpublishing unlinks them), which can take a while for a big one.
// Then followers hear it's live: after the sync, which links the entries to
// the dancers they follow (so this isn't a trigger of its own).
const syncDancers = Dancers.getOnSyncCompetition(appConfig.db);
const notifyFollowersOnPublished = Notifications.getOnCompetitionPublished(appConfig.db, app, isEmulator());
const publishedDatabase = database({ timeoutSeconds: 540 });
export const competitionPublishedChanged = publishedDatabase.ref(`/${env}/competitions/{competitionId}/published`).onWrite(async (change, ctx) => {
  const { competitionId } = ctx.params;
  const ref = appConfig.db.child(`competitions:published/${competitionId}`);
  const isPublished = change.after.val();
  if (isPublished) {
    await ref.set(true);
  } else {
    await ref.remove();
  }
  await syncDancers(competitionId);
  await notifyFollowersOnPublished(change, ctx);
});
// Search shows a listed competition (and its judges and pipers) before it's
// published, so it keeps a list of those too.
const listedDatabase = database();
export const competitionListedChanged = listedDatabase.ref(`/${env}/competitions/{competitionId}/listed`).onWrite(async (change, ctx) => {
  const ref = appConfig.db.child(`competitions:listed/${ctx.params.competitionId}`);
  if (change.after.val() === true) await ref.set(true);
  else await ref.remove();
});
// Admin-triggered one-off (or re-run) backfill of lat/lng/country on competition
// records that lack them. Geocodes via the Google Geocoding API.
// Pass `{ dryRun: true }` to log proposed writes without persisting.
export const backfillCoords = https({ secrets: [geocodingApiKey], timeoutSeconds: 540, memory: '512MiB' })
  .onCall(async (data, ctx) => {
    await ensureAdmin(ctx, appConfig.db);
    const dryRun = Boolean(data?.dryRun);
    return runBackfillCoords(
      appConfig.db.child('competitions'),
      geocodingApiKey.value(),
      dryRun,
    );
  });

// Rebuilds the published and listed lists (search reads them) from the
// competitions themselves.
export const reindexCompetitionsPublished = https().onCall(async (data, ctx) => {
  await ensureAdmin(ctx, appConfig.db);

  const competitions: Record<string, any> = (await appConfig.db.child('competitions').get()).val() || {};
  const idsWhere = (key: 'published' | 'listed') => Object.fromEntries(
    Object.entries(competitions)
      .filter(([, c]) => c && c[key] === true)
      .map(([competitionId]) => [competitionId, true]),
  );
  const published = idsWhere('published');
  const listed = idsWhere('listed');
  await appConfig.db.update({ 'competitions:published': published, 'competitions:listed': listed });
  return { published: Object.keys(published).length, listed: Object.keys(listed).length };
});

const dancersRef = configDatabase.ref(`/${env}/competitions:data/{competitionId}/dancers/{dancerId}`);
export const dancerCreated = dancersRef.onCreate(Dancers.getOnCreate(appConfig.db));
export const dancerUpdated = dancersRef.onUpdate(Dancers.getOnUpdate(appConfig.db));
export const dancerDeleted = dancersRef.onDelete(Dancers.getOnDelete(appConfig.db));
const configHttps = https({ secrets: [runtimeConfig] });
// Backfills and reindexes read every competition: give them the longest a
// callable may run, and memory for production-sized data.
const adminHttps = https({ secrets: [runtimeConfig], timeoutSeconds: 540, memory: '1GiB' });
export const searchDancers = configHttps.onCall(Dancers.getOnSearch(appConfig.db));
export const reindexDancers = adminHttps.onCall(Dancers.getOnReindex(appConfig.db));
export const backfillDancerAggregates = adminHttps.onCall(
  Dancers.getOnBackfillAggregates(appConfig.db),
);
export const backfillDancerBackPointers = adminHttps.onCall(
  Dancers.getOnBackfillBackPointers(appConfig.db),
);

const competitionsIndexRef = configDatabase.ref(`/${env}/competitions/{competitionId}`);
// One trigger per event, composed: Typesense indexing + venue aggregate.
const venueOnCreate = Venues.getOnCreate(appConfig.db);
const venueOnUpdate = Venues.getOnUpdate(appConfig.db);
const venueOnDelete = Venues.getOnDelete(appConfig.db);
// Listing (or publishing) a competition shows its judges and pipers on their
// profiles; hiding or deleting it takes them off.
const syncJudges = Judges.getOnSyncCompetition(appConfig.db);
const syncPipers = Pipers.getOnSyncCompetition(appConfig.db);
const syncStaff = async (competitionId: string) => {
  await syncJudges(competitionId);
  await syncPipers(competitionId);
};
const shown = (comp: any) => comp?.listed === true || comp?.published === true;
export const competitionIndexCreated = competitionsIndexRef.onCreate(async (snap, ctx) => {
  await Competitions.onCreate(snap, ctx);
  await venueOnCreate(snap, ctx);
  if (shown(snap.val())) await syncStaff(ctx.params.competitionId);
});
export const competitionIndexUpdated = competitionsIndexRef.onUpdate(async (change, ctx) => {
  await Competitions.onUpdate(change, ctx);
  await venueOnUpdate(change, ctx);
  if (shown(change.before.val()) !== shown(change.after.val())) {
    await syncStaff(ctx.params.competitionId);
  }
});
export const competitionIndexDeleted = competitionsIndexRef.onDelete(async (snap, ctx) => {
  await Competitions.onDelete(snap, ctx);
  await venueOnDelete(snap, ctx);
  if (shown(snap.val())) await syncStaff(ctx.params.competitionId);
});
export const reindexCompetitions = adminHttps.onCall(Competitions.getOnReindex(appConfig.db));
export const backfillVenueAggregates = adminHttps.onCall(
  Venues.getOnBackfillAggregates(appConfig.db),
);
export const backfillVenueBackPointers = adminHttps.onCall(
  Venues.getOnBackfillBackPointers(appConfig.db),
);

const judgesRef = configDatabase.ref(`/${env}/competitions:data/{competitionId}/staff/{staffId}`);
export const judgeCreated = judgesRef.onCreate(Judges.getOnCreate(appConfig.db));
export const judgeUpdated = judgesRef.onUpdate(Judges.getOnUpdate(appConfig.db));
export const judgeDeleted = judgesRef.onDelete(Judges.getOnDelete(appConfig.db));
export const reindexJudges = adminHttps.onCall(Judges.getOnReindex(appConfig.db));
export const backfillJudgeAggregates = adminHttps.onCall(
  Judges.getOnBackfillAggregates(appConfig.db),
);
export const backfillJudgeBackPointers = adminHttps.onCall(
  Judges.getOnBackfillBackPointers(appConfig.db),
);

const pipersRef = configDatabase.ref(`/${env}/competitions:data/{competitionId}/staff/{staffId}`);
export const piperCreated = pipersRef.onCreate(Pipers.getOnCreate(appConfig.db));
export const piperUpdated = pipersRef.onUpdate(Pipers.getOnUpdate(appConfig.db));
export const piperDeleted = pipersRef.onDelete(Pipers.getOnDelete(appConfig.db));
export const reindexPipers = adminHttps.onCall(Pipers.getOnReindex(appConfig.db));
export const backfillPiperAggregates = adminHttps.onCall(
  Pipers.getOnBackfillAggregates(appConfig.db),
);
export const backfillPiperBackPointers = adminHttps.onCall(
  Pipers.getOnBackfillBackPointers(appConfig.db),
);

export const searchAll = configHttps.onCall(getOnSearchAll(appConfig.db));

// Push alerts (see notifications.ts).
// Results: Manage saves every tap, so each save queues a task a minute on (5 s
// in the emulator), which sends only if nothing's changed since.
const resultsSettleSeconds = isEmulator() ? 5 : 60;
export const notifyFollowersOnResult = database()
  .ref(`/${env}/competitions:data/{competitionId}/results/{groupId}/{danceId}`)
  .onWrite(Notifications.getOnResultsWritten(appConfig.db, isEmulator(), (task) => (
    enqueue(app, 'sendResultAlerts', { ...task }, resultsSettleSeconds)
  )));
export const sendResultAlerts = onTaskDispatched<Notifications.SettleTask>({
  retryConfig: { maxAttempts: 3, minBackoffSeconds: 30 },
  // No more at once than it can run (maxInstances, utility/triggers.ts):
  // beyond that, the queue waits rather than having tasks turned away.
  rateLimits: { maxConcurrentDispatches: 10 },
  invoker: TASKS_INVOKER,
}, async (req) => {
  await Notifications.getOnResultsSettled(appConfig.db, app, isEmulator())(req.data);
});
export const followerIndexOnFavorite = database()
  .ref(`/${env}/users:favorites/{uid}/dancers/{aggregateId}`)
  .onWrite(Notifications.getOnFavoriteWritten(appConfig.db));
export const followerIndexOnCompetitionFavorite = database()
  .ref(`/${env}/users:favorites/{uid}/competitions/{competitionId}`)
  .onWrite(Notifications.getOnCompetitionFavoriteWritten(appConfig.db));
export const backfillFollowers = adminHttps.onCall(async (data, ctx) => {
  await ensureAdmin(ctx, appConfig.db);
  return Notifications.getOnBackfillFollowers(appConfig.db)();
});
// One competition's morning summary now (System admin › Tools, for trying it out).
export const sendMorningSummary = adminHttps.onCall(async (data, ctx) => {
  await ensureAdmin(ctx, appConfig.db);
  return Notifications.sendMorningSummaryNow(appConfig.db, app, isEmulator(), String(data?.competitionId ?? ''));
});
// Hourly: each competition's summary goes out in the run that lands between
// 06:00 and 06:59 where it's held (time zone from its coordinates).
export const morningSummaries = onSchedule({ schedule: '30 * * * *', timeZone: 'UTC', timeoutSeconds: 300 }, async () => {
  await Notifications.sendMorningSummaries(appConfig.db, app, isEmulator());
});
