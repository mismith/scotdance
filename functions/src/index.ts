import admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Invites from './invites';
import Submissions from './submissions';
import * as Dancers from './dancers';
import { attachUserToCompetition, ensureAdmin } from './utility/competition';
import { isCypress, isEmulator } from './utility/env';

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

const invites = new Invites(appConfig.database, appConfig);
const invitesHooks = invites.hook(`/${env}/competitions:data/{competitionId}/invites`);
export const competitionInviteCreated = invitesHooks.onCreate;
export const competitionInviteUpdated = invitesHooks.onUpdate;
export const competitionInviteDeleted = invitesHooks.onDelete;

const submissions = new Submissions(appConfig.database, appConfig);
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

const dancersRef = appConfig.database.ref(`/${env}/competitions:data/{competitionId}/dancers/{dancerId}`);
export const dancerCreated = !isCypress() && dancersRef.onCreate(Dancers.onCreate);
export const dancerUpdated = !isCypress() && dancersRef.onUpdate(Dancers.onUpdate);
export const dancerDeleted = !isCypress() && dancersRef.onDelete(Dancers.onDelete);
export const searchDancers = functions.https.onCall(Dancers.getOnSearch(appConfig.db));
export const reindexDancers = functions.https.onCall(Dancers.getOnReindex(appConfig.db));
