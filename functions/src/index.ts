import { initializeApp, database as adminDB } from 'firebase-admin';
import { config, database as functionsDB } from 'firebase-functions';
import Invites from './invites';
import Submissions from './submissions';
import { attachUserToCompetition } from './utility/competition';

const app = initializeApp();
const env = config().app?.env || 'production';
const appConfig = {
  env,
  app,
  db: adminDB().ref(env),
  database: functionsDB,
  name: 'ScotDance.app',
  description: 'Highland dancing event tracker',
  email: 'admin@scotdance.app',
  url: env === 'development' ? 'https://localhost:3000' : 'https://scotdance.app',
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
