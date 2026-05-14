import admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import Invites from './invites';
import Submissions from './submissions';
import * as Dancers from './dancers';
import * as Competitions from './competitions';
import * as Judges from './judges';
import { getOnSearchAll } from './search';
import { runBackfillCoords } from './backfillCoords';
import { attachUserToCompetition, ensureAdmin } from './utility/competition';
import { isCypress, isEmulator } from './utility/env';
import { runtimeConfig, geocodingApiKey } from './utility/config';

const app = admin.initializeApp({
  databaseURL: isCypress() ? `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}?ns=scotdance-cypress` : 'https://scotdance.firebaseio.com',
}, 'app');
if (isEmulator() && !isCypress()) {
  functions.app.setEmulatedAdminApp(app);
}

const env = isEmulator() ? 'development' : 'production';
const appConfig = {
  db: admin.database(app).ref(env),
  database: isCypress() ? functions.database.instance('scotdance-cypress') : functions.database,
  name: 'ScotDance.app',
  description: 'Highland dancing event tracker',
  email: 'admin@scotdance.app',
  url: isEmulator() ? 'https://localhost:3000' : 'https://scotdance.app',
};

const configRunWith = { secrets: [runtimeConfig] };
const configDatabase = isCypress()
  ? functions.runWith(configRunWith).database.instance('scotdance-cypress')
  : functions.runWith(configRunWith).database;

const invites = new Invites(configDatabase, appConfig);
const invitesHooks = invites.hook(`/${env}/competitions:data/{competitionId}/invites`);
export const competitionInviteCreated = invitesHooks.onCreate;
export const competitionInviteUpdated = invitesHooks.onUpdate;
export const competitionInviteDeleted = invitesHooks.onDelete;

const submissions = new Submissions(configDatabase, appConfig);
const submissionsHooks = submissions.hook(`/${env}/competitions:submissions`);
export const competitionSubmissionCreated = submissionsHooks.onCreate;
export const competitionSubmissionUpdated = submissionsHooks.onUpdate;

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
export const competitionPublishedChanged = appConfig.database.ref(`/${env}/competitions/{competitionId}/published`).onWrite(async (change, ctx) => {
  const { competitionId } = ctx.params;
  const ref = appConfig.db.child(`competitions:published/${competitionId}`);
  const isPublished = change.after.val();
  if (isPublished) {
    await ref.set(true);
  } else {
    await ref.remove();
  }
});
// Admin-triggered one-off (or re-run) backfill of lat/lng/country on competition
// records that lack them. Geocodes via the Google Geocoding API.
// Pass `{ dryRun: true }` to log proposed writes without persisting.
export const backfillCoords = functions
  .runWith({ secrets: [geocodingApiKey], timeoutSeconds: 540, memory: '512MB' })
  .https.onCall(async (data, ctx) => {
    await ensureAdmin(ctx, appConfig.db);
    const dryRun = Boolean(data?.dryRun);
    return runBackfillCoords(
      appConfig.db.child('competitions'),
      geocodingApiKey.value(),
      dryRun,
    );
  });

export const reindexCompetitionsPublished = functions.https.onCall(async (data, ctx) => {
  await ensureAdmin(ctx, appConfig.db);

  const competitions: any[] = (await appConfig.db.child('competitions').get()).val();
  const competitionsPublished = Object.entries(competitions || {})
    .filter(([, { published }]) => published)
    .reduce((acc, [competitionId]) => {
      acc[competitionId] = true;
      return acc;
    }, {});
  await appConfig.db.child('competitions:published').set(competitionsPublished);
  return competitionsPublished;
});

const dancersRef = configDatabase.ref(`/${env}/competitions:data/{competitionId}/dancers/{dancerId}`);
export const dancerCreated = !isCypress() && dancersRef.onCreate(Dancers.onCreate);
export const dancerUpdated = !isCypress() && dancersRef.onUpdate(Dancers.onUpdate);
export const dancerDeleted = !isCypress() && dancersRef.onDelete(Dancers.onDelete);
const configHttps = functions.runWith(configRunWith).https;
export const searchDancers = configHttps.onCall(Dancers.getOnSearch(appConfig.db));
export const reindexDancers = configHttps.onCall(Dancers.getOnReindex(appConfig.db));

const competitionsIndexRef = configDatabase.ref(`/${env}/competitions/{competitionId}`);
export const competitionIndexCreated = !isCypress()
  && competitionsIndexRef.onCreate(Competitions.onCreate);
export const competitionIndexUpdated = !isCypress()
  && competitionsIndexRef.onUpdate(Competitions.onUpdate);
export const competitionIndexDeleted = !isCypress()
  && competitionsIndexRef.onDelete(Competitions.onDelete);
export const reindexCompetitions = configHttps.onCall(Competitions.getOnReindex(appConfig.db));

const judgesRef = configDatabase.ref(`/${env}/competitions:data/{competitionId}/staff/{staffId}`);
export const judgeCreated = !isCypress() && judgesRef.onCreate(Judges.onCreate);
export const judgeUpdated = !isCypress() && judgesRef.onUpdate(Judges.onUpdate);
export const judgeDeleted = !isCypress() && judgesRef.onDelete(Judges.onDelete);
export const reindexJudges = configHttps.onCall(Judges.getOnReindex(appConfig.db));

export const searchAll = configHttps.onCall(getOnSearchAll(appConfig.db));
